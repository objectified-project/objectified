export const DEFAULT_BASE_URL = "https://api.objectified.dev";

/** Web UI entry for CLI OAuth (PKCE); opened by `objectified auth login`. */
export const DEFAULT_CLI_WEB_LOGIN_URL = "https://app.objectified.dev/cli/login";

/** Injected before oclif parse when `auth login --api-key` has no value (#3195). */
export const API_KEY_PROMPT_SENTINEL = "__OBJECTIFIED_API_KEY_PROMPT__";
