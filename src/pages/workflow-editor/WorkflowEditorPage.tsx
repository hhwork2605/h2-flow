/**
 * WorkflowEditorPage — entry point cho `workflow-editor.html` popup window.
 *
 * Layer: Page
 * Owner: pages/workflow-editor
 *
 * Mở qua `chrome.windows.create({ url: 'workflow-editor.html?wf=<id>' })`
 * từ sidebar WorkflowTab. Đọc `wf` query param để load workflow tương ứng.
 *
 * QUAN TRỌNG (P3.10 follow-up): popup window là 1 React tree HOÀN TOÀN TÁCH
 * KHỎI sidebar. Cần tự setup `QueryClientProvider` + `useAuthBootstrap` để
 * `useEntitlements()` / `useFeatureGate()` chạy được — nếu thiếu, plan luôn
 * fallback 'free' khiến PRO user thấy badge FREE + limit nodes 5.
 */

import { useEffect, useMemo } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/api/queryClient';
import { ThemeProvider } from '@/ui/theme/ThemeProvider';
import { I18nProvider } from '@/i18n/I18nProvider';
import { RootOverlays } from '@/shared/overlays/RootOverlays';
import { WorkflowEditor } from '@/features/workflow/components/WorkflowEditor';
import { useAuthStore, wireAuthCrossContextSync } from '@/features/auth/store/auth.store';

/**
 * Bootstrap auth state nhẹ-cân hơn sidebar: chỉ hydrate token từ chrome.storage,
 * KHÔNG gọi /auth/me verify (sidebar đã làm rồi; popup re-mount nhiều lần khi
 * user mở/đóng workflow → tránh duplicate /me request).
 */
function useAuthHydrate(): void {
  useEffect(() => {
    wireAuthCrossContextSync();
    void useAuthStore.getState().hydrate();
  }, []);
}

function WorkflowEditorRoot() {
  useAuthHydrate();
  const workflowId = useMemo(() => {
    if (typeof window === 'undefined') return undefined;
    const params = new URLSearchParams(window.location.search);
    return params.get('wf') ?? undefined;
  }, []);
  return (
    <div className="h-full w-full">
      <WorkflowEditor workflowId={workflowId} />
    </div>
  );
}

export function WorkflowEditorPage() {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <ThemeProvider>
          <WorkflowEditorRoot />
          <RootOverlays />
        </ThemeProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}
