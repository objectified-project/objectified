import type { McpResolveOutcome } from './types.js';

export type CreateMcpServerAuth =
  | { kind: 'none' }
  | {
      kind: 'api_key';
      getToken: () => string | undefined;
      /** Test injection point; defaults to REST `/v1/internal/api_keys/resolve`. */
      resolveInitialize?: () => Promise<McpResolveOutcome>;
    };
