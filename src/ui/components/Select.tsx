/**
 * Select — Radix-powered dropdown.
 *
 * Layer: UI
 * Owner: ui/components
 */

import * as RadixSelect from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/utils/cn';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  badge?: string;
}

interface Props {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
  size?: 'sm' | 'md';
}

export function Select({
  value,
  onValueChange,
  options,
  placeholder,
  disabled,
  ariaLabel,
  className,
  size = 'md',
}: Props) {
  return (
    <RadixSelect.Root value={value} onValueChange={onValueChange} disabled={disabled}>
      <RadixSelect.Trigger
        aria-label={ariaLabel}
        className={cn(
          'inline-flex items-center justify-between gap-2 rounded-md border border-border bg-bg-base px-3 text-body text-text-1',
          'hover:bg-bg-elevate disabled:cursor-not-allowed disabled:opacity-60',
          size === 'sm' ? 'h-7 text-caption' : 'h-9',
          className,
        )}
      >
        <RadixSelect.Value placeholder={placeholder} />
        <RadixSelect.Icon>
          <ChevronDown className="h-3.5 w-3.5 text-text-2" />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <RadixSelect.Content
          position="popper"
          sideOffset={4}
          className={cn(
            'z-dropdown min-w-[180px] overflow-hidden rounded-md border border-border bg-bg-overlay shadow-lg',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
          )}
        >
          <RadixSelect.Viewport className="p-1">
            {options.map((opt) => (
              <RadixSelect.Item
                key={opt.value}
                value={opt.value}
                disabled={opt.disabled}
                className={cn(
                  'relative flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 pr-7 text-body',
                  'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
                  'outline-none focus:bg-bg-elevate data-[state=checked]:font-medium',
                )}
              >
                <RadixSelect.ItemText>{opt.label}</RadixSelect.ItemText>
                {opt.badge && (
                  <span className="rounded bg-brand-500/10 px-1.5 text-tag text-brand-500">
                    {opt.badge}
                  </span>
                )}
                <RadixSelect.ItemIndicator className="absolute right-2 flex items-center">
                  <Check className="h-3.5 w-3.5 text-brand-500" />
                </RadixSelect.ItemIndicator>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}
