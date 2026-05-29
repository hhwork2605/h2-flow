import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/api/queryClient';
import { ThemeProvider } from '@/ui/theme/ThemeProvider';
import { I18nProvider } from '@/i18n/I18nProvider';
import { useAuthBootstrap } from '@/features/auth/hooks/useAuthBootstrap';
import { useBootstrapPublicConfig } from '@/core/useBootstrapPublicConfig';
import { RootOverlays } from '@/shared/overlays/RootOverlays';
import { ToastViewport } from '@/ui/components/Toast';
import { ConfirmDialogViewport } from '@/ui/components/ConfirmDialog';
import { TabRouter } from './TabRouter';

function BootstrapShell() {
  // Sidebar is the authoritative auth context — verify token on mount.
  useAuthBootstrap({ verifyOnMount: true });
  // Warm the React Query cache with public configs + entitlements.
  useBootstrapPublicConfig();
  return (
    <>
      <TabRouter />
      <RootOverlays />
      <ToastViewport />
      <ConfirmDialogViewport />
    </>
  );
}

export function App() {
  return (
    <I18nProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <BootstrapShell />
        </ThemeProvider>
      </QueryClientProvider>
    </I18nProvider>
  );
}
