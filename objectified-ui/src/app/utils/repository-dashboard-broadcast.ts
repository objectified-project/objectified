/**
 * Channel name for REPO-10.3 / #2949: keep the scan report corpus stat strip in sync
 * with the rest of the ADE dashboard. REPO-11.2 reuses the same bus for
 * `repository_attention` so a scan tab can nudge the home widget without
 * re-fetching the whole app.
 */
export const REPOSITORY_DASHBOARD_BROADCAST = 'objectified:repository-corpus-refresh' as const;

type CorpusRefreshMessage = { type: 'corpus-refresh' };
type AttentionRefreshMessage = { type: 'attention-refresh' };
type DashboardWidgetMessage = CorpusRefreshMessage | AttentionRefreshMessage;

function canUseBroadcastChannel(): boolean {
  return typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined';
}

export function postRepositoryCorpusStatsRefresh(): void {
  if (!canUseBroadcastChannel()) return;
  const channel = new BroadcastChannel(REPOSITORY_DASHBOARD_BROADCAST);
  try {
    const payload: CorpusRefreshMessage = { type: 'corpus-refresh' };
    channel.postMessage(payload);
  } finally {
    channel.close();
  }
}

export function postRepositoryAttentionRefresh(): void {
  if (!canUseBroadcastChannel()) return;
  const channel = new BroadcastChannel(REPOSITORY_DASHBOARD_BROADCAST);
  try {
    const payload: AttentionRefreshMessage = { type: 'attention-refresh' };
    channel.postMessage(payload);
  } finally {
    channel.close();
  }
}

export function subscribeRepositoryCorpusStatsRefresh(onRefresh: () => void): () => void {
  return subscribeRepositoryDashboardWidgetRefresh(onRefresh);
}

export function subscribeRepositoryDashboardWidgetRefresh(onRefresh: () => void): () => void {
  if (!canUseBroadcastChannel()) {
    return () => {};
  }
  const channel = new BroadcastChannel(REPOSITORY_DASHBOARD_BROADCAST);
  channel.onmessage = (event: MessageEvent) => {
    const d = event.data as Partial<DashboardWidgetMessage> | undefined;
    if (d?.type === 'corpus-refresh' || d?.type === 'attention-refresh') {
      onRefresh();
    }
  };
  return () => {
    channel.onmessage = null;
    channel.close();
  };
}
