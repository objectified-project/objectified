'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import * as Switch from '@radix-ui/react-switch';
import { Code2 } from 'lucide-react';
import { useDeveloperMode } from '@/app/providers/DeveloperModeProvider';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/Dialog';
import { Button, buttonVariants } from '@/app/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/Card';
import { cn } from '@lib/utils';
import { dashboardPanelClass } from '@/app/components/ade/dashboard/dashboardScreenClasses';

type Layout = 'toolbar' | 'profile';

function DeveloperModePaywallDialog({
  open,
  onOpenChange,
  planCode,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planCode: string | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Code2 className="h-5 w-5 text-indigo-600 dark:text-indigo-400" aria-hidden />
            Developer Mode is a Pro feature
          </DialogTitle>
          <DialogDescription>
            Code-first editing, unified workspace tools, and advanced schema surfaces are included with an eligible
            plan. {planCode ? `Your current plan is ${planCode}.` : ''}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Not now
          </Button>
          <Link
            href="/ade/dashboard/profile"
            className={cn(buttonVariants({ variant: 'default', size: 'default' }))}
            onClick={() => onOpenChange(false)}
          >
            View profile & billing
          </Link>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DeveloperModePreferenceControl({ layout = 'toolbar' }: { layout?: Layout }) {
  const ctx = useDeveloperMode();
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!ctx?.signedIn) {
    return null;
  }

  const { entitled, developerModeEnabled, setDeveloperModeEnabled, planCode } = ctx;

  const onCheckedChange = async (checked: boolean) => {
    if (!entitled && checked) {
      setPaywallOpen(true);
      return;
    }
    if (!entitled) {
      return;
    }
    setSaving(true);
    try {
      await setDeveloperModeEnabled(checked);
    } finally {
      setSaving(false);
    }
  };

  const toolbarSwitch = (
    <div className="hidden items-center gap-2 sm:flex">
      <span className="whitespace-nowrap text-xs font-medium text-slate-600 dark:text-slate-300">Developer Mode</span>
      {entitled ? (
        <Switch.Root
          checked={developerModeEnabled}
          onCheckedChange={(v) => void onCheckedChange(v)}
          disabled={saving}
          aria-label="Developer Mode"
          className={cn(
            'relative h-6 w-11 shrink-0 cursor-pointer rounded-full border border-transparent bg-slate-300 outline-none transition-colors',
            'data-[state=checked]:bg-indigo-600',
            'disabled:cursor-wait disabled:opacity-60',
            'dark:bg-slate-600 dark:data-[state=checked]:bg-indigo-500'
          )}
        >
          <Switch.Thumb
            className={cn(
              'block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow transition-transform will-change-transform',
              'data-[state=checked]:translate-x-[1.375rem]'
            )}
          />
        </Switch.Root>
      ) : (
        <button
          type="button"
          onClick={() => setPaywallOpen(true)}
          className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900 transition-colors hover:bg-amber-100 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-900/30"
        >
          Pro
        </button>
      )}
    </div>
  );

  if (layout === 'toolbar') {
    return (
      <>
        {toolbarSwitch}
        <DeveloperModePaywallDialog open={paywallOpen} onOpenChange={setPaywallOpen} planCode={planCode} />
      </>
    );
  }

  return (
    <>
      <Card className={cn(dashboardPanelClass, 'shadow-none overflow-hidden')}>
        <CardHeader className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <CardTitle className="flex items-center gap-2">
            <Code2 className="h-5 w-5 text-indigo-500" />
            Developer Mode
          </CardTitle>
          <CardDescription>
            Prefer code-first editors for schemas and paths when this workspace ships the full Developer Mode
            experience.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {entitled
              ? 'Toggle code-first mode. Your choice is saved to your account and applies on every device.'
              : 'Upgrade to a Pro-eligible plan to turn on Developer Mode.'}
          </p>
          {entitled ? (
            <Switch.Root
              checked={developerModeEnabled}
              onCheckedChange={(v) => void onCheckedChange(v)}
              disabled={saving}
              aria-label="Developer Mode"
              className={cn(
                'relative h-7 w-12 shrink-0 cursor-pointer rounded-full border border-transparent bg-slate-300 outline-none transition-colors',
                'data-[state=checked]:bg-indigo-600',
                'disabled:cursor-wait disabled:opacity-60',
                'dark:bg-slate-600 dark:data-[state=checked]:bg-indigo-500'
              )}
            >
              <Switch.Thumb
                className={cn(
                  'block h-6 w-6 translate-x-0.5 rounded-full bg-white shadow transition-transform will-change-transform',
                  'data-[state=checked]:translate-x-[1.5rem]'
                )}
              />
            </Switch.Root>
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={() => setPaywallOpen(true)}>
              View Pro options
            </Button>
          )}
        </CardContent>
      </Card>
      <DeveloperModePaywallDialog open={paywallOpen} onOpenChange={setPaywallOpen} planCode={planCode} />
    </>
  );
}
