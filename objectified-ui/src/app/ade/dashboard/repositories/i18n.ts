export type RepositoriesLocale = 'en';

export interface RepositoriesI18nBundle {
  pageTitle: string;
  pageSubtitle: string;
  addRepositoryButton: string;
  searchPlaceholder: string;
  providerAll: string;
  statusAll: string;
  emptyTitle: string;
  emptyDescription: string;
  tableRepo: string;
  tableProvider: string;
  tableBranches: string;
  tableStatus: string;
  wizardTitle: string;
  wizardDescription: string;
  wizardBack: string;
  wizardNext: string;
  wizardCancel: string;
  wizardSubmit: string;
  stepAccountTitle: string;
  stepRepoTitle: string;
  stepBranchesTitle: string;
  stepManifestTitle: string;
  defaultBranchLabel: string;
  addBranchPatternLabel: string;
  addPatternButton: string;
  branchPatternPlaceholder: string;
  pollIntervalPlaceholder: string;
  removeButton: string;
  availableBranchesLabel: string;
  saveBranchesButton: string;
  savingButton: string;
  accountRequired: string;
  repoRequired: string;
  branchesRequired: string;
  successMessage: string;
  branchesUpdatedMessage: string;
  scanTimelineMessage: string;
  loadingRepositories: string;
  loadingRepository: string;
  viewButton: string;
  backButton: string;
  providerLabel: string;
  statusLabel: string;
  branchesLabel: string;
  timelineLabel: string;
  branchSubpathPlaceholder: string;
  manifestPlaceholder: string;
  noLinkedAccountsQuestion: string;
  yesButton: string;
  noButton: string;
  ownerPlaceholder: string;
  namePlaceholder: string;
  ownerNameRequired: string;
  settingsUpdatedMessage: string;
  repositoryDisabledMessage: string;
  repositoryEnabledMessage: string;
  saveSettingsButton: string;
  enableButton: string;
  disableButton: string;
  deleteButton: string;
  deleteDialogTitle: string;
  deleteDialogDescriptionPrefix: string;
  deleteDialogDescriptionSuffix: string;
  cancelButton: string;
  deleteRepositoryButton: string;
  ownerNameFallbackPlaceholder: string;
}

export const repositoriesI18n: Record<RepositoriesLocale, RepositoriesI18nBundle> = {
  en: {
    pageTitle: 'Repositories',
    pageSubtitle: 'Register and monitor connected source repositories.',
    addRepositoryButton: 'Add Repository',
    searchPlaceholder: 'Search repositories...',
    providerAll: 'All providers',
    statusAll: 'All statuses',
    emptyTitle: 'No repositories yet',
    emptyDescription: 'Register a repository to start scan and sync workflows.',
    tableRepo: 'Repository',
    tableProvider: 'Provider',
    tableBranches: 'Branches',
    tableStatus: 'Status',
    wizardTitle: 'Add Repository',
    wizardDescription: 'Connect a repository and kick off an initial scan.',
    wizardBack: 'Back',
    wizardNext: 'Next',
    wizardCancel: 'Cancel',
    wizardSubmit: 'Register repository',
    stepAccountTitle: 'Step 1: Pick linked account',
    stepRepoTitle: 'Step 2: Search and pick repository',
    stepBranchesTitle: 'Step 3: Select branches and subpath',
    stepManifestTitle: 'Step 4: Optional manifest upload',
    defaultBranchLabel: 'Default branch',
    addBranchPatternLabel: 'Track branch pattern',
    addPatternButton: 'Add pattern',
    branchPatternPlaceholder: 'release/*',
    pollIntervalPlaceholder: 'Poll interval seconds (optional)',
    removeButton: 'Remove',
    availableBranchesLabel: 'Available branches',
    saveBranchesButton: 'Save branches',
    savingButton: 'Saving...',
    accountRequired: 'Select a linked account before continuing.',
    repoRequired: 'Select a repository before continuing.',
    branchesRequired: 'Select at least one branch.',
    successMessage: 'Repository registered. Initial scan started.',
    branchesUpdatedMessage: 'Repository branches updated.',
    scanTimelineMessage: 'Scan in progress...',
    loadingRepositories: 'Loading repositories...',
    loadingRepository: 'Loading repository...',
    viewButton: 'View',
    backButton: 'Back',
    providerLabel: 'Provider',
    statusLabel: 'Status',
    branchesLabel: 'Branches',
    timelineLabel: 'Timeline',
    branchSubpathPlaceholder: 'Optional subpath glob (e.g. specs/**)',
    manifestPlaceholder: '.objectified/repo.yaml contents',
    noLinkedAccountsQuestion:
      'No linked accounts have been added yet. Would you like me to direct you to the linked accounts page?',
    yesButton: 'Yes',
    noButton: 'No',
    ownerPlaceholder: 'Repository owner',
    namePlaceholder: 'Repository name',
    ownerNameRequired: 'Owner and repository name are required.',
    settingsUpdatedMessage: 'Repository settings updated.',
    repositoryDisabledMessage: 'Repository disabled.',
    repositoryEnabledMessage: 'Repository enabled.',
    saveSettingsButton: 'Save repository settings',
    enableButton: 'Enable',
    disableButton: 'Disable',
    deleteButton: 'Delete',
    deleteDialogTitle: 'Delete repository',
    deleteDialogDescriptionPrefix: 'Type',
    deleteDialogDescriptionSuffix: 'to confirm permanent deletion.',
    cancelButton: 'Cancel',
    deleteRepositoryButton: 'Delete repository',
    ownerNameFallbackPlaceholder: 'owner/name',
  },
};

export function getRepositoriesI18nBundle(locale: string | undefined): RepositoriesI18nBundle {
  if (locale && locale.toLowerCase().startsWith('en')) {
    return repositoriesI18n.en;
  }
  return repositoriesI18n.en;
}
