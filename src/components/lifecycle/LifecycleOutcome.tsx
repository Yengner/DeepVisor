'use client';
import { useEffect, useState } from 'react';
import { ArrowRight, Clock3 } from 'lucide-react';
import type { LifecycleOutcome } from '@/lib/shared/lifecycle/outcome';
import { MIN_OUTCOME_DAYS } from '@/lib/shared/lifecycle/outcome';
import { formatReportDay, formatReportRange } from '@/lib/shared/reports/labels';
import { shiftReportDay } from '@/lib/shared/reports/dates';
import styles from './LifecycleOutcome.module.css';

export type Outcome = LifecycleOutcome & { currency: string | null; timezone: string | null };
const range = (r: { from: string; to: string }) => r.from === r.to ? formatReportDay(r.from) : formatReportRange(r.from, r.to);

function Change({ value, favorable }: { value: number | null; favorable: boolean | null }) {
  if (value === null) return <span className={styles.change} data-tone="neutral">No earlier baseline</span>;
  const tone = favorable === null || value === 0 ? 'neutral' : (value > 0) === favorable ? 'up' : 'down';
  return <span className={styles.change} data-tone={tone}>{value > 0 ? '▲' : value < 0 ? '▼' : ''} {Math.abs(value).toFixed(1)}%</span>;
}

/**
 * Live before/after for a saved lifecycle change. Only days observed on both sides are compared;
 * missing days stay gaps. Loads separately so the saved report never waits on it.
 */
export function LifecycleOutcomeSection({ id }: { id: string }) {
  const [data, setData] = useState<Outcome | null>(null), [failed, setFailed] = useState(false), [metric, setMetric] = useState<'spend' | 'results'>('spend');
  useEffect(() => {
    const c = new AbortController();
    fetch(`/api/lifecycle/${id}/outcome`, { signal: c.signal, cache: 'no-store' })
      .then(async r => { if (!r.ok) throw new Error(); setData(await r.json()); })
      .catch(() => { if (!c.signal.aborted) setFailed(true); });
    return () => c.abort();
  }, [id]);
  if (failed || !data) return <section className={styles.section} aria-busy={!failed || undefined}><h3>Before and after this change</h3><p className={styles.note}>{failed ? 'The comparison couldn’t be loaded. The saved report above is unaffected.' : 'Loading saved daily results…'}</p></section>;
  return <LifecycleOutcomeView id={id} data={data} metric={metric} onMetric={setMetric} />;
}

