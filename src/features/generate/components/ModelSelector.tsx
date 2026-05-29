/**
 * ModelSelector — model dropdown filtered by provider + mediaType.
 *
 * Layer: UI
 * Owner: features/generate
 */

import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Select } from '@/ui/components/Select';
import { useModels } from '@/core/useModelRegistry';
import { useGenerateStore } from '../store/generate.store';

export function ModelSelector() {
  const { t } = useTranslation();
  const provider = useGenerateStore((s) => s.provider);
  const mediaType = useGenerateStore((s) => s.mediaType);
  const model = useGenerateStore((s) => s.model);
  const setModel = useGenerateStore((s) => s.setModel);
  const models = useModels(provider, mediaType);

  // Auto-pick default model when the current selection no longer matches the
  // active provider × mediaType combination.
  useEffect(() => {
    if (models.length === 0) return;
    if (!models.some((m) => m.value === model)) {
      const def = models.find((m) => m.is_default) ?? models[0];
      if (def) setModel(def.value);
    }
  }, [models, model, setModel]);

  const options = useMemo(
    () =>
      models.map((m) => ({
        value: m.value,
        label: m.name,
        badge: m.is_premium ? 'Pro' : undefined,
      })),
    [models],
  );

  return (
    <div className="flex flex-col gap-1">
      <label className="text-caption text-text-2">{t('generate.modelLabel')}</label>
      <Select
        value={model}
        onValueChange={setModel}
        options={options}
        ariaLabel={t('generate.modelLabel')}
        placeholder={t('generate.modelPlaceholder')}
        size="sm"
      />
    </div>
  );
}
