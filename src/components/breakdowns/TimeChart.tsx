'use client';

import { useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { buildTimeAnalysis, type HourlyObservation } from '@/lib/shared/reports/timeAnalysis';
import type { PerformanceMetric } from '@/lib/shared/reports/performance';
import { hourText, metricText, weekdayText } from './format';
import styles from './WhoWhen.module.css';

const METRICS = ['spend', 'conversion', 'costPerResult', 'impressions', 'clicks', 'ctr', 'cpc'] as const;
/** A square-root scale keeps small hours visible; the exact value is shown for the selected cell. */
const intensity = (value: number | null, maximum: number) => (value !== null && value > 0 && maximum > 0 ? Math.min(1, Math.sqrt(value / maximum)) : 0);

/** When the ads delivered: one day as hourly bars, longer periods as a weekday-by-hour grid. */
export default function TimeChart({ rows, currency, today }: { rows: HourlyObservation[]; currency: string | null; today: boolean }) {
  const t = useTranslations('whoWhen');
  const locale = useLocale() === 'es' ? 'es-US' : 'en-US';
  const [metric, setMetric] = useState<(typeof METRICS)[number]>('spend');
  const [mode, setMode] = useState<'total' | 'average'>('total');
  const [selected, setSelected] = useState<string | null>(null);
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const cells = buildTimeAnalysis({ hourlyTrendExpanded: rows }, metric as PerformanceMetric, mode, currency);
  const todayDay = cells.find((cell) => cell.observations)?.day;
  const shown = today ? cells.filter((cell) => cell.day === todayDay) : cells;
  const maximum = Math.max(0, ...shown.map((cell) => cell.value ?? 0));
  const peak = shown.reduce<(typeof shown)[number] | undefined>((best, cell) => (cell.value !== null && (best?.value == null || cell.value > best.value) ? cell : best), undefined);
  const current = shown.find((cell) => cell.key === selected) ?? peak ?? shown.find((cell) => cell.observations) ?? shown[0];
  const format = (value: number | null) => metricText(value, metric, currency, locale, t('unavailable'));
  const hasResults = rows.some((row) => row.results !== null);
  const isRatio = Boolean(cells[0]?.isRatio);
  const label = t(`metric.${metric}`);
  const when = (cell: { day: number; hour: number }) => `${today ? t('time.thisDay') : weekdayText(cell.day, locale, 'long')} · ${hourText(cell.hour, locale)}`;
  return (
    <>
      <div className={styles.controls}>
        <select className={styles.select} aria-label={t('time.metric')} value={metric} onChange={(event) => setMetric(event.target.value as (typeof METRICS)[number])}>
          {METRICS.map((key) => <option key={key} value={key} disabled={!hasResults && (key === 'conversion' || key === 'costPerResult')}>{t(`metric.${key}`)}</option>)}
        </select>
        {!today && (
          <div className={styles.segmented} role="group" aria-label={t('time.calculation')}>
            {(['total', 'average'] as const).map((value) => <button key={value} type="button" disabled={isRatio} aria-pressed={mode === value} onClick={() => setMode(value)}>{t(`time.${value}`)}</button>)}
          </div>
        )}
      </div>
      <div className={styles.heatScroll} role="region" aria-label={today ? t('time.dayChart') : t('time.weekChart')} tabIndex={0}>
        {today ? (
          <div className={styles.hourBars}>
            {shown.map((cell) => (
              <button type="button" key={cell.key} className={styles.hourBar} data-missing={cell.value === null} aria-label={`${hourText(cell.hour, locale)}: ${format(cell.value)}`} aria-pressed={current?.key === cell.key}
                onFocus={() => setSelected(cell.key)} onMouseEnter={() => setSelected(cell.key)} onClick={() => setSelected(cell.key)}>
                <span style={{ height: cell.value === null ? '100%' : `${maximum ? (cell.value / maximum) * 100 : 0}%` }} />
                <small>{cell.hour % 6 === 0 ? hourText(cell.hour, locale) : ''}</small>
              </button>
            ))}
          </div>
        ) : (
          <div className={styles.heatGrid}>
            <span />
            {Array.from({ length: 24 }, (_, hour) => <span className={styles.hourLabel} key={hour}>{hour % 6 === 0 ? hourText(hour, locale) : ''}</span>)}
            {Array.from({ length: 7 }, (_, day) => (
              <div className={styles.heatRow} key={day}>
                <span className={styles.dayLabel}>{weekdayText(day, locale, 'short')}</span>
                {cells.filter((cell) => cell.day === day).map((cell) => {
                  const index = cell.day * 24 + cell.hour;
                  return (
                    <button type="button" key={cell.key} ref={(element) => { refs.current[index] = element; }} className={styles.heatCell} data-missing={cell.value === null} data-zero={cell.value === 0}
                      tabIndex={current?.key === cell.key ? 0 : -1} aria-pressed={current?.key === cell.key} aria-label={`${when(cell)}. ${label}: ${format(cell.value)}`}
                      style={cell.value !== null && cell.value > 0 ? { background: `color-mix(in srgb, var(--chart) ${12 + intensity(cell.value, maximum) * 88}%, var(--panel))` } : undefined}
                      onMouseEnter={() => setSelected(cell.key)} onFocus={() => setSelected(cell.key)} onClick={() => setSelected(cell.key)}
                      onKeyDown={(event) => {
                        const offset = ({ ArrowRight: 1, ArrowLeft: -1, ArrowDown: 24, ArrowUp: -24 } as Record<string, number>)[event.key];
                        if (offset !== undefined) { event.preventDefault(); refs.current[Math.max(0, Math.min(167, index + offset))]?.focus(); }
                      }} />
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className={styles.summary} aria-live="polite" aria-atomic="true">
        <div><span>{t('time.selected')}</span><strong>{current ? when(current) : t('unavailable')}</strong></div>
        <div><b>{format(current?.value ?? null)}</b><small>{label}{!today && !isRatio && mode === 'average' ? ` · ${t('time.average')}` : ''}</small></div>
      </div>
    </>
  );
}
