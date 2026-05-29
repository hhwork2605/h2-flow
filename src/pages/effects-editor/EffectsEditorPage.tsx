import { ThemeProvider } from '@/ui/theme/ThemeProvider';
import { I18nProvider } from '@/i18n/I18nProvider';
import { RootOverlays } from '@/shared/overlays/RootOverlays';

export function EffectsEditorPage() {
  return (
    <I18nProvider>
      <ThemeProvider>
        <main className="flex h-full w-full items-center justify-center bg-bg-base text-text-1">
          <div className="text-center">
            <h1 className="text-title">Effects Editor</h1>
            <p className="text-body text-text-2">
              Placeholder — implemented in Phase 6 (see docs/12-implementation-roadmap.md).
            </p>
          </div>
        </main>
        <RootOverlays />
      </ThemeProvider>
    </I18nProvider>
  );
}
