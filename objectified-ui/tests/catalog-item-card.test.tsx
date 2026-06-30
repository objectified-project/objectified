/**
 * Render/interaction tests for the CatalogItemCard (MFI-23.4, #4013).
 *
 * The card is cloned from ProjectsDashboardProjectCard and must reproduce every project-card
 * affordance — gradient avatar, name, short id/slug, status badge, the clickable quality and
 * lint-grade orbs, the creator chip and the updated footer — while staying publish-free and
 * exposing a format/source pill slot (MFI-23.5). These assertions pin that contract.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

import {
  CatalogItemCard,
  type CatalogItemCardItem,
} from '../src/app/components/ade/dashboard/catalog/CatalogItemCard';
import type { ProjectQualitySnapshot } from '../src/app/utils/project-quality-score-history';

function makeItem(overrides: Partial<CatalogItemCardItem> = {}): CatalogItemCardItem {
  return {
    id: '11111111-2222-3333-4444-555555555555',
    name: 'Acme Postman Collection',
    slug: 'acme-postman',
    description: 'A non-OpenAPI import awaiting conversion.',
    enabled: true,
    deleted_at: null,
    updated_at: '2026-06-20T12:00:00.000Z',
    creator_name: 'Dana Import',
    metadata: { summary: 'Imported from Postman v2.1.' },
    qualityScore: 82,
    qualityGrade: 'B',
    ...overrides,
  };
}

function renderCard(props: Partial<React.ComponentProps<typeof CatalogItemCard>> = {}) {
  const onOpenQualityHistory = jest.fn();
  const onOpenLintReport = jest.fn();
  const onOpenDetail = jest.fn();
  const item = props.item ?? makeItem();
  render(
    <CatalogItemCard
      item={item}
      qualityHistory={props.qualityHistory ?? []}
      avatarGradientClass="from-indigo-500 to-purple-500"
      avatarInitials="AP"
      creatorInitials="DI"
      shortItemId="cat_11112"
      onOpenQualityHistory={onOpenQualityHistory}
      onOpenLintReport={onOpenLintReport}
      onOpenDetail={onOpenDetail}
      formatSlot={<span data-testid="format-slot">OpenAPI · REST</span>}
      actionsSlot={<button data-testid="actions-slot">actions</button>}
      {...props}
    />
  );
  return { onOpenQualityHistory, onOpenLintReport, onOpenDetail, item };
}

describe('CatalogItemCard — project-card affordances', () => {
  it('renders the name, short id, slug, summary, creator and format slot', () => {
    renderCard();
    expect(screen.getByText('Acme Postman Collection')).toBeInTheDocument();
    expect(screen.getByText(/cat_11112/)).toBeInTheDocument();
    expect(screen.getByText(/acme-postman/)).toBeInTheDocument();
    expect(screen.getByText('Imported from Postman v2.1.')).toBeInTheDocument();
    expect(screen.getByText('Dana Import')).toBeInTheDocument();
    expect(screen.getByText('AP')).toBeInTheDocument();
    expect(screen.getByTestId('format-slot')).toBeInTheDocument();
    expect(screen.getByTestId('actions-slot')).toBeInTheDocument();
  });

  it('shows an Active status badge for an enabled, non-deleted item', () => {
    renderCard();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('shows a Disabled badge when the item is disabled', () => {
    renderCard({ item: makeItem({ enabled: false }) });
    expect(screen.getByText('Disabled')).toBeInTheDocument();
  });

  it('shows a Deleted badge when the item is soft-deleted', () => {
    renderCard({ item: makeItem({ deleted_at: '2026-06-21T00:00:00.000Z' }) });
    expect(screen.getByText('Deleted')).toBeInTheDocument();
  });
});

describe('CatalogItemCard — quality + lint orbs', () => {
  it('renders the quality orb from the server score and opens the quality dialog', () => {
    const { onOpenQualityHistory } = renderCard();
    const orb = screen.getByTitle('Open quality score history');
    expect(orb).toHaveTextContent('82');
    fireEvent.click(orb);
    expect(onOpenQualityHistory).toHaveBeenCalledTimes(1);
  });

  it('renders the lint orb from the server grade and opens the lint report', () => {
    const { onOpenLintReport } = renderCard();
    const orb = screen.getByTitle('Open lint report');
    // 82 -> letter grade B (matches the server grade fallback).
    expect(orb).toHaveTextContent('B');
    fireEvent.click(orb);
    expect(onOpenLintReport).toHaveBeenCalledTimes(1);
  });

  it('prefers the browser-local quality history over the server score', () => {
    const history: ProjectQualitySnapshot[] = [
      { recordedAt: '2026-06-01T00:00:00.000Z', overall: 95, grade: 'A' },
    ];
    renderCard({ item: makeItem({ qualityScore: 50, qualityGrade: 'F' }), qualityHistory: history });
    expect(screen.getByTitle('Open quality score history')).toHaveTextContent('95');
    expect(screen.getByTitle('Open lint report')).toHaveTextContent('A');
  });

  it('renders dash orbs (no buttons) when there is no score at all', () => {
    renderCard({ item: makeItem({ qualityScore: null, qualityGrade: null }), qualityHistory: [] });
    expect(screen.queryByTitle('Open quality score history')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Open lint report')).not.toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2);
  });
});

describe('CatalogItemCard — navigation', () => {
  it('opens the detail view when the card body is clicked for a live item', () => {
    const { onOpenDetail } = renderCard();
    fireEvent.click(screen.getByText('Acme Postman Collection'));
    expect(onOpenDetail).toHaveBeenCalledTimes(1);
  });

  it('does not navigate when a deleted card body is clicked', () => {
    const { onOpenDetail } = renderCard({ item: makeItem({ deleted_at: '2026-06-21T00:00:00.000Z' }) });
    fireEvent.click(screen.getByText('Acme Postman Collection'));
    expect(onOpenDetail).not.toHaveBeenCalled();
  });
});

describe('CatalogItemCard — no publish affordance', () => {
  it('never renders a Publish control (the non-publishable invariant, MFI-23.1)', () => {
    renderCard();
    expect(screen.queryByText(/publish/i)).not.toBeInTheDocument();
  });
});
