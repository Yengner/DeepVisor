'use client';

import { useTranslations } from 'next-intl';

function prettifyCode(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/**
 * Plain wording for the codes Meta sends back (objectives, optimization goals, statuses).
 * Known codes use the translated labels; anything else falls back to a readable version
 * of the code, so a new Meta value never shows up blank.
 */
export function useCodeLabels() {
  const t = useTranslations('labels');

  return {
    objective(value: string): string {
      const key = `objective.${value}` as never;
      return t.has(key) ? t(key) : prettifyCode(value);
    },
    status(value: string): string {
      const key = `status.${value.toUpperCase()}` as never;
      return t.has(key) ? t(key) : prettifyCode(value);
    },
  };
}
