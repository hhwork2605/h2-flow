/**
 * RegisterModal — name + email + password (+ confirm).
 *
 * Layer: UI
 * Owner: features/auth
 *
 * Server may either auto-login (response includes token) or require email
 * verification first — `AuthService.register` returns null in the latter case
 * and we show a "check your inbox" success state.
 */

import { useState, type FormEvent } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { ApiError } from '@/api/errors';
import { useAuth } from '../hooks/useAuth';
import { Button } from '@/ui/components/Button';
import { Dialog } from '@/ui/components/Dialog';
import { Input } from '@/ui/components/Input';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSwitchToLogin: () => void;
}

export function RegisterModal({ open, onOpenChange, onSwitchToLogin }: Props) {
  const { t } = useTranslation();
  const { register, isLoading } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [verifyHint, setVerifyHint] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (password !== confirm) {
      setFormError(t('auth.passwordMismatch'));
      return;
    }
    setSubmitting(true);
    try {
      const user = await register({
        name: name.trim(),
        email: email.trim(),
        password,
        password_confirmation: confirm,
      });
      if (user) {
        onOpenChange(false);
        resetForm();
      } else {
        setVerifyHint(true);
      }
    } catch (err) {
      setFormError(toUserMessage(err, t('auth.registerFailed')));
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setName('');
    setEmail('');
    setPassword('');
    setConfirm('');
    setVerifyHint(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) resetForm();
      }}
      title={t('auth.registerTitle')}
      description={t('auth.registerDesc')}
    >
      {verifyHint ? (
        <div className="flex flex-col gap-3">
          <p className="text-body text-text-1">
            <Trans
              i18nKey="auth.emailVerifyHint"
              values={{ email }}
              components={{ 1: <span className="font-semibold" /> }}
            />
          </p>
          <Button onClick={() => onSwitchToLogin()} fullWidth>
            {t('auth.toLoginPage')}
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Input
            id="register-name"
            label={t('auth.name')}
            autoComplete="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={submitting || isLoading}
          />
          <Input
            id="register-email"
            label={t('auth.email')}
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={submitting || isLoading}
          />
          <Input
            id="register-password"
            label={t('auth.password')}
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitting || isLoading}
          />
          <Input
            id="register-confirm"
            label={t('auth.confirmPassword')}
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            disabled={submitting || isLoading}
          />
          {formError && <p className="text-caption text-error">{formError}</p>}
          <Button type="submit" fullWidth disabled={submitting || isLoading}>
            {submitting ? t('auth.registerButtonLoading') : t('auth.registerButton')}
          </Button>
          <button
            type="button"
            className="mt-1 text-caption text-text-2 hover:text-text-1 hover:underline"
            onClick={onSwitchToLogin}
          >
            {t('auth.haveAccount')}
          </button>
        </form>
      )}
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
