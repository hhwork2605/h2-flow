/**
 * RefImagePicker — drag-drop + paste + file input for reference images.
 *
 * Layer: UI
 * Owner: features/generate
 *
 * Spec: docs/05-ui-spec.md §2 "Reference Images". Phase 2 covers the three
 * input methods; Phase 6 polish adds the album / capture picker tabs in the
 * dialog, plus per-prompt frames for video.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera, Image as ImageIconLucide, ImagePlus, Search, X } from 'lucide-react';
import { useSystemConfig } from '@/core/useSystemConfig';
import { cn } from '@/utils/cn';
import { useRefImages } from '../hooks/useRefImages';
import { useFeatureGate } from '@/core/useFeatureGate';
import { Select } from '@/ui/components/Select';
import { showToast } from '@/ui/components/Toast';

const DEFAULT_MAX_REFS = 10;

export function RefImagePicker() {
  const { t } = useTranslation();
  const { refImages, add, remove } = useRefImages();
  const { data: sysCfg } = useSystemConfig();
  const featureGate = useFeatureGate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'recent' | 'large'>('all');

  const max = sysCfg?.limits.max_ref_images ?? DEFAULT_MAX_REFS;
  const canAddMore = refImages.length < max;
  const refEnabled = featureGate.canUse('ref_images');

  const visibleRefs = useMemo(() => {
    let arr = refImages;
    const q = searchQuery.trim().toLowerCase();
    if (q) arr = arr.filter((r) => r.filename.toLowerCase().includes(q));
    if (filter === 'large') arr = arr.filter((r) => r.size >= 500_000); // ≥500KB
    // 'recent' is the default order already (newest at the end of the array)
    return arr;
  }, [refImages, searchQuery, filter]);

  // Ctrl+V paste handler — only swallow events that contain images.
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      if (!refEnabled || !canAddMore || !e.clipboardData) return;
      const items = Array.from(e.clipboardData.items).filter((i) => i.kind === 'file' && i.type.startsWith('image/'));
      if (items.length === 0) return;
      e.preventDefault();
      items.slice(0, max - refImages.length).forEach((it) => {
        const file = it.getAsFile();
        if (file) void add(file);
      });
    }
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [add, canAddMore, max, refEnabled, refImages.length]);

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      const list = Array.from(files);
      const room = max - refImages.length;
      list.slice(0, room).forEach((file) => {
        void add(file);
      });
    },
    [add, max, refImages.length],
  );

  const onDragOver = (e: React.DragEvent) => {
    if (!refEnabled || !canAddMore) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    if (!dragging) setDragging(true);
  };
  const onDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget === e.target) setDragging(false);
  };
  const onDrop = (e: React.DragEvent) => {
    if (!refEnabled || !canAddMore) return;
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
  };

  if (!refEnabled) return null;

  return (
    <section className="flex flex-col gap-2">
      <header className="flex flex-wrap items-center justify-between gap-2">
        {/* Eyebrow UPPERCASE theo Claude Design: "ẢNH THAM CHIẾU · 0/10" */}
        <h3 className="inline-flex items-center gap-2 text-eyebrow uppercase tracking-[0.12em] text-muted-foreground">
          <ImageIconLucide className="h-3.5 w-3.5" />
          {t('refImages.section')}
          <span className="font-mono text-[11px] normal-case tracking-normal text-muted-foreground/70">
            · {refImages.length}/{max}
          </span>
        </h3>
        <div className="flex items-center gap-1.5">
          <div className="relative">
            <Search className="absolute left-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('refImages.searchPlaceholder')}
              className="h-7 w-32 rounded border bg-background pl-5 pr-1.5 text-meta text-foreground placeholder:text-muted-foreground/70"
            />
          </div>
          <Select
            ariaLabel={t('refImages.filterLabel')}
            value={filter}
            onValueChange={(v) => setFilter(v as typeof filter)}
            options={[
              { value: 'all', label: t('refImages.filterAll') },
              { value: 'recent', label: t('refImages.filterRecent') },
              { value: 'large', label: t('refImages.filterLarge') },
            ]}
            size="sm"
          />
        </div>
      </header>

      <div className="relative">
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={cn(
            'flex min-h-[80px] flex-wrap items-start gap-2 rounded-lg border-2 border-dashed p-2 transition-colors',
            dragging
              ? 'border-brand-500 bg-brand-500/10'
              : 'border-border bg-bg-elevate/50',
          )}
        >
          {visibleRefs.map((image) => (
            <RefThumb key={image.id} image={image} onRemove={() => void remove(image.id)} />
          ))}

          {visibleRefs.length === 0 && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 py-3 text-body text-text-2 hover:text-text-1"
              aria-label={t('refImages.add')}
            >
              <ImagePlus className="h-4 w-4" />
              {t('refImages.emptyHint')}
            </button>
          )}

          {visibleRefs.length > 0 && canAddMore && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'flex h-[60px] w-[60px] flex-col items-center justify-center gap-1 rounded border border-dashed border-border bg-bg-base text-text-2',
                'hover:border-brand-500 hover:text-brand-500',
              )}
              aria-label={t('refImages.add')}
            >
              <ImagePlus className="h-4 w-4" />
              <span className="text-tag">{t('refImages.add')}</span>
            </button>
          )}
        </div>

        {/* Capture button: floating to the right of the drop zone. */}
        <button
          type="button"
          onClick={() => {
            console.info('[h2-flow] capture button — placeholder for Phase 6 screen capture.');
            showToast({
              title: t('refImages.capture'),
              message: t('refImages.captureComingSoon'),
              variant: 'info',
            });
          }}
          aria-label={t('refImages.capture')}
          title={t('refImages.capture')}
          className="absolute -right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-border bg-bg-overlay text-text-2 shadow hover:bg-bg-elevate hover:text-text-1"
        >
          <Camera className="h-4 w-4" />
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      <p className="text-caption text-text-3">{t('refImages.hint')}</p>
    </section>
  );
}

interface RefThumbProps {
  image: import('../store/generate.store').RefImage;
  onRemove: () => void;
}

function RefThumb({ image, onRemove }: RefThumbProps) {
  return (
    <div className="group relative h-[60px] w-[60px] overflow-hidden rounded border border-border bg-bg-base">
      <img src={image.blobUrl} alt={image.filename} className="h-full w-full object-cover" />
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove"
        className="absolute right-0.5 top-0.5 grid h-5 w-5 place-items-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
