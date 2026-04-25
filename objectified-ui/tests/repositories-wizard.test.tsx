import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';

const mockPush = jest.fn();

jest.mock('next/dynamic', () => {
  return () => {
    const FallbackEditor = (props: { value?: string; onChange?: (value: string) => void }) => (
      <textarea
        data-testid="monaco-editor"
        value={props.value || ''}
        onChange={(event) => props.onChange?.(event.target.value)}
      />
    );
    return FallbackEditor;
  };
});

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

import RepositoriesPage from '../src/app/ade/dashboard/repositories/page';

let originalFetch: typeof global.fetch;

interface FetchHandlers {
  linkedAccounts?: Array<{
    id: string;
    provider: string;
    provider_username?: string;
    provider_email?: string;
  }>;
  ghRepos?: Array<{
    id: number;
    name: string;
    full_name: string;
    description?: string;
    default_branch?: string;
  }>;
  ghBranches?: { branches: string[]; defaultBranch: string };
  registerResponse?: {
    ok?: boolean;
    body?: Record<string, unknown>;
  };
}

function installFetchMock(handlers: FetchHandlers = {}) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    calls.push({ url, init });
    const method = (init?.method || 'GET').toUpperCase();

    if (url === '/api/repositories' && method === 'GET') {
      return {
        ok: true,
        json: async () => ({ success: true, repositories: [] }),
      } as Response;
    }
    if (url === '/api/linked-accounts' && method === 'GET') {
      return {
        ok: true,
        json: async () => ({ success: true, accounts: handlers.linkedAccounts ?? [] }),
      } as Response;
    }
    if (url.startsWith('/api/sso/github/repos') && method === 'GET') {
      return {
        ok: true,
        json: async () => ({ repositories: handlers.ghRepos ?? [] }),
      } as Response;
    }
    if (url.startsWith('/api/sso/github/branches') && method === 'GET') {
      return {
        ok: true,
        json: async () => handlers.ghBranches ?? { branches: [], defaultBranch: null },
      } as Response;
    }
    if (url === '/api/repositories' && method === 'POST') {
      const reg = handlers.registerResponse ?? {
        ok: true,
        body: {
          success: true,
          repository: {
            id: 'repo-new',
            provider: 'github',
            owner: 'acme',
            name: 'orders',
            fullName: 'acme/orders',
            status: 'scan_in_progress',
            branches: ['main'],
          },
        },
      };
      return {
        ok: reg.ok ?? true,
        json: async () => reg.body ?? {},
      } as Response;
    }
    return {
      ok: true,
      json: async () => ({}),
    } as Response;
  });

  global.fetch = fetchMock as unknown as typeof fetch;
  return { fetchMock, calls };
}

async function openWizard() {
  // Two "Add Repository" controls live on the page (toolbar + empty-state).
  // Click the first one — they both open the same dialog.
  const buttons = await screen.findAllByRole('button', { name: 'Add Repository' });
  fireEvent.click(buttons[0]);
  return waitFor(() => expect(screen.getByTestId('add-repository-wizard')).toBeInTheDocument());
}

