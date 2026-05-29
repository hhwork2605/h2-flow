/**
 * PromptCard — merged prompt input + toolbar + Tạo button.
 *
 * Layer: UI
 * Owner: features/generate
 *
 * Theo Claude Design: 1 card `rounded-xl` chứa header (label + Multi-Prompt
 * switch) → textarea trong suốt → footer (chips + Nâng cao + Tạo). Thay thế
 * PromptArea + PromptToolbar + RunControls Tạo button (chunk 67-68).
 */

import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bookmark,
  ChevronDown,
  FileText,
  MessageSquareText,
  Paperclip,
  Play,
  Sparkles,
  Wand2,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { useAppStore } from '@/store/app.store';
import { useFeatureGate } from '@/core/useFeatureGate';
import { showToast } from '@/ui/components/Toast';
import {
  parsePrompts,
  useGenerateStore,
} from '../store/generate.store';
import { useGenerateStoreQuantity } from '../hooks/useGenerateStoreQuantity';

const PROMPT_LIMIT = 4000;

interface Props {
  onStart: () => void;
  advancedOpen: boolean;
  onToggleAdvanced: () => void;
}

export function PromptCard({ onStart, advancedOpen, onToggleAdvanced }: Props) {
  const { t } = useTranslation();
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const promptText = useGenerateStore((s) => s.promptText);
  const setPromptText = useGenerateStore((s) => s.setPromptText);
  const multiPrompt = useGenerateStore((s) => s.multiPrompt);
  const setMultiPrompt = useGenerateStore((s) => s.setMultiPrompt);
  const status = useGenerateStore((s) => s.status);
  const quantity = useGenerateStoreQuantity();
  const featureGate = useFeatureGate();
  const [enhanceHinted, setEnhanceHinted] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const promptCount = parsePrompts(promptText, multiPrompt).length;
  const charCount = promptText.length;
  const remaining = featureGate.quotaRemaining('generate');
  const running = status === 'running';
  const canStart =
    !running && promptCount > 0 && (remaining == null || remaining > 0);
  const outputCount = promptCount * quantity;

  async function handleImport(file: File) {
    const text = await file.text();
    const trimmed = text.trim();
    if (!trimmed) return;
    setPromptText(promptText ? `${promptText}\n${trimmed}` : trimmed);
    if (!multiPrompt) setMultiPrompt(true);
  }

  return (
    <section
      className={cn(
        'rounded-xl border bg-card shadow-card',
        'flex flex-col',
      )}
    >
      {/* ─── Header bar ─── */}
      <header className="flex items-center justify-between gap-2 border-b px-4 py-2.5">
        <div className="inline-flex min-w-0 items-center gap-2 text-meta">
          <MessageSquareText className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-semibold text-foreground">
            {t('generate.promptSection')}
          </span>
          <span className="font-mono text-[11px] text-muted-foreground">
            · {promptCount} {t('generate.promptShort')}
            {outputCount > 0 && ` → ${outputCount} ${t('generate.outputShort')}`}
          </span>
          {/* Character counter — đặt cạnh prompt count cho gọn. */}
          <span
            className={cn(
              'ml-1 shrink-0 whitespace-nowrap font-mono text-[11px]',
              charCount >= PROMPT_LIMIT
                ? 'text-destructive'
                : charCount > PROMPT_LIMIT * 0.9
                  ? 'text-warning'
                  : 'text-muted-foreground/70',
            )}
            aria-label={`${charCount} / ${PROMPT_LIMIT} characters`}
          >
            · {charCount} / {PROMPT_LIMIT}
          </span>
        </div>

        <label className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap text-meta text-muted-foreground">
          <span>{t('generate.multiPromptToggle')}</span>
          <button
            type="button"
            role="switch"
            aria-checked={multiPrompt}
            onClick={() => setMultiPrompt(!multiPrompt)}
            className={cn(
              'inline-flex h-5 w-9 items-center rounded-full transition-colors',
              multiPrompt ? 'bg-primary' : 'bg-border',
            )}
          >
            <span
              className={cn(
                'inline-block h-4 w-4 transform rounded-full bg-background shadow transition-transform',
                multiPrompt ? 'translate-x-[18px]' : 'translate-x-[2px]',
              )}
            />
          </button>
        </label>
      </header>

      {/* ─── Textarea — min-h explicit để @tailwindcss/forms reset không nén ─── */}
      <textarea
        value={promptText}
        onChange={(e) => setPromptText(e.target.value.slice(0, PROMPT_LIMIT))}
        placeholder={
          multiPrompt
            ? t('generate.promptPlaceholderMulti')
            : t('generate.promptPlaceholder')
        }
        rows={6}
        style={{ minHeight: 180 }}
        className={cn(
          'block w-full resize-none bg-transparent px-4 pb-2 pt-4',
          'text-[15px] leading-[1.55] text-foreground placeholder:text-muted-foreground/70',
          'border-0 shadow-none outline-none ring-0',
          'focus:border-0 focus:shadow-none focus:outline-none focus:ring-0',
        )}
      />

      {/* ─── Footer: chips + advanced + Tạo (1 hàng, không wrap) ─── */}
      <div className="flex items-center justify-between gap-2 px-3 pb-3 pt-1">
        {/* Chips group — `min-w-0` để shrink khi width hẹp, scroll-x nếu overflow.
            scrollbar đã hidden global (xem src/index.css). */}
        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
          <Chip
            icon={Wand2}
            label={t('generate.toolbar.enhance', 'Nâng prompt')}
            accent
            onClick={() => setEnhanceHinted(true)}
            title={enhanceHinted ? 'Coming in Phase 4' : undefined}
          />
          <Chip
            icon={Bookmark}
            label={t('generate.toolbar.templates')}
            onClick={() => setActiveTab('prompts')}
          />
          <Chip
            icon={Sparkles}
            label={t('generate.toolbar.chatAI')}
            onClick={() =>
              showToast({
                title: t('generate.toolbar.chatAI'),
                message: t('generate.toolbar.chatAIComingSoon'),
                variant: 'info',
              })
            }
          />
          <Chip
            icon={FileText}
            label={t('generate.toolbar.importTxt')}
            onClick={() => fileInputRef.current?.click()}
          />
          <Chip icon={Paperclip} label="" iconOnly aria-label="Attach" />
        </div>

        {/* Right group: Advanced + Tạo — shrink-0 để luôn hiển thị đầy đủ. */}
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onToggleAdvanced}
            className={cn(
              'inline-flex h-9 items-center gap-1.5 rounded border bg-transparent px-3',
              'text-body font-medium text-muted-foreground transition-colors',
              'hover:bg-accent hover:text-foreground',
            )}
          >
            <ChevronDown
              className={cn(
                'h-3.5 w-3.5 transition-transform',
                advancedOpen && 'rotate-180',
              )}
            />
            <span className="hidden sm:inline">
              {t('generate.advanced', 'Nâng cao')}
            </span>
          </button>

          <button
            type="button"
            onClick={onStart}
            disabled={!canStart}
            className={cn(
              'inline-flex h-9 items-center justify-center gap-2 rounded px-5',
              'bg-primary text-primary-foreground shadow-btn-glow',
              'text-[14px] font-semibold transition-opacity',
              'disabled:cursor-not-allowed disabled:opacity-50',
              'hover:opacity-95',
            )}
          >
            <Play className="h-4 w-4" />
            <span>
              {t('generate.start', { count: outputCount || promptCount || 1 })}
            </span>
            <kbd className="ml-1 hidden font-mono text-[11px] opacity-70 sm:inline">
              ⌘↵
            </kbd>
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.md,text/plain"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleImport(file);
          e.target.value = '';
        }}
      />
    </section>
  );
}

interface ChipProps {
  icon: typeof Wand2;
  label: string;
  onClick?: () => void;
  accent?: boolean;
  iconOnly?: boolean;
  title?: string;
  'aria-label'?: string;
}
function Chip({
  icon: Icon,
  label,
  onClick,
  accent,
  iconOnly,
  title,
  'aria-label': ariaLabel,
}: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={ariaLabel ?? label}
      className={cn(
        'inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded border px-2.5 text-meta font-medium transition-colors',
        accent
          ? 'border-primary/40 bg-primary/10 text-primary hover:bg-primary/15'
          : 'border-transparent bg-secondary text-foreground hover:bg-accent',
        iconOnly && 'px-2',
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {!iconOnly && <span className="hidden sm:inline">{label}</span>}
    </button>
  );
}
