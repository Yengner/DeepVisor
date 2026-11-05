'use client';
import { useState } from 'react';
import { useMediaQuery } from '@mantine/hooks';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { buildAgeGenderAudienceChart, type AudienceObservation } from '@/lib/shared/reports/audience';
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
  return <>
    <div className={styles.controls}><div className={styles.segmented} role="group" aria-label="Audience dimension">{([['age_gender', 'Age × Gender'], ['age', 'Age'], ['gender', 'Gender']] as const).map(([key, text]) => <button key={key} type="button" aria-pressed={view === key} onClick={() => setView(key)}>{text}</button>)}</div><label className={styles.select}><span className={styles.srOnly}>Audience metric</span><select aria-label="Audience metric" value={metric} onChange={e => setMetric(e.target.value as PerformanceMetric)}>{METRICS.map(([key, text]) => <option key={key} value={key} disabled={!hasResults && (key === 'conversion' || key === 'costPerResult')}>{text}{!hasResults && (key === 'conversion' || key === 'costPerResult') ? ' · unavailable' : ''}</option>)}</select></label></div>
    <div className={styles.legend}>{model.series.map(key => <span key={key}><i style={{ background: COLORS[key] }} />{key === 'total' ? label : key}</span>)}<small>{model.stacked ? 'Stacked totals' : view === 'age_gender' ? 'Rates by gender' : label}{currency && ['spend', 'costPerResult'].includes(metric) ? ` · ${currency}` : ''}</small></div>
    <div className={styles.audienceChart} style={view === 'gender' ? { height: 180 } : undefined} role="img" aria-label={`${label} by ${view === 'gender' ? 'gender' : 'age'}. Exact values are in Segment details below.`}>
      <ResponsiveContainer width="100%" height="100%"><BarChart data={model.rows} layout="vertical" margin={{ top: 4, right: 12, bottom: 0, left: 0 }} barSize={model.stacked ? 20 : view === 'age_gender' ? 6 : 22} accessibilityLayer>
        <CartesianGrid horizontal={false} stroke="var(--ui-line)" strokeDasharray="3 5" />
        <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: 'var(--ui-muted)', fontSize: 10 }} tickFormatter={value => metric === 'ctr' ? `${value}%` : new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value)} />
        <YAxis type="category" dataKey="label" width={59} axisLine={false} tickLine={false} tick={{ fill: 'var(--ui-muted)', fontSize: 11 }} />
        <Tooltip trigger={touch ? 'click' : 'hover'} cursor={{ fill: 'var(--ui-subtle)' }} content={({ active, payload, label: age }) => active && payload?.length ? <div className={styles.tooltip}><strong>{age} · {label}</strong>{model.series.map(key => <div key={key}><span>{key === 'total' ? label : key}</span><b>{format((model.rows.find(row => row.label === age)?.[key as 'total' | 'Female' | 'Male' | 'Unknown']) ?? null)}</b></div>)}</div> : null} />
        {model.series.map(key => <Bar key={key} dataKey={key} stackId={model.stacked ? 'audience' : undefined} fill={COLORS[key]} radius={3} isAnimationActive={false} />)}
      </BarChart></ResponsiveContainer>
    </div>
    <p className={styles.note}>{model.stacked ? 'Each bar combines reported gender segments within an age group.' : view === 'age_gender' ? 'Rates use each segment’s aggregate inputs; they are not added together.' : 'Unknown demographics remain included.'}{!hasResults ? ' Results unavailable for this source.' : ''}</p>
    <details className={styles.details}><summary>Segment details</summary><div className={styles.tableScroll} tabIndex={0} role="region" aria-label="Audience segment values"><table><caption>{label}{['ctr', 'costPerResult'].includes(metric) ? ' · recomputed from aggregate inputs' : ''}</caption><thead><tr><th scope="col">{view === 'gender' ? 'Gender' : 'Age'}</th>{model.series.map(key => <th scope="col" key={key}>{key === 'total' ? label : key}</th>)}</tr></thead><tbody>{model.rows.map(row => <tr key={row.label}><th scope="row">{row.label}</th>{model.series.map(key => <td key={key}>{format(row[key as keyof typeof row] as number | null)}</td>)}</tr>)}</tbody></table></div></details>
  </>;
}
