import { vi } from 'vitest';

vi.mock('../../objectified-ui/lib/db/plan-entitlements', () => ({
  getPlanBlockMessageForNewProject: vi.fn(async () => null),
  getPlanBlockMessageForNewVersion: vi.fn(async () => null),
}));
