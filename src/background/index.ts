/**
 * background/index.ts — Service Worker entry.
 *
 * Layer: Infra
 * Owner: background
 *
 * Routes `chrome.runtime` messages to handler modules. Phase 1 wires the
 * full `apiRequest` proxy (signing + envelope parsing). Future phases will
 * register download-handler, tab-manager, alarm-scheduler, sse subscriber
 * — kept as flat dispatch so each handler stays testable in isolation.
 */

import type { ApiResponseMessage, ExtensionMessage } from '@/types/messages.types';
import type { AuthSession, User } from '@/types/user.types';
import { handleApiRequest } from './api-proxy';
import { registerSelfHealProbe } from './self-heal';
import {
  handleChatGPTBgMessage,
  registerChatGPTBridge,
  type ChatGPTBgRequest,
} from './chatgpt-bridge';

chrome.runtime.onInstalled.addListener((details) => {
  console.info('[h2-flow] installed', details.reason);
});

chrome.sidePanel
  ?.setPanelBehavior({ openPanelOnActionClick: true })
  .catch((err) => console.warn('[h2-flow] sidePanel.setPanelBehavior failed', err));

registerSelfHealProbe();
registerChatGPTBridge();

chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, _sender, sendResponse: (response: unknown) => void) => {
    // ChatGPT actions — prefix-based dispatch (mọi action 'chatgpt:*').
    const action = (message as { action?: string }).action;
    if (typeof action === 'string' && action.startsWith('chatgpt:')) {
      handleChatGPTBgMessage(message as unknown as ChatGPTBgRequest).then(
        (resp) => sendResponse(resp),
        (err: unknown) =>
          sendResponse({
            success: false,
            error: err instanceof Error ? err.message : String(err),
          }),
      );
      return true;
    }
    switch (message.action) {
      case 'apiRequest': {
        handleApiRequest(message).then(
          (env: ApiResponseMessage) => sendResponse(env),
          (err: unknown) =>
            sendResponse({
              success: false,
              httpStatus: 0,
              error: {
                code: 'NETWORK_ERROR',
                message: err instanceof Error ? err.message : String(err),
              },
            } satisfies ApiResponseMessage),
        );
        return true; // async response
      }
      case 'ping': {
        sendResponse({ ok: true, pong: Date.now() });
        return false;
      }
      case 'auth:changed': {
        // Phase 1: no-op. Phase 4 will (re)connect SSE here.
        console.debug('[h2-flow] auth:changed', message.hasToken);
        sendResponse({ ok: true });
        return false;
      }
      case 'auth:google-callback': {
        handleGoogleCallback(message.token, message.user).then(
          () => sendResponse({ ok: true }),
          (err) => {
            console.error('[h2-flow] google-callback failed', err);
            sendResponse({ ok: false });
          },
        );
        return true;
      }
      default:
        return false;
    }
  },
);

/**
 * Persist Google-OAuth-issued session into `af_auth`. The sidebar's storage
 * listener (wireAuthCrossContextSync) picks it up and the UI updates.
 */
async function handleGoogleCallback(token: string, rawUser: unknown): Promise<void> {
  if (!token || !rawUser || typeof rawUser !== 'object') {
    throw new Error('Invalid Google callback payload');
  }
  const user = rawUser as User;
  const session: AuthSession = {
    token,
    user,
    savedAt: Date.now(),
  };
  await chrome.storage.local.set({ af_auth: session });
}
