'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  AlertTriangle,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  FileCode,
  GitBranch,
  Info,
  Link as LinkIcon,
  Loader2,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { SiGithub } from 'react-icons/si';
import { Button } from '@/app/components/ui/Button';
import { Input } from '@/app/components/ui/Input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/app/components/ui/Dialog';
import { repositoryHeaderIconTileClass } from '@/app/components/ade/dashboard/dashboardScreenClasses';
import { repositoryManifestSchema } from '@/lib/repositoryManifestSchema';
import type { RepositoriesI18nBundle } from '@/app/ade/dashboard/repositories/i18n';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

const TOTAL_STEPS = 4;

export interface WizardLinkedAccount {
  id: string;
  provider: string;
  provider_username?: string;
  provider_email?: string;
}

export interface WizardRepoSummary {
  id: number;
  name: string;
  full_name: string;
  description?: string | null;
  default_branch?: string;
}

export interface WizardBranchItem {
  branch: string;
  subpathGlob: string;
  pollIntervalSec?: number;
}

export interface RegisteredRepositoryResult {
  id: string;
  provider: string;
  owner: string;
  name: string;
  fullName: string;
  status: string;
  branches: string[];
  lastScanAt?: string | null;
  lastScanDurationMs?: number | null;
  lastScanBranch?: string | null;
}

export interface RepositoryWizardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  copy: RepositoriesI18nBundle;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
  onRepositoryRegistered: (repository: RegisteredRepositoryResult) => void;
  onNavigateToLinkedAccounts: () => void;
}

interface ManifestValidationState {
  valid: boolean;
  errors: string[];
}

function formatStepBadge(template: string, current: number, total: number): string {
  return template.replace('{current}', String(current)).replace('{total}', String(total));
}

function formatReposCount(template: string, count: number): string {
  return template.replace('{count}', String(count));
}

