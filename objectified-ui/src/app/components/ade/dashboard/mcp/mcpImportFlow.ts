/**
 * MCP "import source" flow — shared types & pure helpers (V2-MCP-24.1 / MCAT-10.1).
 *
 * Adding an MCP server is a new source in the existing Import dialog: the user supplies an
 * endpoint URL + transport + (optional) auth, then the dialog creates the catalog endpoint,
 * stores any credential, kicks off a discovery run, and polls it to completion — committing
 * catalog version 1 through the standard discovery/import job pipeline.
 *
 * This module holds the wire shapes and the *pure* form-validation / request-building /
 * job-interpretation helpers so they can be unit-tested without React or the network. The
 * panels (`McpImportPanel`, `McpDiscoveryPanel`) and `ImportDialog` consume them.
 */

/** Transports accepted by objectified-rest (`MCP_ENDPOINT_TRANSPORTS`). */
export type McpTransport = 'streamable_http' | 'sse' | 'stdio';

/** Auth schemes offered in the import form. `none` means no stored credential. */
export type McpAuthType = 'none' | 'bearer' | 'header' | 'oauth2';

/** Option lists for the form selects (value + human label). */
export const MCP_TRANSPORT_OPTIONS: { value: McpTransport; label: string }[] = [
  { value: 'streamable_http', label: 'Streamable HTTP' },
  { value: 'sse', label: 'Server-Sent Events (SSE)' },
  { value: 'stdio', label: 'Standard I/O (stdio)' },
];

export const MCP_AUTH_TYPE_OPTIONS: { value: McpAuthType; label: string }[] = [
  { value: 'none', label: 'None (anonymous)' },
  { value: 'bearer', label: 'Bearer token' },
  { value: 'header', label: 'Custom header' },
  { value: 'oauth2', label: 'OAuth 2.1 access token' },
];

/** The collected form state for the MCP import source. */
export interface McpImportForm {
  endpointUrl: string;
  transport: McpTransport;
  name: string;
  /** Auth scheme; when `none` no credential is stored. */
  authType: McpAuthType;
  /** Bearer/OAuth2 token, or the header value for `header`. */
  authToken: string;
  /** Header name (only used when `authType === 'header'`). */
  authHeaderName: string;
}

/** A fresh, empty form with sensible defaults. */
export function emptyMcpImportForm(): McpImportForm {
  return {
    endpointUrl: '',
    transport: 'streamable_http',
    name: '',
    authType: 'none',
    authToken: '',
    authHeaderName: '',
  };
}

/**
 * Derive a friendly endpoint name from a URL's host when the user left the name blank.
 * Falls back to the trimmed raw URL (then "MCP Server") when it cannot be parsed.
 */
export function deriveEndpointNameFromUrl(url: string): string {
  const trimmed = (url ?? '').trim();
  if (!trimmed) return 'MCP Server';
  try {
    const host = new URL(trimmed).host;
    return host || trimmed;
  } catch {
    return trimmed;
  }
}

/** True when the transport speaks HTTP (and therefore needs a parseable http(s) URL). */
function isHttpTransport(transport: McpTransport): boolean {
  return transport === 'streamable_http' || transport === 'sse';
}

/**
 * Validate the import form. Returns a human-readable error string, or `null` when the form is
 * ready to submit. Mirrors the server's guards (non-blank URL, http(s) for HTTP transports,
 * required secret fields per auth type) so the user is corrected before any network call.
 */
export function validateMcpImportForm(form: McpImportForm): string | null {
  const url = (form.endpointUrl ?? '').trim();
  if (!url) return 'Enter the MCP endpoint URL.';

  if (isHttpTransport(form.transport)) {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return 'Enter a valid URL (including http:// or https://).';
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return 'HTTP transports require an http:// or https:// URL.';
    }
  }

  if (form.authType === 'bearer' || form.authType === 'oauth2') {
    if (!(form.authToken ?? '').trim()) return 'Enter the access token for the selected auth type.';
  }
  if (form.authType === 'header') {
    if (!(form.authHeaderName ?? '').trim()) return 'Enter the header name.';
    if (!(form.authToken ?? '').trim()) return 'Enter the header value.';
  }

  return null;
}

/** Request body for `POST /api/mcp/endpoints` (create the catalog endpoint). */
export interface McpCreateEndpointBody {
  name: string;
  endpoint_url: string;
  transport: McpTransport;
  visibility: 'private';
}

/** Build the create-endpoint body, defaulting the name from the URL host when blank. */
export function buildCreateEndpointBody(form: McpImportForm): McpCreateEndpointBody {
  const name = (form.name ?? '').trim() || deriveEndpointNameFromUrl(form.endpointUrl);
  return {
    name,
    endpoint_url: (form.endpointUrl ?? '').trim(),
    transport: form.transport,
    visibility: 'private',
  };
}

/** Request body for `PUT /api/mcp/endpoints/{id}/credentials`. */
export interface McpCredentialBody {
  auth_type: Exclude<McpAuthType, 'none'>;
  payload: Record<string, unknown>;
}

/**
 * Build the credential body for the selected auth type, or `null` when `authType === 'none'`
 * (anonymous — no credential is stored). The payload shape matches objectified-rest's
 * `validate_credential_payload` for each scheme.
 */
export function buildCredentialBody(form: McpImportForm): McpCredentialBody | null {
  switch (form.authType) {
    case 'bearer':
      return { auth_type: 'bearer', payload: { token: form.authToken.trim() } };
    case 'oauth2':
      return { auth_type: 'oauth2', payload: { access_token: form.authToken.trim() } };
    case 'header':
      return {
        auth_type: 'header',
        payload: { name: form.authHeaderName.trim(), value: form.authToken.trim() },
      };
    case 'none':
    default:
      return null;
  }
}

/** Wire shape of a discovery job (subset of objectified-rest `McpDiscoveryJobOut`). */
export interface McpDiscoveryJob {
  id: string;
  endpoint_id: string;
  state: string;
  trigger?: string;
  error?: string | null;
  result?: { version_id?: string; version_seq?: number; changed?: boolean } & Record<string, unknown>;
}

/** Terminal job states (no further polling needed). */
export function isTerminalJobState(state: string | undefined | null): boolean {
  return state === 'completed' || state === 'failed';
}

/** True when the job finished successfully. */
export function isJobSuccess(job: McpDiscoveryJob | null | undefined): boolean {
  return !!job && job.state === 'completed';
}

/** Pull the produced version id from a finished job's result, if any. */
export function versionIdFromJob(job: McpDiscoveryJob | null | undefined): string | null {
  const vid = job?.result?.version_id;
  return typeof vid === 'string' && vid ? vid : null;
}

/** Human-readable label for a discovery job state (for the live status line). */
export function discoveryStatusLabel(state: string | undefined | null): string {
  switch (state) {
    case 'queued':
      return 'Queued…';
    case 'running':
      return 'Discovering capabilities…';
    case 'completed':
      return 'Discovery complete';
    case 'failed':
      return 'Discovery failed';
    default:
      return 'Starting discovery…';
  }
}
