'use client';

/**
 * MCP import source form (V2-MCP-24.1 / MCAT-10.1).
 *
 * Rendered inside the existing Import dialog when the "MCP Server" source is selected. Collects the
 * endpoint URL, transport, an optional display name, and an auth scheme with its secret fields. The
 * dialog owns the form state (so its footer "Discover" button can read it) — this panel is a
 * controlled view that reports edits through `onChange`.
 */

import { Network, ShieldCheck } from 'lucide-react';
import { Input } from '../../../components/ui/Input';
import { Label } from '../../../components/ui/Label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/Select';
import {
  MCP_AUTH_TYPE_OPTIONS,
  MCP_TRANSPORT_OPTIONS,
  type McpAuthType,
  type McpImportForm,
  type McpTransport,
} from './mcp/mcpImportFlow';

export interface McpImportPanelProps {
  form: McpImportForm;
  onChange: (form: McpImportForm) => void;
}

const fieldLabelClass = 'mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300';
const helpTextClass = 'mt-1 text-xs text-gray-500 dark:text-gray-400';

export default function McpImportPanel({ form, onChange }: McpImportPanelProps) {
  const set = <K extends keyof McpImportForm>(key: K, value: McpImportForm[K]) =>
    onChange({ ...form, [key]: value });

  const showToken = form.authType === 'bearer' || form.authType === 'oauth2' || form.authType === 'header';
  const showHeaderName = form.authType === 'header';
  const tokenLabel = form.authType === 'header' ? 'Header value' : 'Access token';

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4 dark:border-indigo-800 dark:bg-indigo-950/20">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-500 text-white">
            <Network className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Add an MCP server</h3>
            <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
              Point us at a Model Context Protocol endpoint. We&apos;ll connect, discover its tools,
              resources, and prompts, and catalog them as version&nbsp;1.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <Label htmlFor="mcp-endpoint-url" className={fieldLabelClass}>
            Endpoint URL <span className="text-red-500">*</span>
          </Label>
          <Input
            id="mcp-endpoint-url"
            type="text"
            inputMode="url"
            placeholder="https://mcp.example.com/sse"
            value={form.endpointUrl}
            onChange={(e) => set('endpointUrl', e.target.value)}
          />
          <p className={helpTextClass}>The MCP server&apos;s connection URL.</p>
        </div>

        <div>
          <Label htmlFor="mcp-transport" className={fieldLabelClass}>
            Transport
          </Label>
          <Select value={form.transport} onValueChange={(v) => set('transport', v as McpTransport)}>
            <SelectTrigger id="mcp-transport">
              <SelectValue placeholder="Select transport" />
            </SelectTrigger>
            <SelectContent>
              {MCP_TRANSPORT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="mcp-name" className={fieldLabelClass}>
            Display name
          </Label>
          <Input
            id="mcp-name"
            type="text"
            placeholder="Defaults to the URL host"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
          />
          <p className={helpTextClass}>Optional — leave blank to use the host name.</p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-indigo-600 dark:text-indigo-400" aria-hidden />
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Authentication</h4>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="mcp-auth-type" className={fieldLabelClass}>
              Auth type
            </Label>
            <Select value={form.authType} onValueChange={(v) => set('authType', v as McpAuthType)}>
              <SelectTrigger id="mcp-auth-type">
                <SelectValue placeholder="Select auth type" />
              </SelectTrigger>
              <SelectContent>
                {MCP_AUTH_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {showHeaderName && (
            <div>
              <Label htmlFor="mcp-header-name" className={fieldLabelClass}>
                Header name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="mcp-header-name"
                type="text"
                placeholder="X-API-Key"
                value={form.authHeaderName}
                onChange={(e) => set('authHeaderName', e.target.value)}
              />
            </div>
          )}

          {showToken && (
            <div className={showHeaderName ? 'md:col-span-2' : ''}>
              <Label htmlFor="mcp-auth-token" className={fieldLabelClass}>
                {tokenLabel} <span className="text-red-500">*</span>
              </Label>
              <Input
                id="mcp-auth-token"
                type="password"
                autoComplete="off"
                placeholder="••••••••"
                value={form.authToken}
                onChange={(e) => set('authToken', e.target.value)}
              />
              <p className={helpTextClass}>
                Stored encrypted; it is never shown again after you save it.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
