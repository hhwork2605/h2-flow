import { History } from 'lucide-react';
import { EmptyTab } from './EmptyTab';

export function HistoryTab() {
  return (
    <EmptyTab
      icon={History}
      title="History"
      description="No history yet."
      phase="Implemented in Phase 6."
    />
  );
}
