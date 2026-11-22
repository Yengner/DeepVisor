'use client';

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { lifecycleExplanation, type LifecycleTranslate } from '@/lib/shared/lifecycle/explanationText';

/** Words a saved lifecycle explanation in the reader's language; an unknown sentence keeps its saved English. */
export function useLifecycleExplanation() {
  const t = useTranslations('lifecycleText');
  return useCallback(
    (explanation: string) => lifecycleExplanation(explanation, t as unknown as LifecycleTranslate),
    [t]
  );
}
