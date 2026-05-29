import { MessageSquare } from 'lucide-react';
import { EmptyTab } from './EmptyTab';

export function PromptsTab() {
  return (
    <EmptyTab
      icon={MessageSquare}
      title="Prompts"
      description="Quản lý thư viện prompt — sắp có."
      phase="Implemented in Phase 6."
    />
  );
}
