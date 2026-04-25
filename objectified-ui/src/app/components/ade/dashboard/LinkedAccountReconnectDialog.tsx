'use client';

import type { ComponentType } from 'react';
import { AlertTriangle, CheckCircle2, ShieldCheck } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../ui/Dialog';
import { Button } from '../../ui/Button';
import { Alert } from '../../ui/Alert';

export interface ScopeRequirement {
  scope: string;
  purpose: string;
}

export interface ReconnectProvider {
  name: string;
  displayName: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  color: string;
}

/**
 * Required OAuth scopes per provider. Sourced from the in-product PAT
 * dialog hints + provider docs. These are the scopes the app *needs* to
 * function — not necessarily the scopes the OAuth client is currently
 * configured to request. See TODO(linked-accounts/phase5) on persisting
 * actually-granted scopes from the OAuth callback so we can render a real
 * diff instead of a one-sided "we will request" list.
 */
export const PROVIDER_REQUIRED_SCOPES: Record<string, ScopeRequirement[]> = {
  github: [
    { scope: 'repo', purpose: 'Read private repository contents during scans' },
    { scope: 'read:org', purpose: 'Discover repositories owned by your organisations' },
    { scope: 'read:user', purpose: 'Identify the signed-in user' },
    { scope: 'user:email', purpose: 'Use your verified email as the primary identifier' },
  ],
  gitlab: [
    { scope: 'read_api', purpose: 'Read project metadata and pipeline state' },
    { scope: 'read_repository', purpose: 'Read repository file trees and blobs' },
    { scope: 'read_user', purpose: 'Identify the signed-in user' },
  ],
  bitbucket: [
    { scope: 'account', purpose: 'Identify the signed-in user' },
    { scope: 'repository', purpose: 'List and read accessible repositories' },
  ],
};

export interface LinkedAccountReconnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: ReconnectProvider | null;
  /** Username or email to display in the dialog header. */
  accountHandle: string | null;
  /** Health status that triggered the reconnect, if any. Drives the banner copy. */
  healthStatus:
    | 'healthy'
    | 'scope_missing'
    | 'revoked'
    | 'network_error'
    | null
    | undefined;
  onConfirm: () => void;
  isSubmitting?: boolean;
}

function bannerForHealth(status: LinkedAccountReconnectDialogProps['healthStatus']) {
  switch (status) {
    case 'scope_missing':
      return {
        variant: 'warning' as const,
        message:
          'The last health probe reported that one or more required scopes are not granted. Reconnecting will re-request the scopes below.',
      };
    case 'revoked':
      return {
        variant: 'error' as const,
        message:
          'This token was reported as revoked by the provider. You will be sent through the OAuth flow again to issue a fresh token.',
      };
    case 'network_error':
      return {
        variant: 'warning' as const,
        message:
          "We couldn't reach the provider during the last probe. Reconnecting also acts as a manual retry.",
      };
    default:
      return null;
  }
}

/**
 * Scope-diff Reconnect dialog. Shown before kicking off the OAuth round-
 * trip so the user knows exactly what permissions the app is about to
 * request — and why.
 *
 * We don't render the *currently granted* scopes today because they aren't
 * persisted from the OAuth callback (see TODO above). Once they are, this
 * component can render a true diff (granted vs required) and dim scopes
 * already in place.
 */
export function LinkedAccountReconnectDialog({
  open,
  onOpenChange,
  provider,
  accountHandle,
  healthStatus,
  onConfirm,
  isSubmitting,
}: LinkedAccountReconnectDialogProps) {
  if (!provider) {
    // Render a closed Dialog so Radix's open/close state stays consistent
    // even when the consumer hasn't picked a provider yet.
    return <Dialog open={false} onOpenChange={onOpenChange} />;
  }

  const Icon = provider.icon;
  const scopes = PROVIDER_REQUIRED_SCOPES[provider.name] ?? [];
  const banner = bannerForHealth(healthStatus);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-md flex items-center justify-center text-white shrink-0"
              style={{ backgroundColor: provider.color }}
              aria-hidden="true"
            >
              <Icon size={18} className="text-white" />
            </div>
            <div className="min-w-0">
              <DialogTitle>Reconnect {provider.displayName}</DialogTitle>
              <DialogDescription className="font-mono text-xs">
                {accountHandle ? `@${accountHandle}` : 'No account handle on file'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {banner && <Alert variant={banner.variant}>{banner.message}</Alert>}

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
              Scopes we will request
            </p>
            {scopes.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No scope requirements are configured for this provider yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {scopes.map((scope) => (
                  <li
                    key={scope.scope}
                    className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-200"
                  >
                    <ShieldCheck className="w-4 h-4 mt-0.5 text-emerald-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-mono text-[13px] text-gray-900 dark:text-gray-100">
                        {scope.scope}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {scope.purpose}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-md border border-amber-200 dark:border-amber-700/60 bg-amber-50/60 dark:bg-amber-900/20 px-3 py-2 text-[11px] text-amber-800 dark:text-amber-200">
            <AlertTriangle className="w-3.5 h-3.5 inline-block mr-1 -mt-0.5" />
            We don&apos;t yet track the exact scopes your existing token was
            granted, so we can&apos;t show a precise diff. After reconnect, the
            health probe will report any remaining gaps.
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isSubmitting}>
            <CheckCircle2 className="w-4 h-4" />
            Continue to {provider.displayName}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
