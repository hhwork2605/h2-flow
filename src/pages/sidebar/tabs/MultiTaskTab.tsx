import { ListChecks } from 'lucide-react';
import { EmptyTab } from './EmptyTab';

export function MultiTaskTab() {
  return (
    <EmptyTab
      icon={ListChecks}
      title="Multi-Task"
      description="No tasks yet."
      phase="Implemented in Phase 4."
    />
  );
}
