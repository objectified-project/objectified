/**
 * Render/interaction tests for the inline versions timeline (MFI-25.7, #4092).
 *
 * The Versions tab must fetch the shared `/api/versions` list, render it newest-first with a checkbox
 * per revision, enable "Diff" only when exactly two are ticked, and route to the existing versions
 * dashboard with both revisions preselected (older → compareBase, newer → compareHead). The off-page
 * "Open version history" link is retained as a fallback. These assertions pin that contract plus the
 * loading / error / empty degradations.
 */

import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

import { CatalogVersionsPanel } from '../src/app/components/ade/dashboard/catalog/CatalogVersionsPanel';

const ITEM_ID = '11111111-2222-3333-4444-555555555555';

const VERSIONS = [
  {
    id: 'rev-old',
    version_id: '1.0.0',
    created_at: '2026-01-01T00:00:00.000Z',
    shortMessage: 'Initial import',
    published: true,
    creator_name: 'Dana Import',
  },
  {
    id: 'rev-mid',
    version_id: '1.1.0',
    created_at: '2026-02-01T00:00:00.000Z',
    shortMessage: 'Add pagination',
    lifecycle: 'beta',
  },
  {
    id: 'rev-new',
    version_id: '1.2.0',
    created_at: '2026-03-01T00:00:00.000Z',
    shortMessage: 'Deprecate v1 fields',
  },
];

function mockVersionsFetch(versions: unknown, ok = true) {
  global.fetch = jest.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    json: async () => (ok ? { success: true, versions } : { success: false, error: 'boom' }),
  }) as unknown as typeof fetch;
}

afterEach(() => {
  jest.clearAllMocks();
});

describe('CatalogVersionsPanel', () => {
  it('does not fetch until the tab is active (lazy)', async () => {
    mockVersionsFetch(VERSIONS);
    render(<CatalogVersionsPanel itemId={ITEM_ID} active={false} />);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(screen.getByTestId('catalog-versions-loading')).toBeInTheDocument();
  });

  it('renders revisions newest-first once active', async () => {
    mockVersionsFetch(VERSIONS);
    render(<CatalogVersionsPanel itemId={ITEM_ID} active />);

    await screen.findByTestId('catalog-versions-timeline');
    expect(global.fetch).toHaveBeenCalledWith(
      `/api/versions?projectId=${encodeURIComponent(ITEM_ID)}`,
      expect.objectContaining({ method: 'GET' }),
    );
    const rows = screen.getAllByTestId('catalog-versions-row');
    expect(rows.map((r) => r.getAttribute('data-revision-id'))).toEqual([
      'rev-new',
      'rev-mid',
      'rev-old',
    ]);
    // Published + lifecycle chips render.
    expect(within(rows[2]).getByText(/Published/i)).toBeInTheDocument();
    expect(within(rows[1]).getByText('beta')).toBeInTheDocument();
  });

  it('enables Diff only when exactly two revisions are selected, then routes with both preselected', async () => {
    mockVersionsFetch(VERSIONS);
    render(<CatalogVersionsPanel itemId={ITEM_ID} active />);

    await screen.findByTestId('catalog-versions-timeline');
    const diff = screen.getByTestId('catalog-detail-versions-diff');
    expect(diff).toBeDisabled();

    const checkboxes = screen.getAllByTestId('catalog-versions-checkbox');
    // Order is newest-first: [rev-new, rev-mid, rev-old].
    fireEvent.click(checkboxes[0]); // rev-new
    expect(diff).toBeDisabled();
    fireEvent.click(checkboxes[2]); // rev-old
    expect(diff).toBeEnabled();

    fireEvent.click(diff);
    // Older (rev-old) → base, newer (rev-new) → head, regardless of tick order.
    expect(mockPush).toHaveBeenCalledWith(
      `/ade/dashboard/versions?projectId=${encodeURIComponent(ITEM_ID)}&compareOpen=1&compareBase=rev-old&compareHead=rev-new`,
    );
  });

  it('caps selection at two by disabling the remaining checkboxes', async () => {
    mockVersionsFetch(VERSIONS);
    render(<CatalogVersionsPanel itemId={ITEM_ID} active />);

    await screen.findByTestId('catalog-versions-timeline');
    const checkboxes = screen.getAllByTestId('catalog-versions-checkbox');
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);
    // The third, unticked checkbox is disabled once two are chosen.
    expect(checkboxes[2]).toBeDisabled();
    // Unticking one re-enables it.
    fireEvent.click(checkboxes[1]);
    expect(checkboxes[2]).toBeEnabled();
  });

  it('keeps the off-page history link as a fallback', async () => {
    mockVersionsFetch(VERSIONS);
    render(<CatalogVersionsPanel itemId={ITEM_ID} active />);

    const link = await screen.findByTestId('catalog-detail-versions-link');
    fireEvent.click(link);
    expect(mockPush).toHaveBeenCalledWith(
      `/ade/dashboard/versions?projectId=${encodeURIComponent(ITEM_ID)}`,
    );
  });

  it('shows an empty state when there are no revisions', async () => {
    mockVersionsFetch([]);
    render(<CatalogVersionsPanel itemId={ITEM_ID} active />);
    expect(await screen.findByTestId('catalog-versions-empty')).toBeInTheDocument();
  });

  it('surfaces a retryable error when the fetch fails', async () => {
    mockVersionsFetch(null, false);
    render(<CatalogVersionsPanel itemId={ITEM_ID} active />);

    expect(await screen.findByTestId('catalog-versions-error')).toBeInTheDocument();

    // Retry re-fetches, this time succeeding.
    mockVersionsFetch(VERSIONS);
    fireEvent.click(screen.getByTestId('catalog-versions-retry'));
    await waitFor(() => expect(screen.getByTestId('catalog-versions-timeline')).toBeInTheDocument());
  });
});
