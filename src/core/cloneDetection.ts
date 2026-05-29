/**
 * core/cloneDetection.ts — Anti-clone state.
 *
 * Layer: Infra
 * Owner: core
 *
 * Flag `af_clone_detected` set when any API call returns 403
 * EXTENSION_NOT_AUTHORIZED. CloneDetectedOverlay subscribes to storage and
 * renders a blocking screen. Background's self-heal probe (alarm) polls
 * /extension/authorized periodically and clears the flag when access is
 * restored.
 *
 * Reference: reference-ext/background.js — search "EXTENSION_NOT_AUTHORIZED".
 */

import { getStorage, onStorageChange, setStorage } from '@/storage/chrome-storage';
import { useEffect, useState } from 'react';

const KEY = 'af_clone_detected';

export async function getCloneDetected(): Promise<boolean> {
  return (await getStorage<boolean>(KEY)) === true;
}

export async function setCloneDetected(value: boolean): Promise<void> {
  await setStorage(KEY, value);
}

/** React hook — true when the flag is set. */
export function useCloneDetected(): boolean {
  const [flag, setFlag] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getCloneDetected().then((v) => {
      if (!cancelled) setFlag(v);
    });
    const off = onStorageChange<boolean>(KEY, (newValue) => {
      setFlag(newValue === true);
    });
    return () => {
      cancelled = true;
      off();
    };
  }, []);

  return flag;
}
