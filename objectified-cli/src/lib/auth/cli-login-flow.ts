import open from "open";

import type { CliOAuthBundle } from "../credentials/store.js";
import {
  buildWebLoginUrl,
  CLI_LOGIN_BROWSER_TIMEOUT_MS,
  displayIdentityFromAccessToken,
  exchangeCliAuthorizationCode,
  generateCodeVerifier,
  codeChallengeS256,
  readAuthorizationCodeFromStdin,
  reserveLoopbackRedirectUri,
  shouldOpenBrowser,
  startLoopbackOAuthServer,
  withTimeout,
} from "./cli-oauth.js";

export type RunCliPkceLoginOpts = {
  apiBaseUrl: string;
  webLoginUrl: string;
  noBrowserFlag: boolean;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  /** When false, skip launching the browser (still uses loopback unless manual-code path). */
  openBrowser: boolean;
  stdoutLine: (line: string) => void;
  stderrLine: (line: string) => void;
  openUrl?: (url: string) => Promise<unknown>;
  /**
   * Test-only: skip browser/stdin and use this authorization code (still uses PKCE verifier + redirect_uri).
   * @internal
   */
  testAuthorizationCode?: string;
};

export type RunCliPkceLoginResult = CliOAuthBundle & {
  displayEmail?: string;
  /** Seconds until access token expiry when the token endpoint returned `expires_in`. */
  expiresIn?: number;
};

function shouldUseLoopbackBrowserFlow(opts: RunCliPkceLoginOpts): boolean {
  return (
    opts.testAuthorizationCode === undefined &&
    opts.openBrowser &&
    (opts.openUrl !== undefined || shouldOpenBrowser(opts.noBrowserFlag))
  );
}

/**
 * PKCE login: loopback redirect_uri, optional browser launch, token exchange.
 * Headless / `--no-browser`: prints URL and reads the authorization code from stdin.
 */
export async function runCliPkceLogin(opts: RunCliPkceLoginOpts): Promise<RunCliPkceLoginResult> {
  const verifier = generateCodeVerifier();
  if (verifier.length < 43) {
    throw new Error("internal error: code verifier too short");
  }
  const challenge = codeChallengeS256(verifier);
  const wantOpen = shouldUseLoopbackBrowserFlow(opts);
  const lb = wantOpen ? await startLoopbackOAuthServer() : undefined;
  const redirectUri = lb?.redirectUri ?? (await reserveLoopbackRedirectUri());
  const loginUrl = buildWebLoginUrl({
    webLoginUrl: opts.webLoginUrl,
    codeChallenge: challenge,
    redirectUri,
  });

  let code: string;

  try {
    if (opts.testAuthorizationCode !== undefined) {
      code = opts.testAuthorizationCode;
    } else if (!wantOpen) {
      opts.stdoutLine(`Open this URL in your browser to sign in:\n${loginUrl}`);
      opts.stderrLine("Waiting for authorization code on stdin… (Ctrl+C to cancel)");
      code = await readAuthorizationCodeFromStdin();
    } else {
      const waitForCode = lb?.waitForCode;
      if (!waitForCode) {
        throw new Error(
          "internal error: browser auth flow expected a loopback server, but none was started",
        );
      }
      opts.stdoutLine(`Opening ${opts.webLoginUrl.replace(/\?.*$/, "")} in your browser…`);
      opts.stderrLine("Waiting for browser… (Ctrl+C to cancel)");
      const opener = opts.openUrl ?? ((url: string) => open(url));
      await opener(loginUrl);
      code = await withTimeout(
        waitForCode,
        CLI_LOGIN_BROWSER_TIMEOUT_MS,
        "Waiting for browser login",
        opts.signal,
      );
    }
  } finally {
    if (lb) {
      try {
        await lb.close();
      } catch {
        /* ignore double-close */
      }
    }
  }

  const tokens = await exchangeCliAuthorizationCode({
    apiBaseUrl: opts.apiBaseUrl,
    code,
    redirectUri,
    codeVerifier: verifier,
    fetchImpl: opts.fetchImpl,
  });

  const displayEmail = displayIdentityFromAccessToken(tokens.access_token);

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    displayEmail,
    expiresIn: tokens.expires_in,
  };
}
