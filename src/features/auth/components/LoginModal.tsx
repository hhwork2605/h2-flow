/**
 * LoginModal — email/password + Google login.
 *
 * Layer: UI
 * Owner: features/auth
 *
 * Spec: docs/05-ui-spec.md §9 "Login Modal". Validation rules:
 *   - email: required + RFC-ish (browser validation is enough for now)
 *   - password: required + min 6 (server enforces real strength)
 */

import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError } from '@/api/errors';
import { useAuth } from '../hooks/useAuth';
import { Button } from '@/ui/components/Button';
import { Dialog } from '@/ui/components/Dialog';
import { Input } from '@/ui/components/Input';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSwitchToRegister: () => void;
}

export function LoginModal({ open, onOpenChange, onSwitchToRegister }: Props) {
  const { t } = useTranslation();
  const { login, startGoogleOAuth, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      await login({ email: email.trim(), password });
      onOpenChange(false);
      setEmail('');
      setPassword('');
    } catch (err) {
      setFormError(toUserMessage(err, t('auth.loginFailed')));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('auth.loginTitle')}
      description={t('auth.loginDesc')}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Input
          id="login-email"
          label={t('auth.email')}
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={submitting || isLoading}
        />
        <Input
          id="login-password"
          label={t('auth.password')}
          type="password"
          autoComplete="current-password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={submitting || isLoading}
        />
        {formError && <p className="text-caption text-error">{formError}</p>}
        <Button type="submit" fullWidth disabled={submitting || isLoading}>
          {submitting ? t('auth.loginButtonLoading') : t('auth.loginButton')}
        </Button>

        <div className="flex items-center gap-2 text-caption text-text-3">
          <span className="h-px flex-1 bg-border" />
          {t('common.or')}
          <span className="h-px flex-1 bg-border" />
        </div>

        <Button
          type="button"
          variant="secondary"
          fullWidth
          onClick={() => {
            void startGoogleOAuth();
          }}
          disabled={submitting || isLoading}
        >
          {t('auth.googleLogin')}
        </Button>

        <button
          type="button"
          className="mt-1 text-caption text-text-2 hover:text-text-1 hover:underline"
          onClick={onSwitchToRegister}
        >
          {t('auth.noAccount')}
        </button>
      </form>
    </Dialog>
  );
}

function toUserMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    if (err.code === 'VALIDATION_ERROR' && err.details) {
      const first = Object.values(err.details)[0]?.[0];
      if (first) return first;
    }
    return err.message;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}
