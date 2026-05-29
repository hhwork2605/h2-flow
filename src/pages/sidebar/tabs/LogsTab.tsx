import { Terminal } from 'lucide-react';
import { EmptyTab } from './EmptyTab';

export function LogsTab() {
  return (
    <EmptyTab
      icon={Terminal}
      title="Logs"
      description="Logs will appear here."
      phase="Implemented in Phase 6."
    />
  );
}
