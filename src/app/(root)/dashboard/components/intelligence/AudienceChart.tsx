'use client';
import { useState } from 'react';
import { useMediaQuery } from '@mantine/hooks';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { buildAgeGenderAudienceChart, normalizeGender, type AudienceObservation } from '@/lib/shared/reports/audience';
import type { AudienceView } from '@/lib/shared/reports/breakdowns';
import { performanceValueLabel, type PerformanceMetric } from '@/lib/shared/reports/performance';
import styles from './Intelligence.module.css';

const METRICS = [['spend', 'Spend'], ['conversion', 'Results'], ['impressions', 'Impressions'], ['clicks', 'Clicks'], ['ctr', 'CTR'], ['costPerResult', 'Cost per result']] as const;
const COLORS: Record<string, string> = { Female: '#9779c5', Male: '#477fc2', Unknown: '#9da8b9', total: 'var(--chart-line)' };
export default function AudienceChart({ rows, currency }: { rows: AudienceObservation[]; currency: string | null }) {
  const touch = useMediaQuery('(hover: none)');
  const [view, setView] = useState<AudienceView>('age_gender');
  const [metric, setMetric] = useState<PerformanceMetric>('spend');
  const model = buildAgeGenderAudienceChart(rows, metric as typeof METRICS[number][0], view);
  const format = (value: number | null) => performanceValueLabel(value, metric, currency);
  const hasResults = rows.some(r => r.values.conversion != null);
  const label = METRICS.find(([key]) => key === metric)![1];
  // Best-performing segment by cost per result (needs ≥2 results); otherwise the biggest spender.
  const segments = new Map<string, { spend: number; results: number | null }>();
  for (const r of rows) {
    const g = normalizeGender(r.gender);
    const key = `${g === 'Female' ? 'Women' : g === 'Male' ? 'Men' : 'Unknown gender'} ${r.age}`;
    const seg = segments.get(key) ?? { spend: 0, results: 0 };
    seg.spend += r.values.spend ?? 0;
    seg.results = seg.results === null || r.values.conversion == null ? null : seg.results + r.values.conversion;
    segments.set(key, seg);
  }
  const ranked = [...segments].filter(([, v]) => v.spend > 0);
  const efficient = ranked.filter(([, v]) => (v.results ?? 0) >= 2).sort((a, b) => a[1].spend / a[1].results! - b[1].spend / b[1].results!)[0];
  const top = efficient ?? ranked.sort((a, b) => b[1].spend - a[1].spend)[0];
  const money = (v: number) => performanceValueLabel(v, 'spend', currency);
  return <>
    <div className={styles.controls}><div className={styles.segmented} role="group" aria-label="Audience dimension">{([['age_gender', 'Age × Gender'], ['age', 'Age'], ['gender', 'Gender']] as const).map(([key, text]) => <button key={key} type="button" aria-pressed={view === key} onClick={() => setView(key)}>{text}</button>)}</div><label className={styles.select}><span className={styles.srOnly}>Audience metric</span><select aria-label="Audience metric" value={metric} onChange={e => setMetric(e.target.value as PerformanceMetric)}>{METRICS.map(([key, text]) => <option key={key} value={key} disabled={!hasResults && (key === 'conversion' || key === 'costPerResult')}>{text}{!hasResults && (key === 'conversion' || key === 'costPerResult') ? ' · unavailable' : ''}</option>)}</select></label></div>
    <div className={styles.legend}>{model.series.map(key => <span key={key}><i style={{ background: COLORS[key] }} />{key === 'total' ? label : key}</span>)}<small>{model.stacked ? 'Stacked totals' : view === 'age_gender' ? 'Rates by gender' : label}{currency && ['spend', 'costPerResult'].includes(metric) ? ` · ${currency}` : ''}</small></div>
    <div className={styles.audienceChart} style={view === 'gender' ? { height: 180 } : undefined} role="img" aria-label={`${label} by ${view === 'gender' ? 'gender' : 'age'}.`}>
      <ResponsiveContainer width="100%" height="100%"><BarChart data={model.rows} layout="vertical" margin={{ top: 4, right: 12, bottom: 0, left: 0 }} barSize={model.stacked ? 20 : view === 'age_gender' ? 6 : 22} accessibilityLayer>
        <CartesianGrid horizontal={false} stroke="var(--ui-line)" strokeDasharray="3 5" />
        <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: 'var(--ui-muted)', fontSize: 10 }} tickFormatter={value => metric === 'ctr' ? `${value}%` : new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value)} />
        <YAxis type="category" dataKey="label" width={59} axisLine={false} tickLine={false} tick={{ fill: 'var(--ui-muted)', fontSize: 11 }} />
        <Tooltip trigger={touch ? 'click' : 'hover'} cursor={{ fill: 'var(--ui-subtle)' }} content={({ active, payload, label: age }) => active && payload?.length ? <div className={styles.tooltip}><strong>{age} · {label}</strong>{model.series.map(key => <div key={key}><span>{key === 'total' ? label : key}</span><b>{format((model.rows.find(row => row.label === age)?.[key as 'total' | 'Female' | 'Male' | 'Unknown']) ?? null)}</b></div>)}</div> : null} />
        {model.series.map(key => <Bar key={key} dataKey={key} stackId={model.stacked ? 'audience' : undefined} fill={COLORS[key]} radius={3} isAnimationActive={false} />)}
      </BarChart></ResponsiveContainer>
    </div>
    {top && <div className={styles.topSegment}>
      <div><span>{efficient ? 'Best cost per result' : 'Top spending segment'}</span><strong>{top[0]}</strong></div>
      <div>{efficient ? <><b>{money(top[1].spend / top[1].results!)}</b><small>{top[1].results} results · {money(top[1].spend)} spend</small></> : <><b>{money(top[1].spend)}</b><small>spend{top[1].results !== null ? ` · ${top[1].results} results` : ''}</small></>}</div>
    </div>}
  </>;
}
