/**
 * store/app.store.ts — Root sidebar Zustand store skeleton.
 *
 * Layer: State
 * Owner: shared
 *
 * Phase 0: holds only the active sidebar tab. Feature slices (auth, generate,
 * workflow, multi-task...) live in their own feature folders per
 * docs/04-project-structure.md.
 */

import { create } from 'zustand';
import { getStorage, setStorage } from '@/storage/chrome-storage';

export const SIDEBAR_TABS = [
  'generate',
  'workflow',
  'prompts',
  'multi-task',
  'photos',
  'snippets',
  'history',
  'logs',
] as const;
export type SidebarTab = (typeof SIDEBAR_TABS)[number];

const ACTIVE_TAB_KEY = 'af_active_sidebar_tab';
const DEFAULT_TAB: SidebarTab = 'generate';

interface AppState {
  activeTab: SidebarTab;
  setActiveTab: (tab: SidebarTab) => void;
  hydrateFromStorage: () => Promise<void>;
}

export const useAppStore = create<AppState>((set) => ({
  activeTab: DEFAULT_TAB,
  setActiveTab: (tab) => {
    set({ activeTab: tab });
    void setStorage(ACTIVE_TAB_KEY, tab);
  },
  hydrateFromStorage: async () => {
    const stored = await getStorage<SidebarTab>(ACTIVE_TAB_KEY);
    if (stored && SIDEBAR_TABS.includes(stored)) {
      set({ activeTab: stored });
    }
  },
}));
