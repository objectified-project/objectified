'use client';

/**
 * CatalogImportDialog (MFI-23.7) — the catalog's **store-raw** importer.
 *
 * Unlike the Projects importer (which converts a source to OpenAPI client-side and creates a
 * publishable Project), this stores the *original source verbatim* as a non-publishable catalog
 * item and defers conversion: nothing is converted at import time. The user chooses a file (or
 * pastes content), we detect its format for the label + adapter routing and show a **light preview**
 * of the raw source, then "Store in catalog" runs the REST spec-import adapter pipeline
 * (`/api/catalog/import`) which persists the item keeping the raw bytes for a later
 * Convert-to-OpenAPI (MFI-EPIC-22).
 *
 * Only adapter-backed formats can be stored today (gRPC/Protobuf, GraphQL, AsyncAPI). A recognized
 * but not-yet-adapter-backed format (Thrift, Avro, RAML, …) is reported as such rather than failing
 * mid-import — see {@link catalogAdapterForFormat}.
 */

import { useCallback, useRef, useState } from 'react';
import { Upload, FileCode, CheckCircle2, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../../ui/Dialog';
import { Button } from '../../../ui/Button';
import { Alert } from '../../../ui/Alert';
import { extractFileMetadata, type FileMetadataPreview } from '../../../../utils/openapi-analyzer';
import { generateSlug } from '../../../../utils/slug';
import { FormatPill } from '../../../ui/catalog/FormatPill';
import { catalogAdapterForFormat, CATALOG_STORABLE_SOURCES } from '../../../../utils/catalog-import-formats';
import { useCatalogImportAvailability } from './useCatalogImportAvailability';

interface CatalogImportDialogProps {
  open: boolean;
  onClose: () => void;
  /** Called after a catalog item is stored, so the parent can refresh the list. */
  onSuccess?: () => void;
}

/** UTF-8-safe base64 of text content for the REST `document_base64` field. */
function toBase64(text: string): string {
  return btoa(unescape(encodeURIComponent(text)));
}

/** Strip a file extension for a friendlier default catalog item name. */
function baseName(fileName: string): string {
  const noPath = fileName.split(/[\\/]/).pop() ?? fileName;
  return noPath.replace(/\.[^.]+$/, '') || noPath;
}

const PREVIEW_LIMIT = 4000;

type Phase = 'select' | 'preview' | 'storing' | 'done';

export function CatalogImportDialog({ open, onClose, onSuccess }: CatalogImportDialogProps) {
  const [phase, setPhase] = useState<Phase>('select');
  const [fileName, setFileName] = useState<string>('');
  const [content, setContent] = useState<string>('');
  const [metadata, setMetadata] = useState<FileMetadataPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const availability = useCatalogImportAvailability(open);

  const adapter = metadata ? catalogAdapterForFormat(metadata.format) : null;
  // An adapter whose toolchain is missing in this runtime (e.g. gRPC needs `buf`, MFI-5.2) can't
  // actually import; treat it as unstorable and explain why instead of failing at parse.
  const adapterUnavailable = adapter !== null && !availability.isAvailable(adapter.sourceKind);
  const unavailableReason = adapter ? availability.reasonFor(adapter.sourceKind) : null;
  const canStore = adapter !== null && !adapterUnavailable;
  // Name only the sources that can actually run here — once availability has loaded, an adapter
  // whose toolchain is missing (e.g. gRPC without `buf`) drops out of the "supported" list.
  const availableSources = CATALOG_STORABLE_SOURCES.filter((s) => availability.isAvailable(s.sourceKind));
  const supportedLabel = (availableSources.length ? availableSources : CATALOG_STORABLE_SOURCES)
    .map((s) => s.label)
    .join(', ');

  const reset = useCallback(() => {
    setPhase('select');
    setFileName('');
    setContent('');
    setMetadata(null);
    setError(null);
    setIsDragging(false);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const ingest = useCallback((text: string, name: string) => {
    setContent(text);
    setFileName(name);
    setMetadata(extractFileMetadata(text));
    setError(null);
    setPhase('preview');
  }, []);

  const handleFile = useCallback(
    async (file: File) => {
      try {
        const text = await file.text();
        ingest(text, file.name);
      } catch {
        setError('Could not read that file. Try another file.');
      }
    },
    [ingest],
  );

  const handleStore = useCallback(async () => {
    if (!adapter || adapterUnavailable || !content) return;
    setPhase('storing');
    setError(null);
    try {
      const name = (metadata?.title || baseName(fileName) || 'Imported source').trim();
      const slug = generateSlug(name) || 'imported-source';
      const startRes = await fetch('/api/catalog/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metadata: {
            source_kind: adapter.sourceKind,
            project: { name, slug, description: metadata?.description ?? null },
            version: { version_id: metadata?.specVersion || '1.0.0' },
            options: {},
          },
          document_base64: toBase64(content),
          filename: fileName || 'source',
        }),
      });
      const startData = await startRes.json().catch(() => ({}));
      if (!startRes.ok || startData?.success === false) {
        throw new Error(startData?.error || 'Failed to start the import.');
      }
      const jobId: string | undefined = startData?.job_id;
      if (!jobId) throw new Error('The import did not start (no job id returned).');

      // Poll to a terminal state.
      const terminal = new Set(['completed', 'failed', 'canceled', 'rolled-back', 'pending-approval']);
      for (let i = 0; i < 150; i++) {
        await new Promise((r) => setTimeout(r, 400));
        const pollRes = await fetch(`/api/catalog/import/${encodeURIComponent(jobId)}`);
        const pollData = await pollRes.json().catch(() => ({}));
        if (!pollRes.ok || pollData?.success === false) {
          throw new Error(pollData?.error || 'Failed to check import status.');
        }
        const state: string | undefined = pollData?.state;
        if (state && terminal.has(state)) {
          if (state === 'completed') {
            setPhase('done');
            onSuccess?.();
            return;
          }
          const failEvent = Array.isArray(pollData?.events)
            ? [...pollData.events].reverse().find((e: { level?: string }) => e?.level === 'error')
            : null;
          throw new Error(failEvent?.message || `Import ${state}.`);
        }
      }
      throw new Error('The import is taking longer than expected. Check the catalog shortly.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to store the source.');
      setPhase('preview');
    }
  }, [adapter, adapterUnavailable, content, fileName, metadata, onSuccess]);

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? handleClose() : undefined)}>
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col">
        <DialogHeader>
          <DialogTitle>Import to catalog</DialogTitle>
          <DialogDescription>
            The source is stored in its original format and converted only when you&apos;re ready.
            Supported: {supportedLabel}.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="error" className="mt-2">
            {error}
          </Alert>
        )}

        {phase === 'select' && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file) void handleFile(file);
            }}
            className={`mt-3 flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
              isDragging
                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                : 'border-gray-300 dark:border-gray-700'
            }`}
          >
            <Upload className="h-8 w-8 text-gray-400" aria-hidden />
            <div className="text-sm text-gray-600 dark:text-gray-300">
              Drop a {supportedLabel} file here, or
            </div>
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              Browse files
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".proto,.graphql,.gql,.yaml,.yml,.json"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
              }}
            />
          </div>
        )}

        {(phase === 'preview' || phase === 'storing') && metadata && (
          <div className="mt-3 flex min-h-0 flex-1 flex-col gap-3">
            <div className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
              <div className="flex items-center gap-2 truncate">
                <FileCode className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
                <span className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{fileName}</span>
              </div>
              <div className="flex items-center gap-2">
                <FormatPill format={metadata.format === 'unknown' ? null : metadata.format} />
                <button
                  type="button"
                  onClick={reset}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  aria-label="Choose a different file"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </div>

            {!adapter ? (
              <Alert variant="warning">
                <div className="font-medium">Not importable to the catalog yet</div>
                <div className="text-sm">
                  {metadata.formatDisplayName} is recognized but has no importer. The catalog can
                  currently store: {supportedLabel}.
                </div>
              </Alert>
            ) : adapterUnavailable ? (
              <Alert variant="warning">
                <div className="font-medium">{adapter.label} import is unavailable in this runtime</div>
                <div className="text-sm">
                  {unavailableReason ||
                    `The ${adapter.label} importer requires a toolchain that is not available here.`}
                </div>
              </Alert>
            ) : (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Will be stored as <span className="font-semibold">{adapter.label}</span> — kept
                verbatim; convert to OpenAPI later from the catalog.
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
              <pre className="whitespace-pre-wrap p-3 font-mono text-[11px] leading-snug text-gray-700 dark:text-gray-300">
                {content.slice(0, PREVIEW_LIMIT)}
                {content.length > PREVIEW_LIMIT ? '\n…' : ''}
              </pre>
            </div>
          </div>
        )}

        {phase === 'done' && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-10 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-green-500 text-white">
              <CheckCircle2 className="h-7 w-7" aria-hidden />
            </div>
            <div className="text-sm text-gray-700 dark:text-gray-200">
              Stored in the catalog in its original format. Use <strong>Convert to OpenAPI</strong> on
              the item when you&apos;re ready.
            </div>
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2 border-t border-gray-200 pt-3 dark:border-gray-700">
          {phase === 'done' ? (
            <Button onClick={handleClose}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose} disabled={phase === 'storing'}>
                Cancel
              </Button>
              {(phase === 'preview' || phase === 'storing') && (
                <Button onClick={handleStore} disabled={!canStore || phase === 'storing'}>
                  {phase === 'storing' ? 'Storing…' : 'Store in catalog'}
                </Button>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default CatalogImportDialog;
