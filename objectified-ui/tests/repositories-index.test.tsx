import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const RepositoriesPage = require('../src/app/ade/dashboard/repositories/page').default as React.ComponentType;

type RepoRow = {
  id: string;
  provider: string;
  owner: string;
  name: string;
  fullName: string;
  status: string;
  branches: string[];
  lastScanAt?: string | null;
};

function setupFetchMock(repositories: RepoRow[]) {
  const fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = (init?.method || 'GET').toUpperCase();

    if (url === '/api/repositories' && method === 'GET') {
      return {
        ok: true,
        json: async () => ({ success: true, repositories }),
      } as Response;
    }
    if (url.endsWith('/scans') && method === 'POST') {
      return {
        ok: true,
        json: async () => ({ success: true, scan: { id: 'scan-1' } }),
      } as Response;
    }
    if (url.endsWith('/archive') && method === 'POST') {
      return {
        ok: true,
        json: async () => ({ success: true, repository: { id: 'repo-1', status: 'archived' } }),
      } as Response;
    }
    return {
      ok: true,
      json: async () => ({ success: true, repositories }),
    } as Response;
  });

  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

describe('Repositories index page', () => {
  beforeEach(() => {
    mockPush.mockReset();
  });

  it('filters repositories by provider and status', async () => {
    setupFetchMock([
      {
        id: 'repo-1',
        provider: 'github',
        owner: 'acme',
        name: 'orders',
        fullName: 'acme/orders',
        status: 'healthy',
        branches: ['main'],
        lastScanAt: '2026-04-24T14:00:00Z',
      },
      {
        id: 'repo-2',
        provider: 'gitlab',
        owner: 'acme',
        name: 'billing',
        fullName: 'acme/billing',
        status: 'archived',
        branches: ['main'],
        lastScanAt: '2026-04-24T13:00:00Z',
      },
    ]);

    render(<RepositoriesPage />);

    await waitFor(() => expect(screen.getByText('acme/orders')).toBeInTheDocument());
    expect(screen.getByText('acme/billing')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Provider'), { target: { value: 'github' } });
    await waitFor(() => expect(screen.queryByText('acme/billing')).not.toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'healthy' } });
    expect(screen.getByText('acme/orders')).toBeInTheDocument();
  });

  it('triggers quick actions for scan and pause', async () => {
    const fetchMock = setupFetchMock([
      {
        id: 'repo-1',
        provider: 'github',
        owner: 'acme',
        name: 'orders',
        fullName: 'acme/orders',
        status: 'healthy',
        branches: ['main'],
        lastScanAt: '2026-04-24T14:00:00Z',
      },
    ]);

    render(<RepositoriesPage />);
    await waitFor(() => expect(screen.getByText('acme/orders')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Scan now' }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/repositories/repo-1/scans',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ branch: 'main', force: true }),
        })
      )
    );

    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/repositories/repo-1/archive',
        expect.objectContaining({ method: 'POST' })
      )
    );
  });
});
