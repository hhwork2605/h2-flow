/**
 * AuthHeaderControl — sign-in button + signed-in dropdown for the sidebar header.
 *
 * Layer: UI
 * Owner: features/auth
 *
 * Phase 1 minimal version: open Login/Register modals + show user avatar +
 * logout. Phase 1 follow-up adds plan badge, referral link, settings, etc.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { LogIn, LogOut, User as UserIcon } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Button } from '@/ui/components/Button';
import { useAuth } from '../hooks/useAuth';
import { LoginModal } from './LoginModal';
import { RegisterModal } from './RegisterModal';

export function AuthHeaderControl() {
  const { t } = useTranslation();
  const { isAuthenticated, user, logout } = useAuth();
  const [loginOpen, setLoginOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);

  if (!isAuthenticated) {
    return (
      <>
        <Button size="sm" onClick={() => setLoginOpen(true)}>
          <LogIn className="h-3.5 w-3.5" />
          {t('header.signIn')}
        </Button>
        <LoginModal
          open={loginOpen}
          onOpenChange={setLoginOpen}
          onSwitchToRegister={() => {
            setLoginOpen(false);
            setRegisterOpen(true);
          }}
        />
        <RegisterModal
          open={registerOpen}
          onOpenChange={setRegisterOpen}
          onSwitchToLogin={() => {
            setRegisterOpen(false);
            setLoginOpen(true);
          }}
        />
      </>
    );
  }

  const initials = (user?.name ?? user?.email ?? '?').slice(0, 1).toUpperCase();

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label="Open user menu"
          className={cn(
            'grid h-8 w-8 place-items-center rounded-full',
            'bg-brand-500 text-white text-caption font-semibold',
            'hover:ring-2 hover:ring-brand-500/40',
          )}
        >
          {user?.avatar_url ? (
            <img src={user.avatar_url} alt="" className="h-full w-full rounded-full object-cover" />
          ) : (
            initials
          )}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className={cn(
            'z-dropdown min-w-[200px] rounded-md border border-border bg-bg-overlay p-1 shadow-lg',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
          )}
        >
          <div className="px-2 py-2">
            <div className="truncate text-body font-medium text-text-1">{user?.name ?? user?.email}</div>
            {user?.email && (
              <div className="truncate text-caption text-text-2">{user.email}</div>
            )}
          </div>
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          <DropdownMenu.Item
            className={cn(
              'flex cursor-pointer items-center gap-2 rounded px-2 py-1.5',
              'text-body text-text-1 outline-none hover:bg-bg-elevate focus:bg-bg-elevate',
            )}
            disabled
          >
            <UserIcon className="h-3.5 w-3.5" /> {t('header.account')}
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className={cn(
              'flex cursor-pointer items-center gap-2 rounded px-2 py-1.5',
              'text-body text-error outline-none hover:bg-bg-elevate focus:bg-bg-elevate',
            )}
            onSelect={() => {
              void logout();
            }}
          >
            <LogOut className="h-3.5 w-3.5" /> {t('header.signOut')}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
