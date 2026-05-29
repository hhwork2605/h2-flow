import { Cloud } from 'lucide-react';
import { EmptyTab } from './EmptyTab';

export function SnippetsTab() {
  return (
    <EmptyTab
      icon={Cloud}
      title="Snippets"
      description="Album + snippet cá nhân — sắp có."
      phase="Implemented in Phase 6."
    />
  );
}
