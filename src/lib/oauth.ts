/**
 * ═══════════════════════════════════════════════════════════════════════════
 * OAuth Authentication for Bluesky
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Handles "Log in with Bluesky" OAuth flow:
 *  - Builds client_id based on environment (localhost vs production)
 *  - Initializes BrowserOAuthClient
 *  - Processes OAuth callback after redirect
 *  - Restores sessions by DID
 *
 * HOW TO EDIT:
 *  - Update the client_id in public/client-metadata.json for production
 *  - The redirect_uri must match what's in client-metadata.json
 *  - For local dev, loopback client_id is auto-generated
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { BrowserOAuthClient } from '@atproto/oauth-client-browser';

let client: BrowserOAuthClient | null = null;

/** Get the app's base URL (origin + path without trailing index.html). */
function getAppBaseUrl(): string {
  const u = new URL(window.location.href);
  const path = u.pathname.replace(/\/index\.html$/, '').replace(/\/?$/, '') || '/';
  return `${u.origin}${path}`;
}

/** Check if running on localhost (development). */
function isLoopback(): boolean {
  const h = window.location.hostname;
  return h === 'localhost' || h === '127.0.0.1' || h === '[::1]';
}

/** Build loopback client_id for development. */
function getLoopbackClientId(): string {
  const u = new URL(window.location.href);
  const host = u.hostname === 'localhost' ? '127.0.0.1' : u.hostname;
  const port = u.port || (u.protocol === 'https:' ? '443' : '80');
  const path = u.pathname || '/';
  const redirectUri = `http://${host}:${port}${path}`;
  return `http://localhost?redirect_uri=${encodeURIComponent(redirectUri)}`;
}

/** Load or create the OAuth client (cached). */
export async function getOAuthClient(): Promise<BrowserOAuthClient> {
  if (typeof window === 'undefined') throw new Error('OAuth is browser-only');
  if (client) return client;

  const clientId = isLoopback()
    ? getLoopbackClientId()
    : `${getAppBaseUrl()}/client-metadata.json`;

  client = await BrowserOAuthClient.load({
    clientId,
    handleResolver: 'https://bsky.social/',
    responseMode: 'query',
  });
  return client;
}

export type OAuthSession = import('@atproto/oauth-client').OAuthSession;

/**
 * Initialize OAuth: restore existing session or process callback after redirect.
 * Call this on app startup.
 */
export async function initOAuth(options?: {
  hasCallback?: boolean;
  preferredRestoreDid?: string;
}): Promise<{ session: OAuthSession; state?: string | null } | undefined> {
  const oauth = await getOAuthClient();

  // Check if we're returning from an OAuth redirect
  const hasCallback =
    options?.hasCallback ??
    (() => {
      const params = new URLSearchParams(window.location.search);
      return params.has('state') && (params.has('code') || params.has('error'));
    })();

  if (hasCallback) return oauth.init();

  // Try to restore a specific DID's session
  if (options?.preferredRestoreDid) {
    try {
      const session = await oauth.restore(options.preferredRestoreDid, true);
      return { session };
    } catch { return undefined; }
  }

  return oauth.init();
}

/** Restore a specific OAuth session by DID (for account switching). */
export async function restoreOAuthSession(did: string): Promise<OAuthSession | null> {
  try {
    const oauth = await getOAuthClient();
    return await oauth.restore(did, true);
  } catch { return null; }
}

/** Start OAuth sign-in – redirects to Bluesky. Never returns. */
export async function signInWithOAuthRedirect(handle: string): Promise<never> {
  const oauth = await getOAuthClient();
  return oauth.signInRedirect(handle);
}
