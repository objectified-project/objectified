/** Redacts API keys for stderr / verbose output (#3195). */
export function redactApiKeyForLogs(key: string): string {
  const t = key.trim();
  if (t === "") return "***";
  const prefixMatch = /^(sk_|pk_)/.exec(t);
  if (prefixMatch?.[1] !== undefined) return `${prefixMatch[1]}***`;
  return "***";
}
