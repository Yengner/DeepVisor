'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useMediaQuery } from '@mantine/hooks';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { buildAgeGenderAudienceChart, normalizeGender, type AudienceObservation } from '@/lib/shared/reports/audience';
import type { AudienceView, BreakdownMetric } from '@/lib/shared/reports/breakdowns';
import { audienceTakeaway } from '@/lib/shared/performance/takeaways';
import { metricText } from './format';
import styles from './WhoWhen.module.css';

const METRICS = ['spend', 'conversion', 'costPerResult', 'impressions', 'clicks', 'ctr'] as const;
const COLORS: Record<string, string> = { Female: '#9779c5', Male: '#477fc2', Unknown: '#9da8b9', total: 'var(--chart)' };

/** Who saw the ads: age and gender, from Meta's own breakdown. */
export default function AudienceChart({ rows, currency }: { rows: AudienceObservation[]; currency: string | null }) {
  const t = useTranslations('whoWhen');
  const locale = useLocale() === 'es' ? 'es-US' : 'en-US';
  const touch = useMediaQuery('(hover: none)');
  const [view, setView] = useState<AudienceView>('age_gender');
  const [metric, setMetric] = useState<(typeof METRICS)[number]>('spend');
  const model = buildAgeGenderAudienceChart(rows, metric as BreakdownMetric, view);
  const format = (value: number | null) => metricText(value, metric, currency, locale, t('unavailable'));
  const hasResults = rows.some((row) => row.values.conversion != null);
  const gender = (value: string) => t(`gender.${normalizeGender(value)}`);
  const label = t(`metric.${metric}`);
  // The same rule the summary uses: lowest cost per result with enough results, else most spend.
  const top = audienceTakeaway(rows.map((row) => ({ ...row, gender: normalizeGender(row.gender) })));
  const name = (segment: string) => {
    const [who, ...age] = segment.split(' ');
    return `${t(who === 'Women' ? 'gender.Female' : who === 'Men' ? 'gender.Male' : 'people')} ${age.join(' ')}`;
  };
  const series = (key: string) => (key === 'total' ? label : gender(key));
  return (
    <>
      <div className={styles.controls}>
        <div className={styles.segmented} role="group" aria-label={t('audience.dimension')}>
          {(['age_gender', 'age', 'gender'] as const).map((key) => <button key={key} type="button" aria-pressed={view === key} onClick={() => setView(key)}>{t(`audience.view.${key}`)}</button>)}
        </div>
        <select className={styles.select} aria-label={t('audience.metric')} value={metric} onChange={(event) => setMetric(event.target.value as (typeof METRICS)[number])}>
          {METRICS.map((key) => <option key={key} value={key} disabled={!hasResults && (key === 'conversion' || key === 'costPerResult')}>{t(`metric.${key}`)}</option>)}
        </select>
      </div>
      <div className={styles.legend}>{model.series.map((key) => <span key={key}><i style={{ background: COLORS[key] }} />{series(key)}</span>)}</div>
      <div className={styles.audienceChart} role="img" aria-label={t('audience.chartLabel', { metric: label })}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={model.rows.map((row) => ({ ...row, label: view === 'gender' ? gender(row.label) : row.label }))} layout="vertical" margin={{ top: 4, right: 12, bottom: 0, left: 0 }} barSize={model.stacked ? 18 : view === 'age_gender' ? 6 : 20} accessibilityLayer>
            <CartesianGrid horizontal={false} stroke="var(--line)" strokeDasharray="3 5" />
            <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: 'var(--muted)', fontSize: 12 }} tickFormatter={(value) => (metric === 'ctr' ? `${value}%` : new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(value))} />
            <YAxis type="category" dataKey="label" width={66} axisLine={false} tickLine={false} tick={{ fill: 'var(--muted)', fontSize: 12 }} />
            <Tooltip trigger={touch ? 'click' : 'hover'} cursor={{ fill: 'var(--subtle)' }} content={({ active, payload, label: age }) => (active && payload?.length ? (
              <div className={styles.tooltip}>
                <strong>{age} · {label}</strong>
                {payload.map((item) => <div key={String(item.dataKey)}><span>{series(String(item.dataKey))}</span><b>{format(typeof item.value === 'number' ? item.value : null)}</b></div>)}
              </div>
            ) : null)} />
            {model.series.map((key) => <Bar key={key} dataKey={key} stackId={model.stacked ? 'audience' : undefined} fill={COLORS[key]} radius={3} isAnimationActive={false} />)}
          </BarChart>
        </ResponsiveContainer>
      </div>
      {top && (
        <div className={styles.summary}>
          <div><span>{top.basis === 'cost' ? t('audience.bestCost') : t('audience.mostSpend')}</span><strong>{name(top.segment)}</strong></div>
          <div>{top.basis === 'cost'
            ? <><b>{metricText(top.costPerResult, 'costPerResult', currency, locale, t('unavailable'))}</b><small>{t('audience.results', { count: top.results })}</small></>
            : <><b>{metricText(top.spend, 'spend', currency, locale, t('unavailable'))}</b><small>{t('audience.share', { percent: Math.round(top.share * 100) })}</small></>}</div>
        </div>
      )}
    </>
  );
}