export function LifecycleOutcomeView({ id, data, metric, onMetric }: { id: string; data: Outcome; metric: 'spend' | 'results'; onMetric: (m: 'spend' | 'results') => void }) {
  const setMetric = onMetric;

  const money = (v: number | null) => v === null ? '—' : data.currency ? new Intl.NumberFormat('en', { style: 'currency', currency: data.currency, maximumFractionDigits: 2 }).format(v) : `${v.toFixed(2)} (currency unknown)`;
  const count = (v: number | null) => v === null ? '—' : v.toLocaleString('en');
  const values = data.series.map(d => d[metric]).filter((v): v is number => v !== null);
  const max = Math.max(1, ...values);
  const readyOn = shiftReportDay(data.changeDay, MIN_OUTCOME_DAYS + 1);

  return <section className={styles.section} aria-labelledby={`outcome-${id}`}>
    <div className={styles.head}>
      <div>
        <h3 id={`outcome-${id}`}>Before and after this change</h3>
        <p className={styles.note}>Change on {formatReportDay(data.changeDay)} · that day is left out because it’s partly before and partly after.</p>
      </div>
      <div className={styles.segment} role="group" aria-label="Chart metric">
        {(['spend', 'results'] as const).map(m => <button key={m} type="button" aria-pressed={metric === m} onClick={() => setMetric(m)}>{m === 'spend' ? 'Spend' : 'Results'}</button>)}
      </div>
    </div>

    {data.state === 'compared' && data.beforeTotals && data.afterTotals && <>
      {data.compared && <p className={styles.window}>{range(data.compared.before)} <ArrowRight size={12} aria-hidden="true" /> {range(data.compared.after)} · {data.matchedDays} matched {data.matchedDays === 1 ? 'day' : 'days'}</p>}
      <dl className={styles.compare}>
        <div><dt>Results</dt><dd>{count(data.beforeTotals.results)} <ArrowRight size={14} aria-hidden="true" /> <strong>{count(data.afterTotals.results)}</strong></dd><Change value={data.resultsChange} favorable /></div>
        <div><dt>Spend</dt><dd>{money(data.beforeTotals.spend)} <ArrowRight size={14} aria-hidden="true" /> <strong>{money(data.afterTotals.spend)}</strong></dd><Change value={data.spendChange} favorable={null} /></div>
        <div><dt>Cost / result</dt><dd>{money(data.beforeTotals.cpr)} <ArrowRight size={14} aria-hidden="true" /> <strong>{money(data.afterTotals.cpr)}</strong></dd></div>
      </dl>
    </>}
    {data.state === 'no-delivery-after' && data.beforeTotals && <div className={styles.callout}>
      <strong>No spend recorded for these ads since the change</strong>
      <p>The account was synced on {data.syncedDaysAfter} of the {data.completedDaysAfter} completed days since, and these ads have no delivery on any of them. In the {range(data.before)} before, they spent {money(data.beforeTotals.spend)} for {count(data.beforeTotals.results)} results.</p>
    </div>}
    {data.state === 'too-early' && <div className={styles.callout} data-tone="wait">
      <Clock3 size={16} aria-hidden="true" />
      <div><strong>Too early to compare</strong><p>{data.completedDaysAfter} completed {data.completedDaysAfter === 1 ? 'day has' : 'days have'} passed since the change. The comparison appears once there are {MIN_OUTCOME_DAYS}, around {formatReportDay(readyOn)}.</p></div>
    </div>}
    {data.state === 'insufficient' && <div className={styles.callout} data-tone="gap">
      <strong>Not enough matching days to compare</strong>
      <p>{data.matchedDays === 0 ? 'No day has' : `Only ${data.matchedDays} ${data.matchedDays === 1 ? 'day has' : 'days have'}`} spend and results on both sides of the change (at least {MIN_OUTCOME_DAYS} are needed). Days without saved records are gaps, not zero.</p>
    </div>}

    <div className={styles.chart} role="img" aria-label={`Daily ${metric} from ${formatReportDay(data.series[0]?.day)} to ${formatReportDay(data.series.at(-1)?.day)}, change on ${formatReportDay(data.changeDay)}. Values are in the table below.`}>
      {data.series.map(d => <div key={d.day} className={styles.col} data-side={d.side} data-unpaired={(data.state === 'compared' && d.side !== 'change' && !d.paired) || undefined}>
        <div className={styles.track}>
          {d.side === 'change' ? <span className={styles.marker} title={`Change · ${formatReportDay(d.day)}`} />
            : d[metric] === null ? <span className={styles.gapBar} title={`${formatReportDay(d.day)}: no saved record`} />
            : d[metric] === 0 ? <span className={styles.zero} title={`${formatReportDay(d.day)}: ${metric === 'spend' ? money(0) : '0 results'} (observed)`} />
            : <span className={styles.bar} style={{ height: `${Math.max(3, d[metric]! / max * 100)}%` }} title={`${formatReportDay(d.day)}: ${metric === 'spend' ? money(d.spend) : count(d.results)}`} />}
        </div>
        <span className={styles.tick}>{d.side === 'change' ? <span className={styles.changeLabel}>Change</span> : formatReportDay(d.day, false).replace(/^\w+ /, '')}</span>
      </div>)}
    </div>
    <div className={styles.legend} aria-hidden="true"><span data-side="change">Change day</span><span data-side="before">Before</span><span data-side="after">After</span><span data-side="zero">Recorded zero</span><span data-side="gap">No saved record</span>{data.state === 'compared' && data.series.some(d => d.side !== 'change' && !d.paired) ? <span data-side="unpaired">Not compared</span> : null}</div>

    <details className={styles.details}><summary>View daily values</summary>
      <table><thead><tr><th>Date</th><th>Period</th><th>Spend</th><th>Results</th></tr></thead>
        <tbody>{data.series.map(d => <tr key={d.day}><td>{formatReportDay(d.day)}</td><td>{d.side === 'change' ? 'Change day' : d.side === 'before' ? 'Before' : 'After'}</td><td>{money(d.spend)}</td><td>{count(d.results)}</td></tr>)}</tbody>
      </table>
      <p className={styles.note}>Day 1 after the change is compared with day 1 before it, and so on, using only days with spend and results on both sides. Results are Meta-reported leads, conversations and calls.</p>
    </details>
  </section>;
}