describe('Add Repository wizard', () => {
  beforeAll(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    mockPush.mockReset();
  });

  it('walks through all four steps and submits a registration payload', async () => {
    const { calls } = installFetchMock({
      linkedAccounts: [
        {
          id: 'acct-1',
          provider: 'github',
          provider_username: 'octocat',
          provider_email: 'octocat@github.example',
        },
      ],
      ghRepos: [
        {
          id: 100,
          name: 'orders',
          full_name: 'acme/orders',
          description: 'Order intake',
          default_branch: 'main',
        },
        {
          id: 101,
          name: 'payments',
          full_name: 'acme/payments',
          description: 'Payments API',
          default_branch: 'main',
        },
      ],
      ghBranches: { branches: ['main', 'develop'], defaultBranch: 'main' },
    });

    render(<RepositoriesPage />);

    await openWizard();

    const dialog = screen.getByTestId('add-repository-wizard');

    // Step 1: badge shows "Step 1 of 4", account loads, click to select.
    expect(within(dialog).getByTestId('wizard-step-badge')).toHaveTextContent('Step 1 of 4');
    const accountButton = await within(dialog).findByText('octocat');
    fireEvent.click(accountButton);

    // Wait for the repos fetch to settle so Next isn't racing the busy state.
    await waitFor(() =>
      expect(calls.some((c) => c.url.startsWith('/api/sso/github/repos'))).toBe(true),
    );
    await waitFor(() =>
      expect(within(dialog).getByTestId('wizard-next')).not.toBeDisabled(),
    );

    // Step 1 → Step 2.
    fireEvent.click(within(dialog).getByTestId('wizard-next'));

    // Step 2: the repo cards we mocked are listed; pick acme/orders.
    await waitFor(() =>
      expect(within(dialog).getByTestId('wizard-step-badge')).toHaveTextContent('Step 2 of 4'),
    );
    expect(within(dialog).getByText('acme/orders')).toBeInTheDocument();
    expect(within(dialog).getByText('acme/payments')).toBeInTheDocument();

    // Filter the list with the search input.
    const searchInput = within(dialog).getByPlaceholderText('Search repositories...');
    fireEvent.change(searchInput, { target: { value: 'orders' } });
    expect(within(dialog).queryByText('acme/payments')).not.toBeInTheDocument();
    expect(within(dialog).getByText('acme/orders')).toBeInTheDocument();

    fireEvent.click(within(dialog).getByText('acme/orders'));

    // Step 2 → Step 3 (loads branches under the hood).
    fireEvent.click(within(dialog).getByTestId('wizard-next'));

    await waitFor(() =>
      expect(within(dialog).getByTestId('wizard-step-badge')).toHaveTextContent('Step 3 of 4'),
    );

    // Default branch (main) should appear and be auto-selected.
    expect(within(dialog).getByText('main')).toBeInTheDocument();
    expect(within(dialog).getByText('default')).toBeInTheDocument();

    // Step 3 → Step 4.
    fireEvent.click(within(dialog).getByTestId('wizard-next'));

    await waitFor(() =>
      expect(within(dialog).getByTestId('wizard-step-badge')).toHaveTextContent('Step 4 of 4'),
    );
    expect(within(dialog).getByTestId('monaco-editor')).toBeInTheDocument();

    // Submit with empty manifest (validation defaults to valid).
    fireEvent.click(within(dialog).getByTestId('wizard-submit'));

    await waitFor(() => {
      const post = calls.find(
        (c) => c.url === '/api/repositories' && (c.init?.method || 'GET') === 'POST',
      );
      expect(post).toBeDefined();
      const payload = JSON.parse(String(post!.init!.body));
      expect(payload).toEqual(
        expect.objectContaining({
          linkedAccountId: 'acct-1',
          provider: 'github',
          owner: 'acme',
          name: 'orders',
          branches: [
            expect.objectContaining({ branch: 'main', subpathGlob: '**/*' }),
          ],
        }),
      );
      expect(payload.manifest).toBeUndefined();
    });

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith('/ade/dashboard/repositories/repo-new'),
    );
  });

  it('surfaces the empty-linked-accounts prompt and routes to linked accounts on Yes', async () => {
    installFetchMock({ linkedAccounts: [] });

    render(<RepositoriesPage />);
    await openWizard();

    const dialog = screen.getByTestId('add-repository-wizard');

    await waitFor(() =>
      expect(
        within(dialog).getByText(
          'No linked accounts have been added yet. Would you like me to direct you to the linked accounts page?',
        ),
      ).toBeInTheDocument(),
    );

    // Footer is hidden on the empty-state branch — only Yes/No buttons should exist.
    expect(within(dialog).queryByTestId('wizard-next')).not.toBeInTheDocument();
    expect(within(dialog).queryByTestId('wizard-submit')).not.toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Yes' }));

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith('/ade/dashboard/linked-accounts'),
    );
  });
});
