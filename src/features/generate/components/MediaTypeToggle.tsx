/**
 * MediaTypeToggle — image / video segmented toggle.
 *
 * Layer: UI
 * Owner: features/generate
 *
 * Theo Claude Design: active = bg-foreground text-background (đảo màu).
 */

import { Image as ImageIcon, Video } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useGenerateStore } from '../store/generate.store';
import { cn } from '@/utils/cn';

export function MediaTypeToggle() {
  const { t } = useTranslation();
  const mediaType = useGenerateStore((s) => s.mediaType);
  const setMediaType = useGenerateStore((s) => s.setMediaType);

  return (
    <div
      className="inline-flex items-center rounded-md border bg-background p-0.5"
      role="radiogroup"
    >
      {(
        [
          { value: 'image', label: t('generate.mediaImage'), Icon: ImageIcon },
          { value: 'video', label: t('generate.mediaVideo'), Icon: Video },
        ] as const
      ).map(({ value, label, Icon }) => {
        const isActive = mediaType === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => setMediaType(value)}
            className={cn(
              'inline-flex h-7 items-center gap-1.5 rounded px-3 text-meta transition-colors',
              isActive
                ? 'bg-foreground text-background font-semibold'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
