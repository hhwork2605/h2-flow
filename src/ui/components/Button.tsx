/**
 * Button — base button primitive.
 *
 * Layer: UI
 * Owner: ui/components
 */

import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-brand-500 text-white hover:bg-brand-700 active:bg-brand-700 disabled:bg-brand-500/60',
  secondary:
    'bg-bg-elevate text-text-1 border border-border hover:bg-bg-overlay disabled:opacity-60',
  ghost: 'bg-transparent text-text-1 hover:bg-bg-elevate disabled:opacity-50',
  danger: 'bg-error text-white hover:bg-error/90 disabled:opacity-60',
};

const SIZES: Record<Size, string> = {
  sm: 'h-7 px-2 text-caption',
  md: 'h-9 px-3 text-body',
  lg: 'h-11 px-4 text-section',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', fullWidth, className, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors',
        'disabled:cursor-not-allowed',
        VARIANTS[variant],
        SIZES[size],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    />
  );
});
