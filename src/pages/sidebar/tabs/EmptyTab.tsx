import type { LucideIcon } from 'lucide-react';

interface EmptyTabProps {
  icon: LucideIcon;
  title: string;
  description: string;
  phase: string;
}

/**
 * Shared empty-state for every sidebar tab in Phase 0.
 *
 * Replaced per-tab as features land — see docs/12-implementation-roadmap.md.
 */
export function EmptyTab({ icon: Icon, title, description, phase }: EmptyTabProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-full bg-bg-elevate text-text-2">
        <Icon className="h-6 w-6" />
      </div>
      <h2 className="text-section text-text-1">{title}</h2>
      <p className="mt-2 max-w-xs text-body text-text-2">{description}</p>
      <p className="mt-4 text-caption text-text-3">{phase}</p>
    </div>
  );
}