export function RepositoryWizardDialog({
  open,
  onOpenChange,
  copy,
  onError,
  onSuccess,
  onRepositoryRegistered,
  onNavigateToLinkedAccounts,
}: RepositoryWizardDialogProps) {
  const [step, setStep] = useState(0);
  const [linkedAccounts, setLinkedAccounts] = useState<WizardLinkedAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<WizardLinkedAccount | null>(null);
  const [githubRepos, setGithubRepos] = useState<WizardRepoSummary[]>([]);
  const [repoSearch, setRepoSearch] = useState('');
  const [selectedRepo, setSelectedRepo] = useState<WizardRepoSummary | null>(null);
  const [branches, setBranches] = useState<string[]>([]);
  const [selectedBranches, setSelectedBranches] = useState<WizardBranchItem[]>([]);
  const [customBranchPattern, setCustomBranchPattern] = useState('');
  const [manifest, setManifest] = useState('');
  const [manifestValidation, setManifestValidation] = useState<ManifestValidationState>({
    valid: true,
    errors: [],
  });
  const [isBusy, setIsBusy] = useState(false);
  const [busyMessage, setBusyMessage] = useState('');
  const [localError, setLocalError] = useState('');
  const [defaultBranchHint, setDefaultBranchHint] = useState<string | null>(null);

  const showError = (message: string) => {
    setLocalError(message);
    onError(message);
  };

  const clearError = () => {
    if (localError) setLocalError('');
    onError('');
  };

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setSelectedAccount(null);
    setSelectedRepo(null);
    setGithubRepos([]);
    setBranches([]);
    setSelectedBranches([]);
    setCustomBranchPattern('');
    setManifest('');
    setManifestValidation({ valid: true, errors: [] });
    setRepoSearch('');
    setLocalError('');
    setDefaultBranchHint(null);
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/linked-accounts');
        const data = await response.json();
        if (cancelled) return;
        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Failed to load linked accounts');
        }
        const accounts = (data.accounts || []).filter(
          (account: WizardLinkedAccount) => account.provider === 'github',
        );
        setLinkedAccounts(accounts);
      } catch {
        if (!cancelled) {
          setLinkedAccounts([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    const source = manifest.trim();
    if (!source) {
      setManifestValidation({ valid: true, errors: [] });
      return;
    }
    let cancelled = false;
    Promise.all([import('ajv/dist/2020'), import('yaml')])
      .then(([{ default: Ajv2020 }, { parse: parseYaml }]) => {
        if (cancelled) return;
        const ajv = new Ajv2020({ allErrors: true, strict: false });
        const validate = ajv.compile(repositoryManifestSchema);
        try {
          const parsed = parseYaml(source);
          const valid = validate(parsed);
          if (cancelled) return;
          if (valid) {
            setManifestValidation({ valid: true, errors: [] });
          } else {
            const errors = (validate.errors ?? []).map(
              (err) => `${err.instancePath || '/'}: ${err.message ?? 'Invalid'}`,
            );
            setManifestValidation({ valid: false, errors });
          }
        } catch (err) {
          if (cancelled) return;
          setManifestValidation({
            valid: false,
            errors: [err instanceof Error ? err.message : 'Invalid YAML'],
          });
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setManifestValidation({
          valid: false,
          errors: [err instanceof Error ? err.message : 'Invalid YAML'],
        });
      });
    return () => {
      cancelled = true;
    };
  }, [manifest]);

  const loadReposForAccount = async (account: WizardLinkedAccount) => {
    setSelectedAccount(account);
    setSelectedRepo(null);
    setBranches([]);
    setSelectedBranches([]);
    setCustomBranchPattern('');
    setIsBusy(true);
    setBusyMessage(copy.refreshingRepositoriesMessage);
    clearError();
    try {
      const response = await fetch(`/api/sso/github/repos?accountId=${encodeURIComponent(account.id)}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load repositories');
      }
      setGithubRepos(data.repositories || []);
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to load repositories');
    } finally {
      setIsBusy(false);
      setBusyMessage('');
    }
  };

  const loadBranchesForRepo = async (repo: WizardRepoSummary): Promise<boolean> => {
    if (!selectedAccount) return false;
    setIsBusy(true);
    setBusyMessage(copy.refreshingRepositoryDataMessage);
    try {
      const response = await fetch(
        `/api/sso/github/branches?accountId=${encodeURIComponent(selectedAccount.id)}&repo=${encodeURIComponent(repo.full_name)}`,
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load branches');
      }
      const availableBranches = Array.isArray(data.branches) ? data.branches : [];
      const defaultBranchName =
        (typeof data.defaultBranch === 'string' && data.defaultBranch) ||
        repo.default_branch ||
        null;
      const defaultBranch =
        defaultBranchName && availableBranches.includes(defaultBranchName)
          ? [{ branch: defaultBranchName, subpathGlob: '**/*' }]
          : [];
      setBranches(availableBranches);
      setSelectedBranches(defaultBranch);
      setDefaultBranchHint(defaultBranchName);
      return true;
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to load branches');
      return false;
    } finally {
      setIsBusy(false);
      setBusyMessage('');
    }
  };

  const filteredSourceRepos = useMemo(() => {
    const q = repoSearch.trim().toLowerCase();
    if (!q) return githubRepos;
    return githubRepos.filter(
      (repo) =>
        repo.name.toLowerCase().includes(q) ||
        (repo.description || '').toLowerCase().includes(q),
    );
  }, [githubRepos, repoSearch]);

  const toggleBranch = (branchName: string) => {
    setSelectedBranches((prev) => {
      const exists = prev.some((entry) => entry.branch === branchName);
      if (exists) {
        return prev.filter((entry) => entry.branch !== branchName);
      }
      return [...prev, { branch: branchName, subpathGlob: '**/*' }];
    });
  };

  const updateSubpath = (branchName: string, value: string) => {
    setSelectedBranches((prev) =>
      prev.map((entry) =>
        entry.branch === branchName ? { ...entry, subpathGlob: value } : entry,
      ),
    );
  };

  const updatePollInterval = (branchName: string, value: string) => {
    const next = Number.parseInt(value, 10);
    setSelectedBranches((prev) =>
      prev.map((entry) =>
        entry.branch === branchName
          ? { ...entry, pollIntervalSec: Number.isFinite(next) ? next : undefined }
          : entry,
      ),
    );
  };

  const addCustomBranch = () => {
    const branchPattern = customBranchPattern.trim();
    if (!branchPattern) return;
    setSelectedBranches((prev) => {
      if (prev.some((entry) => entry.branch === branchPattern)) {
        return prev;
      }
      return [...prev, { branch: branchPattern, subpathGlob: '**/*' }];
    });
    setCustomBranchPattern('');
  };

  const goNext = async () => {
    if (step === 0 && !selectedAccount) {
      showError(copy.accountRequired);
      return;
    }
    if (step === 1 && !selectedRepo) {
      showError(copy.repoRequired);
      return;
    }
    if (step === 1 && selectedRepo) {
      const loaded = await loadBranchesForRepo(selectedRepo);
      if (!loaded) return;
    }
    if (step === 2 && selectedBranches.length === 0) {
      showError(copy.branchesRequired);
      return;
    }
    clearError();
    setStep((prev) => Math.min(prev + 1, TOTAL_STEPS - 1));
  };

  const goBack = () => {
    clearError();
    setStep((prev) => Math.max(prev - 1, 0));
  };

  const jumpToStep = (target: number) => {
    if (target >= step) return;
    clearError();
    setStep(target);
  };

  const submitRegistration = async () => {
    if (!selectedAccount || !selectedRepo || selectedBranches.length === 0) return;
    if (manifest.trim() && !manifestValidation.valid) {
      showError(copy.wizardManifestInvalidPrefix);
      return;
    }
    setIsBusy(true);
    clearError();
    try {
      const [owner, name] = selectedRepo.full_name.split('/');
      const response = await fetch('/api/repositories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          linkedAccountId: selectedAccount.id,
          provider: 'github',
          owner,
          name,
          branches: selectedBranches.map((branch) => ({
            branch: branch.branch.trim(),
            subpathGlob: branch.subpathGlob.trim() || undefined,
            pollIntervalSec: branch.pollIntervalSec,
          })),
          manifest: manifest.trim() ? manifest : undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to register repository');
      }
      const normalizedRepository: RegisteredRepositoryResult = {
        ...data.repository,
        branches: Array.isArray(data.repository?.branches)
          ? data.repository.branches
              .map((branch: string | { name?: string; branch?: string }) =>
                typeof branch === 'string' ? branch : branch?.name ?? branch?.branch,
              )
              .filter((branchName: unknown): branchName is string => typeof branchName === 'string')
          : [],
      };
      onOpenChange(false);
      onSuccess(copy.successMessage);
      onRepositoryRegistered(normalizedRepository);
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to register repository');
    } finally {
      setIsBusy(false);
    }
  };

  const showNoLinkedAccountsPrompt = step === 0 && linkedAccounts.length === 0;
  const selectedCustomBranches = selectedBranches.filter(
    (entry) => !branches.includes(entry.branch),
  );

  const stepperItems = [
    copy.wizardStepperAccount,
    copy.wizardStepperRepo,
    copy.wizardStepperBranches,
    copy.wizardStepperManifest,
  ];

  const isPrimaryDisabled = (() => {
    if (isBusy) return true;
    if (step === 0) return !selectedAccount;
    if (step === 1) return !selectedRepo;
    if (step === 2) return selectedBranches.length === 0;
    if (step === 3) return manifest.trim() !== '' && !manifestValidation.valid;
    return false;
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-3xl sm:max-w-3xl max-h-[88vh] overflow-hidden p-0 gap-0"
        data-testid="add-repository-wizard"
      >
        {/* ===== Header band ===== */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="flex items-start gap-3">
            <span className={`${repositoryHeaderIconTileClass} flex-shrink-0`} aria-hidden="true">
              <Plus className="w-5 h-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <DialogTitle className="text-lg font-bold leading-tight">
                  {copy.wizardTitle}
                </DialogTitle>
                <span
                  className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
                  data-testid="wizard-step-badge"
                >
                  {formatStepBadge(copy.wizardStepBadgeFormat, step + 1, TOTAL_STEPS)}
                </span>
              </div>
              <DialogDescription className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {copy.wizardDescription}
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* ===== Stepper rail ===== */}
        <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <ol className="flex items-center gap-2 text-xs">
            {stepperItems.map((label, index) => {
              const isActive = index === step;
              const isComplete = index < step;
              const canJump = index < step;
              const circleClass = isActive
                ? 'w-6 h-6 rounded-full bg-indigo-500 text-white flex items-center justify-center text-[11px] font-semibold font-mono'
                : isComplete
                  ? 'w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center'
                  : 'w-6 h-6 rounded-full border-2 border-gray-300 dark:border-gray-600 flex items-center justify-center text-[11px] font-semibold font-mono text-gray-500';
              const labelClass = isActive
                ? 'font-medium'
                : isComplete
                  ? 'text-gray-700 dark:text-gray-300'
                  : 'text-gray-500';
              return (
                <li key={label} className="flex items-center gap-2">
                  {canJump ? (
                    <button
                      type="button"
                      onClick={() => jumpToStep(index)}
                      className="flex items-center gap-2 hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
                      aria-label={`Go back to step ${index + 1}: ${label}`}
                    >
                      <span className={circleClass} aria-hidden="true">
                        <Check className="w-3.5 h-3.5" />
                      </span>
                      <span className={labelClass}>{label}</span>
                    </button>
                  ) : (
                    <>
                      <span className={circleClass} aria-current={isActive ? 'step' : undefined}>
                        {isComplete ? <Check className="w-3.5 h-3.5" /> : index + 1}
                      </span>
                      <span className={labelClass}>{label}</span>
                    </>
                  )}
                  {index < stepperItems.length - 1 ? (
                    <span
                      className="flex-1 min-w-4 h-px bg-gray-200 dark:bg-gray-700 mx-1"
                      aria-hidden="true"
                    />
                  ) : null}
                </li>
              );
            })}
          </ol>
        </div>

        {/* ===== Body ===== */}
        <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {isBusy && busyMessage ? (
            <div className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-700 dark:border-indigo-700/40 dark:bg-indigo-900/20 dark:text-indigo-200 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              {busyMessage}
            </div>
          ) : null}
          {localError ? (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-700/40 dark:bg-rose-900/20 dark:text-rose-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{localError}</span>
            </div>
          ) : null}

          {step === 0 && (
            <StepAccount
              copy={copy}
              linkedAccounts={linkedAccounts}
              selectedAccount={selectedAccount}
              repoCountForSelected={selectedAccount ? githubRepos.length : null}
              showNoLinkedAccountsPrompt={showNoLinkedAccountsPrompt}
              onSelectAccount={(account) => void loadReposForAccount(account)}
              onYesNoLinkedAccounts={() => {
                onOpenChange(false);
                onNavigateToLinkedAccounts();
              }}
              onNoNoLinkedAccounts={() => onOpenChange(false)}
            />
          )}

          {step === 1 && (
            <StepRepo
              copy={copy}
              repoSearch={repoSearch}
              onRepoSearchChange={setRepoSearch}
              filteredRepos={filteredSourceRepos}
              selectedRepo={selectedRepo}
              onSelectRepo={(repo) => {
                setSelectedRepo(repo);
                setBranches([]);
                setSelectedBranches([]);
                clearError();
              }}
              hasAnyRepos={githubRepos.length > 0}
            />
          )}

          {step === 2 && (
            <StepBranches
              copy={copy}
              branches={branches}
              defaultBranchHint={defaultBranchHint}
              selectedBranches={selectedBranches}
              selectedCustomBranches={selectedCustomBranches}
              customBranchPattern={customBranchPattern}
              onCustomBranchPatternChange={setCustomBranchPattern}
              onAddCustomBranch={addCustomBranch}
              onToggleBranch={toggleBranch}
              onUpdateSubpath={updateSubpath}
              onUpdatePollInterval={updatePollInterval}
            />
          )}

          {step === 3 && (
            <StepManifest
              copy={copy}
              manifest={manifest}
              onManifestChange={setManifest}
              validation={manifestValidation}
            />
          )}
        </div>

        {/* ===== Footer band ===== */}
        {!showNoLinkedAccountsPrompt ? (
          <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex items-center justify-between gap-3">
            <p className="text-[11px] text-gray-500 font-mono hidden sm:block">
              {copy.wizardFooterEyebrow}
            </p>
            <div className="flex items-center gap-2 ml-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={isBusy}
              >
                {copy.wizardCancel}
              </Button>
              {step > 0 ? (
                <Button variant="outline" size="sm" onClick={goBack} disabled={isBusy}>
                  {copy.wizardBack}
                </Button>
              ) : null}
              {step < TOTAL_STEPS - 1 ? (
                <Button
                  size="sm"
                  onClick={() => void goNext()}
                  disabled={isPrimaryDisabled}
                  data-testid="wizard-next"
                >
                  {isBusy ? copy.refreshingButton : copy.wizardNext}
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => void submitRegistration()}
                  disabled={isPrimaryDisabled}
                  data-testid="wizard-submit"
                >
                  <Check className="w-4 h-4 mr-1.5" />
                  {copy.wizardSubmit}
                </Button>
              )}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

// ============================== Step 1: Linked account ==============================

interface StepAccountProps {
  copy: RepositoriesI18nBundle;
  linkedAccounts: WizardLinkedAccount[];
  selectedAccount: WizardLinkedAccount | null;
  repoCountForSelected: number | null;
  showNoLinkedAccountsPrompt: boolean;
  onSelectAccount: (account: WizardLinkedAccount) => void;
  onYesNoLinkedAccounts: () => void;
  onNoNoLinkedAccounts: () => void;
}

function StepAccount({
  copy,
  linkedAccounts,
  selectedAccount,
  repoCountForSelected,
  showNoLinkedAccountsPrompt,
  onSelectAccount,
  onYesNoLinkedAccounts,
  onNoNoLinkedAccounts,
}: StepAccountProps) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1">
        {formatStepBadge(copy.wizardStepBadgeFormat, 1, TOTAL_STEPS)}
      </p>
      <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
        <LinkIcon className="w-4 h-4 text-indigo-500" />
        {copy.stepAccountTitle}
      </h4>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{copy.wizardAccountListHint}</p>
      <div className="space-y-2">
        {linkedAccounts.map((account) => {
          const isSelected = selectedAccount?.id === account.id;
          const username = account.provider_username || account.provider_email || account.id;
          const eyebrowParts = [account.provider];
          if (account.provider_email) eyebrowParts.push(account.provider_email);
          if (isSelected && repoCountForSelected != null) {
            eyebrowParts.push(formatReposCount(copy.wizardAccountReposCountFormat, repoCountForSelected));
          }
          return (
            <button
              key={account.id}
              type="button"
              onClick={() => onSelectAccount(account)}
              className={`w-full rounded-lg border px-3 py-2.5 text-left flex items-center gap-3 transition-colors ${
                isSelected
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30'
                  : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/40'
              }`}
              aria-pressed={isSelected}
            >
              <SiGithub
                className={`w-5 h-5 ${isSelected ? 'text-indigo-500' : 'text-gray-500 dark:text-gray-400'}`}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium font-mono truncate">{username}</p>
                <p className="text-[11px] text-gray-500 font-mono truncate">{eyebrowParts.join(' · ')}</p>
              </div>
              {isSelected ? <CheckCircle2 className="w-4 h-4 text-indigo-500" /> : null}
            </button>
          );
        })}
      </div>
      {showNoLinkedAccountsPrompt ? (
        <div className="mt-3 rounded-lg border border-dashed border-gray-300 dark:border-gray-700 p-4 text-sm">
          <p className="text-gray-600 dark:text-gray-300">{copy.noLinkedAccountsQuestion}</p>
          <div className="flex items-center gap-2 mt-3">
            <Button type="button" size="sm" onClick={onYesNoLinkedAccounts}>
              {copy.yesButton}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={onNoNoLinkedAccounts}>
              {copy.noButton}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ============================== Step 2: Pick repository ==============================

interface StepRepoProps {
  copy: RepositoriesI18nBundle;
  repoSearch: string;
  onRepoSearchChange: (value: string) => void;
  filteredRepos: WizardRepoSummary[];
  selectedRepo: WizardRepoSummary | null;
  onSelectRepo: (repo: WizardRepoSummary) => void;
  hasAnyRepos: boolean;
}

function StepRepo({
  copy,
  repoSearch,
  onRepoSearchChange,
  filteredRepos,
  selectedRepo,
  onSelectRepo,
  hasAnyRepos,
}: StepRepoProps) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1">
        {formatStepBadge(copy.wizardStepBadgeFormat, 2, TOTAL_STEPS)}
      </p>
      <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <Search className="w-4 h-4 text-indigo-500" />
        {copy.stepRepoTitle}
      </h4>
      <div className="relative mb-3">
        <Search
          className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
          aria-hidden="true"
        />
        <Input
          value={repoSearch}
          onChange={(event) => onRepoSearchChange(event.target.value)}
          placeholder={copy.searchPlaceholder}
          className="pl-8"
          aria-label={copy.searchPlaceholder}
        />
      </div>
      <div className="space-y-2 max-h-72 overflow-y-auto">
        {filteredRepos.map((repo) => {
          const isSelected = selectedRepo?.id === repo.id;
          return (
            <button
              key={repo.id}
              type="button"
              onClick={() => onSelectRepo(repo)}
              className={`w-full rounded-lg border px-3 py-2.5 text-left transition-colors ${
                isSelected
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30'
                  : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/40'
              }`}
              aria-pressed={isSelected}
            >
              <div className="text-sm font-medium font-mono">{repo.full_name}</div>
              {repo.description ? (
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {repo.description}
                </div>
              ) : null}
              {repo.default_branch ? (
                <div className="text-[11px] text-gray-500 font-mono mt-1">
                  default branch: {repo.default_branch}
                </div>
              ) : null}
            </button>
          );
        })}
        {hasAnyRepos && filteredRepos.length === 0 ? (
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-4">
            {copy.wizardSearchEmpty}
          </p>
        ) : null}
      </div>
      <p className="text-[11px] text-gray-500 mt-3">{copy.repoSelectionHint}</p>
      {selectedRepo?.default_branch ? (
        <p className="text-[11px] text-gray-500 font-mono mt-1">
          {copy.defaultBranchLabel}:{' '}
          <span className="font-medium text-gray-700 dark:text-gray-300">
            {selectedRepo.default_branch}
          </span>
        </p>
      ) : null}
    </div>
  );
}

// ============================== Step 3: Branches & subpath ==============================

interface StepBranchesProps {
  copy: RepositoriesI18nBundle;
  branches: string[];
  defaultBranchHint: string | null;
  selectedBranches: WizardBranchItem[];
  selectedCustomBranches: WizardBranchItem[];
  customBranchPattern: string;
  onCustomBranchPatternChange: (value: string) => void;
  onAddCustomBranch: () => void;
  onToggleBranch: (branchName: string) => void;
  onUpdateSubpath: (branchName: string, value: string) => void;
  onUpdatePollInterval: (branchName: string, value: string) => void;
}

function StepBranches({
  copy,
  branches,
  defaultBranchHint,
  selectedBranches,
  selectedCustomBranches,
  customBranchPattern,
  onCustomBranchPatternChange,
  onAddCustomBranch,
  onToggleBranch,
  onUpdateSubpath,
  onUpdatePollInterval,
}: StepBranchesProps) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1">
        {formatStepBadge(copy.wizardStepBadgeFormat, 3, TOTAL_STEPS)}
      </p>
      <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <GitBranch className="w-4 h-4 text-indigo-500" />
        {copy.stepBranchesTitle}
      </h4>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{copy.availableBranchesLabel}</p>

      <div className="space-y-2 max-h-72 overflow-y-auto">
        {branches.map((branchName) => {
          const selected = selectedBranches.find((entry) => entry.branch === branchName);
          const isDefault = branchName === defaultBranchHint;
          const containerClass = selected
            ? 'rounded-lg border border-indigo-300 dark:border-indigo-700/60 bg-indigo-50/40 dark:bg-indigo-900/15 p-3 space-y-2'
            : 'rounded-lg border border-gray-200 dark:border-gray-700 p-3';
          return (
            <div key={branchName} className={containerClass}>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(selected)}
                  onChange={() => onToggleBranch(branchName)}
                  className="rounded border-gray-300"
                />
                <span className={selected ? 'font-medium font-mono' : 'font-mono'}>{branchName}</span>
                {isDefault ? (
                  <span className="ml-1 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                    default
                  </span>
                ) : null}
              </label>
              {selected ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <Input
                    placeholder={copy.branchSubpathPlaceholder}
                    value={selected.subpathGlob}
                    onChange={(event) => onUpdateSubpath(branchName, event.target.value)}
                    className="font-mono text-xs h-9"
                    aria-label={`Subpath glob for ${branchName}`}
                  />
                  <Input
                    type="number"
                    min={15}
                    max={86400}
                    placeholder={copy.pollIntervalPlaceholder}
                    value={selected.pollIntervalSec ?? ''}
                    onChange={(event) => onUpdatePollInterval(branchName, event.target.value)}
                    className="font-mono text-xs h-9"
                    aria-label={`Poll interval for ${branchName}`}
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="mt-3 rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-2">
        <p className="text-xs font-medium">{copy.addBranchPatternLabel}</p>
        <div className="flex items-center gap-2">
          <Input
            value={customBranchPattern}
            onChange={(event) => onCustomBranchPatternChange(event.target.value)}
            placeholder={copy.branchPatternPlaceholder}
            className="flex-1 font-mono text-xs h-9"
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                onAddCustomBranch();
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onAddCustomBranch}
            disabled={customBranchPattern.trim() === ''}
          >
            {copy.addPatternButton}
          </Button>
        </div>
        <p className="text-[11px] text-gray-500">{copy.wizardBranchPatternHint}</p>
      </div>

      {selectedCustomBranches.length > 0 ? (
        <div className="mt-3 space-y-2">
          {selectedCustomBranches.map((branch) => (
            <div
              key={branch.branch}
              className="rounded-lg border border-purple-300 dark:border-purple-700/60 bg-purple-50/40 dark:bg-purple-900/15 p-3 space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium font-mono flex items-center gap-1.5">
                  <GitBranch className="w-3.5 h-3.5 text-purple-500" />
                  {branch.branch}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onToggleBranch(branch.branch)}
                  className="text-rose-500 border-rose-200 dark:border-rose-700/40 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  {copy.removeButton}
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <Input
                  placeholder={copy.branchSubpathPlaceholder}
                  value={branch.subpathGlob}
                  onChange={(event) => onUpdateSubpath(branch.branch, event.target.value)}
                  className="font-mono text-xs h-9"
                  aria-label={`Subpath glob for ${branch.branch}`}
                />
                <Input
                  type="number"
                  min={15}
                  max={86400}
                  placeholder={copy.pollIntervalPlaceholder}
                  value={branch.pollIntervalSec ?? ''}
                  onChange={(event) => onUpdatePollInterval(branch.branch, event.target.value)}
                  className="font-mono text-xs h-9"
                  aria-label={`Poll interval for ${branch.branch}`}
                />
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ============================== Step 4: Manifest ==============================

interface StepManifestProps {
  copy: RepositoriesI18nBundle;
  manifest: string;
  onManifestChange: (value: string) => void;
  validation: ManifestValidationState;
}

function StepManifest({ copy, manifest, onManifestChange, validation }: StepManifestProps) {
  const lineCount = manifest === '' ? 0 : manifest.split('\n').length;
  const hasContent = manifest.trim() !== '';

  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1">
        {formatStepBadge(copy.wizardStepBadgeFormat, 4, TOTAL_STEPS)}
      </p>
      <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <FileCode className="w-4 h-4 text-indigo-500" />
        {copy.stepManifestTitle}
      </h4>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        {copy.wizardManifestHint.split('.objectified/repo.yaml').map((chunk, idx, arr) => (
          <span key={idx}>
            {chunk}
            {idx < arr.length - 1 ? (
              <span className="font-mono">{copy.wizardManifestFilenameLabel}</span>
            ) : null}
          </span>
        ))}
      </p>
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <MonacoEditor
          height="240px"
          language="yaml"
          value={manifest}
          onChange={(value) => onManifestChange(value ?? '')}
          options={{ minimap: { enabled: false }, fontSize: 13, scrollBeyondLastLine: false }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-gray-500 gap-2">
        <span className="font-mono">
          {hasContent
            ? `${lineCount} lines · YAML · validated client-side on Next`
            : copy.wizardManifestEmpty}
        </span>
        <a
          href="https://github.com/objectified/objectified/blob/main/objectified-rest/src/app/lib/repository_manifest_schema.py"
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-500 hover:underline inline-flex items-center gap-1 flex-shrink-0"
        >
          <BookOpen className="w-3 h-3" />
          {copy.wizardManifestSchemaLink}
        </a>
      </div>
      {hasContent ? (
        validation.valid ? (
          <div className="mt-3 rounded-md border border-emerald-200 dark:border-emerald-700/40 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 text-xs flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="w-4 h-4" />
            {copy.wizardManifestValid}
          </div>
        ) : (
          <div className="mt-3 rounded-md border border-rose-200 dark:border-rose-700/40 bg-rose-50 dark:bg-rose-900/20 px-3 py-2 text-xs text-rose-700 dark:text-rose-300 space-y-1">
            <div className="font-semibold flex items-center gap-1.5">
              <ChevronRight className="w-3 h-3" />
              {copy.wizardManifestInvalidPrefix}
            </div>
            <ul className="list-disc pl-5 space-y-0.5 font-mono">
              {validation.errors.map((err) => (
                <li key={err}>{err}</li>
              ))}
            </ul>
          </div>
        )
      ) : null}
      <div className="mt-3 rounded-md border border-indigo-200 dark:border-indigo-700/40 bg-indigo-50 dark:bg-indigo-900/20 px-3 py-2 text-xs text-indigo-700 dark:text-indigo-200 flex items-start gap-2">
        <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <span>
          If your repo already has{' '}
          <span className="font-mono">{copy.wizardManifestFilenameLabel}</span> in the default branch, the
          first scan will pick it up automatically.
        </span>
      </div>
    </div>
  );
}
