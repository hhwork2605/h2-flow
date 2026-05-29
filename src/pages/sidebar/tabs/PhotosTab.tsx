import { Image as ImageIcon } from 'lucide-react';
import { EmptyTab } from './EmptyTab';

export function PhotosTab() {
  return (
    <EmptyTab
      icon={ImageIcon}
      title="Photos"
      description="No images yet."
      phase="Implemented in Phase 6."
    />
  );
}
