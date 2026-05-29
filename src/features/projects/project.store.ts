/**
 * project.store.ts — Flow project switcher state.
 *
 * Layer: State
 * Owner: features/projects
 *
 * Spec: docs/05-ui-spec.md §1 "Project Indicator". Phase 2.7 ships mock
 * data (no backend hit); Phase 2.x follow-up will swap to `/flow/projects`
 * once the endpoint exists.
 */

import { create } from 'zustand';
import { getStorage, setStorage } from '@/storage/chrome-storage';

export interface FlowProject {
  id: string;
  name: string;
  created_at: string;
}

const STORAGE_KEY = 'af_current_project_id';

function ts(): string {
  return new Date().toLocaleString('vi-VN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

const SEED_PROJECTS: FlowProject[] = [
  { id: 'proj_default', name: `Mặc định • ${ts()}`, created_at: new Date().toISOString() },
];

interface ProjectState {
  projects: FlowProject[];
  currentProjectId: string | null;
  setCurrentProject: (id: string) => void;
  createProject: (name?: string) => FlowProject;
  deleteProject: (id: string) => void;
  hydrate: () => Promise<void>;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: SEED_PROJECTS,
  currentProjectId: SEED_PROJECTS[0]?.id ?? null,

  setCurrentProject: (id) => {
    set({ currentProjectId: id });
    void setStorage(STORAGE_KEY, id);
  },

  createProject: (name) => {
    const project: FlowProject = {
      id: `proj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      name: name?.trim() || `Project • ${ts()}`,
      created_at: new Date().toISOString(),
    };
    set((state) => ({
      projects: [...state.projects, project],
      currentProjectId: project.id,
    }));
    void setStorage(STORAGE_KEY, project.id);
    return project;
  },

  deleteProject: (id) => {
    set((state) => {
      const next = state.projects.filter((p) => p.id !== id);
      const nextCurrent =
        state.currentProjectId === id ? (next[0]?.id ?? null) : state.currentProjectId;
      if (nextCurrent !== state.currentProjectId) {
        void setStorage(STORAGE_KEY, nextCurrent);
      }
      return { projects: next, currentProjectId: nextCurrent };
    });
  },

  hydrate: async () => {
    const stored = await getStorage<string>(STORAGE_KEY);
    if (stored && get().projects.some((p) => p.id === stored)) {
      set({ currentProjectId: stored });
    }
  },
}));
