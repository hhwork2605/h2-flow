/**
 * background/self-heal.ts — Anti-clone self-heal probe.
 *
 * Layer: Infra (background)
 * Owner: core
 *
 * When `af_clone_detected` is set (anti-clone flag), poll
 * `GET /extension/authorized` once a minute. If the backend returns 200,
 * clear the flag so the overlay disappears automatically without the user
 * having to reinstall.
 *
 * Reference: reference-ext/background.js — search "self-heal" / "probe".
 */

import { handleApiRequest } from './api-proxy';

const ALARM_NAME = 'af_clone_self_heal';
const FLAG_KEY = 'af_clone_detected';

export function registerSelfHealProbe(): void {
  chrome.alarms?.create(ALARM_NAME, { periodInMinutes: 1 });
  chrome.alarms?.onAlarm.addListener(async (alarm) => {
    if (alarm.name !== ALARM_NAME) return;
    await runProbeIfNeeded();
  });
}

export async function runProbeIfNeeded(): Promise<void> {
  const stored = await chrome.storage.local.get(FLAG_KEY);
  if (!stored[FLAG_KEY]) return;

  const env = await handleApiRequest({
    action: 'apiRequest',
    method: 'GET',
    endpoint: 'extension/authorized',
  });
  if (env.success) {
    await chrome.storage.local.set({ [FLAG_KEY]: false });
    console.info('[h2-flow] anti-clone self-heal: extension re-authorized, overlay cleared');
  }
}
