/**
 * Studio header draft lock chip (#2585).
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import { DraftLockHeaderChip } from '../src/app/ade/studio/components/DraftLockHeaderChip';

describe('DraftLockHeaderChip', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders nothing when revision is published (no polling)', () => {
    global.fetch = jest.fn();
    const { container } = render(
      <DraftLockHeaderChip projectId="p1" versionId="v1" published sessionUserId="u1" />
    );
    expect(container.firstChild).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('shows lock chip when API reports an active draft lock', async () => {
    const exp = new Date(Date.now() + 5 * 60_000).toISOString();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          status: { active: true, ownerUserId: 'u1', expiresAt: exp },
        }),
    });

    render(
      <DraftLockHeaderChip projectId="p1" versionId="v1" published={false} sessionUserId="u1" />
    );

    await waitFor(() => {
      expect(screen.getByTestId('studio-draft-lock-chip')).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/versions/v1/draft-lock?projectId=p1')
    );
    expect(screen.getByText(/Lock/)).toBeInTheDocument();
    expect(screen.getByText(/You/)).toBeInTheDocument();
  });
});
