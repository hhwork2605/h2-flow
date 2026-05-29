/**
 * content/oauth-bridge.ts — Google OAuth callback bridge.
 *
 * Layer: Content script
 * Owner: features/auth
 *
 * Runs on `auth/google/success` (backend-rendered). Reads `token` + `user`
 * from the URL → posts an `auth:google-callback` message to the background
 * service worker → background saves `af_auth` → sidebar picks it up via
 * cross-context storage sync.
 *
 * Spec: docs/08-api-contract.md §2 "Google OAuth redirect flow".
 * Reference: reference-ext/oauth-bridge.js.
 */

(function oauthBridge() {
  try {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const userBase64 = params.get('user');
    if (!token || !userBase64) {
      console.warn('[h2-flow] oauth-bridge: missing token or user in URL');
      return;
    }

    let user: unknown;
    try {
      user = JSON.parse(atob(userBase64));
    } catch (err) {
      console.error('[h2-flow] oauth-bridge: failed to decode user payload', err);
      return;
    }

    chrome.runtime.sendMessage(
      { action: 'auth:google-callback', token, user },
      (response: { ok?: boolean } | undefined) => {
        if (chrome.runtime.lastError || !response?.ok) {
          console.error(
            '[h2-flow] oauth-bridge: background rejected callback',
            chrome.runtime.lastError,
            response,
          );
          return;
        }
        // Close the success tab once the session is saved so the user lands
        // back on the sidebar without an orphan tab.
        try {
          window.close();
        } catch {
          /* some browsers ignore programmatic close — leave the tab. */
        }
      },
    );
  } catch (err) {
    console.error('[h2-flow] oauth-bridge unexpected error', err);
  }
})();

export {};
