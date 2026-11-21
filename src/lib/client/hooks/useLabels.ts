import { useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { humanizeObjective } from '@/lib/shared/reports/labels';

/**
 * Owner-facing labels for raw Meta values (statuses, objectives, devices) and the display dates
 * the server already formatted in English ("Aug 20, 2025", "Schedule ended Jun 18, 2025"), in the
 * reader's language. Anything unknown falls back to the English helper, never to a raw key.
 */
export function useLabels() {
  const t = useTranslations('labels');
  const intl = useLocale() === 'es' ? 'es-US' : 'en-US';
  return useMemo(() => {
    const pick = (path: string, fallback: string) => (t.has(path as never) ? t(path as never) : fallback);
    const date = (value: string) => {
      const parsed = Date.parse(value);
      if (!/[A-Za-z]{3} \d{1,2}, \d{4}/.test(value) || !Number.isFinite(parsed)) return value;
      return new Intl.DateTimeFormat(intl, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(parsed));
    };
    return {
      /** English status label (from statusPresentation) or a raw Meta status → reader's language. */
      status: (label: string) => pick(`status.${label.replaceAll('_', ' ')}`, label),
      objective: (raw?: string | null) => {
        const english = humanizeObjective(raw);
        return raw ? pick(`objective.${raw.toUpperCase()}`, english) : english;
      },
      device: (raw: string, english: string) => pick(`device.${raw.toLowerCase()}`, english),
      /** "Today", an English display date, or "Schedule ended <date>" → reader's language. */
      displayDate: (value: string | null | undefined) => {
        if (!value || value === '—') return '—';
        if (value === 'Today') return t('today');
        const ended = /^Schedule ended (.+)$/.exec(value);
        if (ended) return t('scheduleEnded', { date: date(ended[1]) });
        return date(value);
      },
    };
  }, [t, intl]);
}
