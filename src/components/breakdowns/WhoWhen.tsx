'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import type { AudienceObservation } from '@/lib/shared/reports/audience';
import type { HourlyObservation } from '@/lib/shared/reports/timeAnalysis';
import AudienceChart from './AudienceChart';
import TimeChart from './TimeChart';
import styles from './WhoWhen.module.css';

export type DateSpan = { since: string; until: string };

type Props = {
  /** Null: could not be read. Empty: Meta reported nothing for this selection. */
  audience: AudienceObservation[] | null;
  hourly: HourlyObservation[] | null;
  currency: string | null;
  today: boolean;
  /** The dates the audience rows cover, when they aren't dated one day at a time. */
  audienceRange?: DateSpan | null;
  /** Why a chart is missing, when there is a specific reason. */
  audienceMissing?: string;
  hourlyMissing?: string;
  /** Link to the matching Reports sections (dashboard only). */
  reports?: boolean;
  /** One column, for the ad set drawer. */
  stacked?: boolean;
};

/** The first and last day present in dated rows: what the chart really covers. */
const span = (days: Array<string | null>): DateSpan | null => {
  const sorted = days.filter((day): day is string => Boolean(day)).sort();
  return sorted.length ? { since: sorted[0], until: sorted[sorted.length - 1] } : null;
};

export default function WhoWhen({ audience, hourly, currency, today, audienceRange, audienceMissing, hourlyMissing, reports = false, stacked = false }: Props) {
  const t = useTranslations('whoWhen');
  const locale = useLocale() === 'es' ? 'es-US' : 'en-US';
  const date = (day: string) => new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${day}T12:00:00Z`));
  const covers = (range: DateSpan | null) => (range ? (range.since === range.until ? date(range.since) : t('range', { since: date(range.since), until: date(range.until) })) : null);
  const audienceCovers = covers(audienceRange !== undefined ? audienceRange : span((audience ?? []).map((row) => row.date)));
  const hourlyCovers = covers(span((hourly ?? []).map((row) => row.dayKey)));
  const panel = (key: 'audience' | 'time', coverage: string | null, missing: string, children: React.ReactNode | null) => (
    <section className={styles.panel} aria-labelledby={`who-when-${key}`}>
      <header className={styles.header}>
        <div>
          <h3 id={`who-when-${key}`}>{t(`${key}.title`)}</h3>
          {coverage && children && <p>{t('covers', { range: coverage })}</p>}
        </div>
        {reports && <Link href={`/reports#${key}`}>{t(`${key}.report`)}</Link>}
      </header>
      {children ?? <p className={styles.empty}>{missing}</p>}
    </section>
  );
  return (
    <div className={styles.grid} data-stacked={stacked ? '' : undefined}>
      {panel('audience', audienceCovers, audienceMissing ?? t(audience === null ? 'failed' : 'none'),
        audience?.length ? <AudienceChart rows={audience} currency={currency} /> : null)}
      {panel('time', hourlyCovers, hourlyMissing ?? t(hourly === null ? 'failed' : 'none'),
        hourly?.length ? <TimeChart rows={hourly} currency={currency} today={today} /> : null)}
    </div>
  );
}
