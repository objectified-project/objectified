/** BSD/sysexits-inspired CLI exit codes (#3191). */
export const EXIT_CODES = {
  SUCCESS: 0,
  GENERIC: 1,
  MISUSE: 2,
  NOT_AUTHENTICATED: 3,
  FORBIDDEN: 4,
  NOT_FOUND: 5,
  CONFLICT: 6,
  VALIDATION: 7,
  SERVER_ERROR: 8,
  NETWORK: 9,
  RATE_LIMITED: 10,
  CONFIG: 11,
} as const;

export type ExitCode = (typeof EXIT_CODES)[keyof typeof EXIT_CODES];

export type ExitCodeRow = {
  code: ExitCode;
  label: string;
  hint: string;
};

export const EXIT_CODE_TABLE: ExitCodeRow[] = [
  { code: 0, label: "success", hint: "Command completed normally." },
  { code: 1, label: "generic failure", hint: "Unexpected error; see message and retry with OBJECTIFIED_DEBUG=1." },
  { code: 2, label: "misuse", hint: "Fix flags or arguments; try --help on the command." },
  {
    code: 3,
    label: "not authenticated",
    hint: "Run `objectified auth login` or set OBJECTIFIED_API_KEY / bearer token.",
  },
  { code: 4, label: "forbidden", hint: "Switch tenant or API key; check permissions for this resource." },
  { code: 5, label: "not found", hint: "Check spelling of slugs and IDs; see suggestions when available." },
  { code: 6, label: "conflict", hint: "Pull remote changes or fork before retrying." },
  { code: 7, label: "validation", hint: "Fix request payload; use --dry-run where supported to preview changes." },
  {
    code: 8,
    label: "server error",
    hint: "API returned 5xx; retry later. Request-id is printed when the server sends one.",
  },
  {
    code: 9,
    label: "network / timeout",
    hint: "Check VPN / firewall / DNS; verify `--base-url` or OBJECTIFIED_BASE_URL.",
  },
  {
    code: 10,
    label: "rate limited",
    hint: "Wait for Retry-After (shown when present), then retry with backoff.",
  },
  { code: 11, label: "config error", hint: "Run `objectified config path` and fix config.toml / profile entries." },
];

export function formatExitCodeDocs(): string {
  const lines = [
    "Exit codes (BSD/sysexits-inspired):",
    "",
    ...EXIT_CODE_TABLE.filter((r) => r.code !== 0).map(
      (r) => `  ${String(r.code).padEnd(3)}  ${r.label.padEnd(22)} ${r.hint}`,
    ),
    "",
    "Stacks and SDK traces print only with `--verbose` or OBJECTIFIED_DEBUG=1.",
    "",
    "Related:",
    "  • Global flags: objectified --help",
    "  • Config file path: objectified config path",
  ];
  return lines.join("\n");
}

export function exitCodeReferenceJson(): {
  exitCodes: Array<{ code: number; label: string; hint: string }>;
  notes: string[];
} {
  return {
    exitCodes: EXIT_CODE_TABLE.map(({ code, label, hint }) => ({ code, label, hint })),
    notes: [
      "Stacks and SDK traces print only with --verbose or OBJECTIFIED_DEBUG=1.",
      "See objectified --help for global flags.",
    ],
  };
}
