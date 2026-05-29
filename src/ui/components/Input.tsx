/**
 * Input — text input primitive (also used for password / email).
 *
 * Layer: UI
 * Owner: ui/components
 *
 * Khi `type="password"` → tự render nút eye toggle bên phải để show/hide
 * password. Toggle giữ state internally; KHÔNG báo change ra ngoài (vẫn dispatch
 * event onChange của input).
 */

import { forwardRef, useState, type InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/utils/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Compound label + input — pass a label and id for accessibility. */
  label?: string;
  errorMessage?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, errorMessage, id, className, type = 'text', ...rest },
  ref,
) {
  const hasError = !!errorMessage;
  const isPassword = type === 'password';
  const [revealed, setRevealed] = useState(false);
  const effectiveType = isPassword && revealed ? 'text' : type;

  const inputElement = (
    <input
      ref={ref}
      id={id}
      type={effectiveType}
      aria-invalid={hasError || undefined}
      // `w-full` để input stretch theo wrapper. Trước: input không có w-full
      // → password wrapper `<div className="relative">` stretch full-width
      // (flex child) nhưng input giữ intrinsic width → button absolute right-1
      // bám phải wrapper, nằm NGOÀI input. Email không bị vì không có wrapper.
      // `[&::-ms-reveal]:hidden` disable native Edge reveal nút (tránh overlap).
      className={cn(
        'h-9 w-full rounded-md border bg-bg-base px-3 text-body text-text-1',
        'placeholder:text-text-3',
        'disabled:cursor-not-allowed disabled:opacity-60',
        hasError ? 'border-error focus:ring-error' : 'border-border focus:border-brand-500',
        isPassword && 'pr-9 [&::-ms-reveal]:hidden [&::-ms-clear]:hidden',
        className,
      )}
      {...rest}
    />
  );

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={id} className="text-caption font-medium text-text-2">
          {label}
        </label>
      )}
      {isPassword ? (
        <div className="relative">
          {inputElement}
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setRevealed((v) => !v)}
            aria-label={revealed ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            aria-pressed={revealed}
            title={revealed ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            className={cn(
              'absolute right-1 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded',
              'text-muted-foreground hover:bg-white/5 hover:text-foreground',
              'focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/60',
              rest.disabled && 'pointer-events-none opacity-40',
            )}
          >
            {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      ) : (
        inputElement
      )}
      {hasError && <p className="text-caption text-error">{errorMessage}</p>}
    </div>
  );
});
