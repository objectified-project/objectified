'use client';

import { useState } from 'react';
import { Globe, Copy, ExternalLink, QrCode, Settings, Check } from 'lucide-react';
import { toast } from 'sonner';
import {
  publishedCatalogBannerClass,
  publishedUrlBlockClass,
} from '@/app/components/ade/dashboard/dashboardScreenClasses';

export interface PublishedCatalogBannerProps {
  tenantName: string;
  /** Number of public versions, used in the descriptive line. */
  publicCount: number;
  /** Absolute URL to the tenant's public catalog. */
  catalogUrl: string;
  /** Fired when the user clicks "QR" — host page can show a real QR dialog. */
  onShowQr?: () => void;
  /** Fired when the user clicks "Catalog settings". */
  onOpenSettings?: () => void;
}

/**
 * Public-catalog banner. Sits between the page header and the KPI band
 * on the listing. The dashed indigo strip frames a tenant-level URL
 * with copy / QR / open affordances and a "Catalog settings" CTA.
 *
 * The banner only renders something useful when the tenant has at
 * least one public version — when `publicCount === 0`, the banner
 * still appears but reads as a setup prompt.
 */
export function PublishedCatalogBanner({
  tenantName,
  publicCount,
  catalogUrl,
  onShowQr,
  onOpenSettings,
}: PublishedCatalogBannerProps) {
  const [justCopied, setJustCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(catalogUrl);
      setJustCopied(true);
      toast.success('Catalog URL copied.');
      window.setTimeout(() => setJustCopied(false), 1800);
    } catch {
      toast.error('Could not copy URL to clipboard.');
    }
  };

  const handleOpen = () => {
    window.open(catalogUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <section className={`${publishedCatalogBannerClass} px-5 py-4`}>
      <div className="flex items-start gap-4 flex-wrap">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-indigo-500 flex items-center justify-center text-white shrink-0 shadow-sm">
          <Globe className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-[16rem]">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            Public catalog for {tenantName}
          </p>
          <p className="text-[12px] text-gray-600 dark:text-gray-400 mt-0.5">
            {publicCount > 0
              ? `${publicCount} public ${publicCount === 1 ? 'version is' : 'versions are'} live at this URL — no API key required.`
              : 'No public versions yet. Flip a version to public to surface it here.'}
          </p>
          <div className={`${publishedUrlBlockClass} mt-2 px-3 py-2 flex items-center gap-2 flex-wrap`}>
            <code className="font-mono text-[12px] text-indigo-700 dark:text-indigo-300 truncate flex-1 min-w-0">
              {catalogUrl}
            </code>
            <button
              type="button"
              onClick={handleCopy}
              className="h-7 px-2 rounded-md border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/40 hover:bg-white dark:hover:bg-gray-900 text-[11px] font-medium inline-flex items-center gap-1 transition-colors"
            >
              {justCopied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
              {justCopied ? 'Copied' : 'Copy'}
            </button>
            {onShowQr ? (
              <button
                type="button"
                onClick={onShowQr}
                className="h-7 px-2 rounded-md border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/40 hover:bg-white dark:hover:bg-gray-900 text-[11px] font-medium inline-flex items-center gap-1 transition-colors"
              >
                <QrCode className="w-3 h-3" /> QR
              </button>
            ) : null}
            <button
              type="button"
              onClick={handleOpen}
              className="h-7 px-2 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-medium inline-flex items-center gap-1 transition-colors"
            >
              <ExternalLink className="w-3 h-3" /> Open
            </button>
          </div>
        </div>
        {onOpenSettings ? (
          <button
            type="button"
            onClick={onOpenSettings}
            className="h-8 px-3 rounded-md border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/40 hover:bg-white dark:hover:bg-gray-900 text-xs font-medium inline-flex items-center gap-1.5 transition-colors shrink-0"
          >
            <Settings className="w-3.5 h-3.5" /> Catalog settings
          </button>
        ) : null}
      </div>
    </section>
  );
}
