'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import { Modal } from '@mantine/core';
import { AlertTriangle, Archive, ArrowLeft, ChevronRight, CircleAlert, CirclePause, CirclePlay, Flag, History, Info, LineChart, PlugZap, RotateCcw } from 'lucide-react';
import { useMediaQuery } from '@mantine/hooks';
import SpiderMascot from '@/components/brand/SpiderMascot';
import StatusBanner from '@/components/ui/states/StatusBanner';
import { recapChart } from '@/lib/shared/insights/hourly';
import { issueLevel, urgentIssues, headline, LIFECYCLE_LABEL, lifecycleKind, relatedLifecycle } from '@/lib/shared/insights/model';
import type { Issue, LifecycleCard, LifecycleKind, Presentation, Recap, SavedPresentation } from '@/lib/shared/insights/model';
import { formatHour, formatHourShort, formatReportDay, formatReportRange, formatTimezone } from '@/lib/shared/reports/labels';
import { causeFromCode } from '@/lib/shared/insights/health';
import { leadUp } from '@/lib/shared/insights/leadUp';
import { presentationDay } from '@/lib/shared/insights/notification';
import styles from './InsightsView.module.css';
import { InsightDataNotice, MissingObservationTrack } from './InsightDataState';

const number = (v: number | null) => v === null ? '—' : new Intl.NumberFormat('en', { maximumFractionDigits: 0 }).format(v);
function money(v: number | null, currency: string | null) {
  if (v === null) return '—';
  return currency ? new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 2 }).format(v) : `${v.toFixed(2)} (currency unknown)`;
}
const dayRange = (since: string, until: string) => since === until ? formatReportDay(since) : formatReportRange(since, until);
/** Entity schedule timestamps are stored with offsets; show them as a date in the account's timezone. */
function scheduleDate(value: string | null, timezone: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  try { return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: timezone ?? undefined }); }
  catch { return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
}

function Delta({ value, favorable, label }: { value: number; favorable: boolean | null; label: string }) {
  const tone = favorable === null || value === 0 ? 'neutral' : (value > 0) === favorable ? 'up' : 'down';
  return <span className={styles.delta} data-tone={tone}>{value > 0 ? '▲' : value < 0 ? '▼' : ''} {Math.abs(value).toFixed(1)}% <span>{label}</span></span>;
}

function Metrics({ spend, results, cpr, currency, comparison, comparisonLabel }: {
  spend: number | null; results: number | null; cpr: number | null; currency: string | null;
  comparison?: Recap['comparison']; comparisonLabel?: string;
}) {
  return <dl className={styles.metrics}>
    <div><dt>Reported results</dt><dd>{number(results)}</dd>{comparison ? <Delta value={comparison.results} favorable label={comparisonLabel ?? ''} /> : null}</div>
    <div><dt>Spend</dt><dd>{money(spend, currency)}</dd>{comparison ? <Delta value={comparison.spend} favorable={null} label={comparisonLabel ?? ''} /> : null}</div>
    <div><dt>Cost / result</dt><dd>{money(cpr, currency)}</dd></div>
  </dl>;
}

const KIND_ICON: Record<LifecycleKind, typeof Info> = {
  ended: Flag, active: CirclePlay, resumed: CirclePlay, paused: CirclePause, interrupted: CirclePause,
  archived: Archive, rejected: AlertTriangle, update: Info,
};

function Creative({ card, currency, timezone, preview = false }: { card: LifecycleCard; currency: string | null; timezone: string | null; preview?: boolean }) {
  const b = card.brief, creative = b.media.find(m => m.image), config = b.configuration;
  const kind = lifecycleKind(card), ended = kind === 'ended';
  const Icon = KIND_ICON[kind];
  const adLevel = b.affected.length > 0 && b.affected.every(a => a.level === 'ad');
  const ads = b.affected.filter(a => a.level === 'ad').length;
  const count = ads ? `${ads} ${ads === 1 ? 'ad' : 'ads'} affected` : b.affected.length ? `${b.affected.length} affected` : null;
  // Budget owner: the ad set when it holds the budget, otherwise the campaign. Shown by name only.
  const group = config && config.owner !== 'Budget owner unavailable' ? config.owner : null;
  const label = ended ? `${adLevel ? 'Ad' : 'Delivery'} ended · Scheduled end reached` : LIFECYCLE_LABEL[kind];
  const noMetrics = b.spend === null && b.results === null && b.cpr === null;
  // A scheduled end is expected; the timeline already states that missing dates are not zero.
  const missing = !ended && (!creative || !currency || b.spend === null || b.results === null);
  return <section className={styles.lifecycleCard} data-kind={kind} aria-label={`${label}: ${b.title}`}>
    <header className={styles.statusBand}><Icon size={18} aria-hidden="true" /><div><strong>{label}</strong>{count || group ? <span>{[count, group].filter(Boolean).join(' · ')}</span> : null}</div></header>
    <div className={styles.lifecycleBody}>
      <div className={styles.creativeHeading}>
        {creative?.image && <div className={styles.lifecycleCreative}><Image src={creative.image} alt={creative.name} width={72} height={92} unoptimized onError={e => { e.currentTarget.parentElement!.style.display = 'none'; }} />{ended && <span>Ended</span>}</div>}
        <div><h3>{b.title}</h3><p>{b.explanation}</p></div>
      </div>
      {b.provenance === 'reconstructed' && <p className={styles.notice}>Reconstructed from saved state and your confirmation. Exact interruption time is unverified.</p>}
      {ended && <div className={styles.timeline}>
        <div className={styles.timelineLabels}><span>Reporting window starts · {formatReportDay(b.since, false)}</span><strong>Scheduled end reached</strong></div>
        <div className={styles.timelineTrack} aria-hidden="true"><span /><span /></div>
        <p>Observations through {formatReportDay(b.until)} · missing dates are not zero</p>
      </div>}
      {!(ended && noMetrics) && <Metrics spend={b.spend} results={b.results} cpr={b.cpr} currency={currency} />}
      {missing && <div className={styles.dataInset}>
        <InsightDataNotice title="Some advertising details aren’t available">{!creative ? 'No creative preview is saved. ' : ''}{!currency ? 'The account currency is unknown. ' : ''}{b.spend === null || b.results === null ? 'Unavailable metrics are shown as dashes; they do not mean zero.' : 'Available metrics are shown above.'}</InsightDataNotice>
        {!creative && <div className={styles.missingMedia}>Creative preview unavailable</div>}
      </div>}
      <LeadUpSummary card={card} currency={currency} />
      {!ended && <p className={styles.caption}>Affected-ad observations · {dayRange(b.since, b.until)}. Missing dates are not zero.</p>}
      {config && <details className={styles.configDetails}><summary>Schedule, audience &amp; budget</summary>
        <dl>
          <div><dt>Budget</dt><dd>{config.owner} · {config.dailyBudget !== null ? `${money(config.dailyBudget, currency)} daily` : config.lifetimeBudget !== null ? `${money(config.lifetimeBudget, currency)} lifetime` : 'Budget unavailable'}</dd></div>
          <div><dt>Audience</dt><dd>{config.audience} · {config.geography}</dd></div>
          <div><dt>Placements</dt><dd>{config.platforms.length ? config.platforms.join(' / ') : 'Not recorded'}</dd></div>
          {b.affected.slice(0, 5).map(e => <div key={e.id}><dt>Schedule</dt><dd>{e.name}: {scheduleDate(e.start, timezone) ?? 'Start not recorded'} → {scheduleDate(e.end, timezone) ?? 'No end date'}</dd></div>)}
        </dl>
      </details>}
      {preview ? <span className={styles.caption}>Report link disabled in preview</span> : <Link className={styles.link} href={`/lifecycle/${b.id}`}>Explore advertising report →</Link>}
    </div>
  </section>;
}

/** How the affected advertising was doing in the week before the change, against the week before that. */
function LeadUpSummary({ card, currency }: { card: LifecycleCard; currency: string | null }) {
  const lead = leadUp(card.brief.days ?? [], card.brief.until);
  if (!lead) return null;
  const change = (value: number | null, favorable: boolean | null) => value === null ? null : <Delta value={value} favorable={favorable} label="" />;
  return <div className={styles.leadUp} aria-label="Before this change">
    <p className={styles.leadUpTitle}>Before this change <span>{dayRange(lead.recentFrom, lead.recentTo)} vs {dayRange(lead.priorFrom, lead.priorTo)} · {lead.matchedDays} matched days</span></p>
    <dl>
      <div><dt>Results</dt><dd>{number(lead.prior.results)} → <strong>{number(lead.recent.results)}</strong></dd>{change(lead.resultsChange, true)}</div>
      <div><dt>Spend</dt><dd>{money(lead.prior.spend, currency)} → <strong>{money(lead.recent.spend, currency)}</strong></dd>{change(lead.spendChange, null)}</div>
      <div><dt>Cost / result</dt><dd>{money(lead.prior.cpr, currency)} → <strong>{money(lead.recent.cpr, currency)}</strong></dd></div>
    </dl>
  </div>;
}

function issueKind(issue: Issue) {
  if (issue.code === 'CREATIVE_FATIGUE') return { tag: 'Creative fatigue', status: 'Still delivering', badge: 'Fatigue' };
  if (issue.code === 'DISAPPROVED') return { tag: 'Ad rejected', status: 'Not delivering', badge: 'Rejected' };
  if (issue.code === 'REAUTH_REQUIRED') return { tag: 'Connection', status: 'Data will stop updating', badge: 'Reconnect' };
  const cause = causeFromCode(issue.code);
  if (cause === 'billing' || cause === 'payment-risk') return { tag: 'Billing', status: 'Ads can’t run', badge: 'Billing' };
  if (cause === 'billing-pending') return { tag: 'Billing', status: 'Payment pending', badge: 'Billing' };
  if (cause === 'policy' || cause === 'review') return { tag: 'Account review', status: cause === 'policy' ? 'Account disabled' : 'Under review', badge: 'Review' };
  if (cause === 'compromised') return { tag: 'Account security', status: 'Account disabled', badge: 'Security' };
  if (cause === 'closed') return { tag: 'Account', status: 'Account closed', badge: 'Closed' };
  if (issue.code.startsWith('ACCOUNT_STATUS') || issue.code.includes('BILLING')) return { tag: 'Account', status: 'Delivery may be blocked', badge: 'Account' };
  return { tag: 'Needs attention', status: 'Delivery issue reported', badge: 'Attention' };
}

function AttentionCard({ issue: i, related, currency, timezone, preview = false }: { issue: Issue; related: LifecycleCard[]; currency: string | null; timezone: string | null; preview?: boolean }) {
  const creative = related.flatMap(c => c.brief.media).find(m => m.image);
  const kind = issueKind(i), rejected = i.code === 'DISAPPROVED';
  const status = i.stale ? 'Status needs confirmation' : kind.status;
  const Icon = i.code === 'REAUTH_REQUIRED' ? PlugZap : i.code === 'CREATIVE_FATIGUE' ? CircleAlert : AlertTriangle;
  const notice = issueLevel(i) === 'notice';
  return <section className={styles.urgentCard} data-level={notice ? 'notice' : undefined} aria-label={`${notice ? 'Notice' : 'Needs attention'}: ${i.title}`}>
    <div className={styles.urgentHeader}><span><Icon size={16} aria-hidden="true" />{notice ? 'Worth a look' : 'Action required'} · {kind.tag}</span><span>{status}</span></div>
    <div className={styles.urgentBody}>
      {creative?.image && <div className={styles.urgentCreative}><Image src={creative.image} alt={creative.name} width={84} height={108} unoptimized onError={e => { e.currentTarget.parentElement!.style.display = 'none'; }} /><span>{i.stale ? 'Last observed' : kind.badge}</span></div>}
      <div className={styles.urgentDetail}>
        <h3>{i.title}</h3><p>{i.explanation}</p>
        <div className={styles.urgentNotice}><CircleAlert size={15} aria-hidden="true" /><span>{i.stale ? `Last confirmed ${formatReportDay(i.observedAt.slice(0, 10))}. Refresh observations to confirm current status.` : notice ? 'This ad is still delivering. Meta’s flag is a suggestion, not a block.' : rejected ? 'This ad cannot deliver while Meta reports it as rejected.' : i.code === 'REAUTH_REQUIRED' ? 'Saved reports stay available; new data stops until you reconnect.' : causeFromCode(i.code) ? 'Meta’s notice for this account has the details and next steps.' : 'Review the reported issue before making changes to your advertising.'}</span></div>
        <div className={styles.urgentActions}>{preview ? <button type="button" className={styles.urgentPrimary} disabled>{i.action}</button> : (/^https?:/.test(i.href) ? <a className={styles.urgentPrimary} href={i.href} target="_blank" rel="noopener noreferrer">{i.action}<span className={styles.srOnly}> (opens Meta in a new tab)</span></a> : <Link className={styles.urgentPrimary} href={i.href}>{i.action}</Link>)}</div>
        {related.length > 0 && <details className={styles.urgentRelated}><summary>View performance</summary>{related.map(c => <Creative key={c.eventId} card={c} currency={currency} timezone={timezone} preview={preview} />)}</details>}
        {related.length > 0 && <p className={styles.caption}>{related.length} related advertising {related.length === 1 ? 'change' : 'changes'}{preview ? ' · preview only' : ''}</p>}
        {preview && !related.length && <p className={styles.caption}>Preview only · No real advertising activity</p>}
      </div>
    </div>
  </section>;
}

function RecapChart({ recap, currency, timezone }: { recap: Recap; currency: string | null; timezone: string | null }) {
  const [metric, setMetric] = useState<'spend' | 'results'>('spend');
  const chart = recapChart(recap);
  const values = chart.points.map(d => d[metric]).filter((v): v is number => v !== null);
  const max = Math.max(1, ...values);
  const peakIndex = values.length ? chart.points.findIndex(d => d[metric] === Math.max(...values)) : -1;
  // Name a peak only when one slot clearly leads; ties would make the callout arbitrary.
  const top = values.length ? Math.max(...values) : 0;
  const peak = peakIndex >= 0 && top > 0 && values.filter(v => v === top).length === 1 ? chart.points[peakIndex] : null;
  const label = (index: number) => chart.hourly ? formatHour(index) : formatReportDay(chart.points[index].label, false);
  const format = (v: number | null) => metric === 'spend' ? money(v, currency) : number(v);
  const showTick = (index: number) => chart.hourly ? index % 6 === 0 : chart.points.length <= 8 || index === 0 || index === chart.points.length - 1 || index % 7 === 0;
  return <>
    <div className={styles.chartHeading}>
      <h3>{chart.hourly ? 'Hourly' : 'Daily'} {metric}</h3>
      <div className={styles.segment} aria-label="Chart metric">{(['spend', 'results'] as const).map(m => <button key={m} type="button" aria-pressed={metric === m} onClick={() => setMetric(m)}>{m === 'spend' ? 'Spend' : 'Results'}</button>)}</div>
    </div>
    {peak ? <p className={styles.peak}>Highest {chart.hourly ? 'hour' : 'day'}: <strong>{format(peak[metric])}</strong> · {label(peakIndex)}</p> : null}
    <div className={styles.chart} data-granularity={chart.hourly ? 'hour' : 'day'} role="img" aria-label={`${chart.hourly ? 'Hourly' : 'Daily'} ${metric}, zero baseline. ${chart.observed} of ${chart.expected} ${chart.hourly ? 'hour slots' : 'days'} observed. Values in the accessible data table below.`}>
      {chart.points.map((d, index) => <div key={d.label} className={styles.column}>
        <div className={styles.barTrack}>{d[metric] === null
          ? <span className={styles.gap} title={`${label(index)}: no observation`} />
          : <span className={styles.bar} data-peak={(peak && index === peakIndex) || undefined} style={{ height: `${Math.max(d[metric] === 0 ? 0 : 2, d[metric]! / max * 100)}%` }} title={`${label(index)}: ${format(d[metric])}`} />}</div>
        <span className={styles.date}>{showTick(index) ? chart.hourly ? formatHourShort(index) : label(index) : ''}</span>
      </div>)}
    </div>
    {chart.hourly && <p className={styles.caption}>{chart.observed} of 24 hours observed · {formatTimezone(timezone)}. Missing hours are not zero; hourly observations may not match daily totals.</p>}
    <details><summary>View {chart.hourly ? 'hourly' : 'daily'} values</summary><table><thead><tr><th>{chart.hourly ? 'Hour' : 'Date'}</th><th>Spend</th><th>Results</th></tr></thead><tbody>{chart.points.map((d, index) => <tr key={d.label}><td>{label(index)}</td><td>{money(d.spend, currency)}</td><td>{number(d.results)}</td></tr>)}</tbody></table></details>
  </>;
}

/** A one-line index of what this update contains, so owners know what to scroll for. */
function Contents({ p }: { p: Presentation }) {
  const open = urgentIssues(p.issues).length, notices = p.issues.length - open, changes = p.lifecycle.length;
  const items: Array<{ key: string; tone: string; text: string }> = [];
  if (open) items.push({ key: 'issues', tone: 'urgent', text: `${open} to check` });
  if (notices) items.push({ key: 'notices', tone: 'navy', text: `${notices} ${notices === 1 ? 'notice' : 'notices'} from Meta` });
  if (p.recap) items.push({ key: 'recap', tone: 'info', text: p.recap.since === p.recap.until ? '1-day results' : `${p.recap.expectedDays}-day results` });
  if (changes) items.push({ key: 'changes', tone: 'navy', text: `${changes} ${changes === 1 ? 'change' : 'changes'}` });
  if (p.revisionOf) items.push({ key: 'revised', tone: 'neutral', text: 'Revised' });
  return items.length ? <ul className={styles.contents} aria-label="In this update">{items.map(item => <li key={item.key} data-tone={item.tone}>{item.text}</li>)}</ul> : null;
}

export function InsightContent({ saved, preview = false }: { saved: SavedPresentation; preview?: boolean }) {
  const p = saved.payload, r = p.recap;
  const chart = r ? recapChart(r) : null;
  const unavailableHours = Boolean(chart?.hourly && chart.observed === 0);
  const partial = Boolean(r && (r.observedDays < r.expectedDays || r.spend === null || r.results === null));
  const partialHours = Boolean(chart?.hourly && chart.observed > 0 && chart.observed < 24);
  const zeroResults = r?.results === 0;
  // Amber is reserved for real gaps. An observed zero is a fact, shown with a neutral note.
  const gapState = unavailableHours || partial;
  const dataTitle = unavailableHours ? (r?.hourly?.status === 'error' ? 'Hourly breakdown couldn’t be loaded for this report' : 'Hourly breakdown isn’t available for this report') : partial ? 'This report has incomplete performance data' : null;
  const related = new Set(p.issues.flatMap(i => p.lifecycle.filter(c => relatedLifecycle(i, c)).map(c => c.eventId)));
  const cards: Array<{ key: string; node: ReactNode }> = [
    ...p.issues.map(i => ({ key: i.id, node: <AttentionCard issue={i} related={p.lifecycle.filter(c => relatedLifecycle(i, c))} currency={p.currency} timezone={p.timezone} preview={preview} /> })),
    ...p.lifecycle.filter(c => !related.has(c.eventId)).map(c => ({ key: c.eventId, node: <Creative card={c} currency={p.currency} timezone={p.timezone} preview={preview} /> })),
  ];
  const lead = cards.filter(c => urgentIssues(p.issues).some(i => i.id === c.key)).slice(0, 1);
  const rest = cards.filter(c => !lead.some(l => l.key === c.key));
  const visibleRest = rest.slice(0, p.issues.length ? 2 : 3), hiddenRest = rest.slice(visibleRest.length);
  const comparisonLabel = r ? `vs previous ${r.expectedDays === 1 ? 'day' : `${r.expectedDays} days`}` : '';
  return <div className={styles.content} data-insight-preview={preview ? saved.id : undefined}>
    <header className={styles.heading}>
      <SpiderMascot state={urgentIssues(p.issues).length ? 'attention' : 'idle'} size={64} paused />
      <div>
        <span className={styles.eyebrow}>{p.account}{p.revisionOf ? ' · Revised report' : ''}</span>
        <h2>{headline(p)}</h2>
        <p>{r ? `${dayRange(r.since, r.until)} · completed ${r.expectedDays === 1 ? 'day' : 'days'} · ${formatTimezone(p.timezone)}` : 'Saved changes from your advertising account'}</p>
        <Contents p={p} />
      </div>
    </header>
    {lead.map(c => <div key={c.key}>{c.node}</div>)}
    {!r && !p.issues.length && !p.lifecycle.length && <section className={`${styles.card} ${styles.dataState}`}>
      <Metrics spend={null} results={null} cpr={null} currency={p.currency} />
      <div className={styles.dataInset}><InsightDataNotice title="No saved observations available">Your catch-up will appear once synchronization provides usable data. Missing information is not zero.</InsightDataNotice><MissingObservationTrack /></div>
    </section>}
    {r && chart && <section className={`${styles.performance} ${gapState ? styles.dataState : ''}`} aria-label="Performance catch-up">
      <Metrics spend={r.spend} results={r.results} cpr={r.cpr} currency={p.currency} comparison={r.comparison} comparisonLabel={comparisonLabel} />
      <div className={gapState ? styles.dataInset : undefined}>
        {dataTitle && <InsightDataNotice title={dataTitle} hourly={unavailableHours}>{unavailableHours ? `${r.spend !== null && r.results !== null ? 'Your daily totals are available above.' : 'Available daily totals are shown above.'} Hours with no data are not zero spend.` : `${r.observedDays} of ${r.expectedDays} days have observations. Gaps and unavailable metrics are not zero.`}</InsightDataNotice>}
        {!dataTitle && partialHours && <InsightDataNotice title="Some hours have no observations" hourly tone="neutral">{chart.observed} of 24 hours were observed. Blank hours are missing, not zero.</InsightDataNotice>}
        {!dataTitle && zeroResults && <InsightDataNotice title="No results were reported for this period" tone="neutral">Zero is an observed result count. Cost per result is unavailable when there are no results.</InsightDataNotice>}
        {unavailableHours ? <MissingObservationTrack hourly /> : <RecapChart recap={r} currency={p.currency} timezone={p.timezone} />}
        {r.comparison && <p className={styles.observation}>Reported results {r.comparison.results >= 0 ? 'increased' : 'decreased'} {Math.abs(r.comparison.results).toFixed(1)}% against the previous {r.expectedDays} completed days. Spend {r.comparison.spend >= 0 ? 'increased' : 'decreased'} {Math.abs(r.comparison.spend).toFixed(1)}%.</p>}
        <p className={styles.caption}>{r.observedDays} of {r.expectedDays} {r.expectedDays === 1 ? 'day has' : 'days have'} observations. {r.capped ? 'Your catch-up is limited to the latest 30 completed days. ' : ''}Results combine leads, conversations and calls; they are not verified bookings.</p>
      </div>
    </section>}
    {visibleRest.map(c => <div key={c.key}>{c.node}</div>)}
    {hiddenRest.length > 0 && <details className={styles.more}><summary>{hiddenRest.length} more {hiddenRest.length === 1 ? 'update' : 'updates'} in this review</summary>{hiddenRest.map(c => <div key={c.key}>{c.node}</div>)}</details>}
    <details className={styles.details}><summary>Data &amp; coverage</summary>
      <p>Timezone: {p.timezone ? `${formatTimezone(p.timezone)} (${p.timezone})` : 'Unavailable'} · Last successful sync: {p.syncedAt ? new Date(p.syncedAt).toLocaleString() : 'Unavailable'}</p>
      <p>Saved {new Date(saved.created_at).toLocaleString()}. This report preserves the values shown at that time. Later attribution corrections can change current reports.</p>
      {p.limitations.map(t => <p key={t}>{t}</p>)}
    </details>
    {!preview && <div className={styles.actions}><a href={`/api/insights/export?id=${saved.id}&format=pdf`}>Download PDF</a><a href={`/api/insights/export?id=${saved.id}&format=csv`}>Download CSV</a><Link href="/insights">All updates</Link></div>}
  </div>;
}

/** The modal footer shared by the live popup and the preview workbench. */
export function InsightFooter({ note, action, onAction, busy = false, error }: { note: string; action: string; onAction: () => void; busy?: boolean; error?: string }) {
  return <footer className={styles.footer}>{error && <p role="alert">{error}</p>}<span>{note}</span><button type="button" onClick={onAction} disabled={busy}>{action}</button></footer>;
}
export const insightModalClassNames = { content: styles.modalContent, header: styles.modalHeader, title: styles.modalTitle, body: styles.modalBody };

export default function InsightsPopup({ accountId }: { accountId: string | null }) {
  const [saved, setSaved] = useState<SavedPresentation | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [additional, setAdditional] = useState(false);
  const active = useRef<SavedPresentation | null>(null), token = useRef(''), inflight = useRef(false), mounted = useRef(true);
  const mobile = useMediaQuery('(max-width: 600px)'), pathname = usePathname(), router = useRouter();
  const load = useCallback(async () => {
    if (!accountId || pathname.startsWith('/insights') || inflight.current || document.visibilityState !== 'visible') return;
    // Avoid interrupting another dialog or a person currently entering information.
    if (!active.current && (document.querySelector('[role="dialog"],dialog[open]') || document.activeElement?.matches('input,textarea,[contenteditable="true"]'))) return;
    inflight.current = true;
    try {
      const res = await fetch('/api/insights', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: token.current }) });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (mounted.current) setAdditional(Boolean(data.presentation?.additionalUpdates));
      if (mounted.current && data.presentation && !active.current && !document.querySelector('[role="dialog"],dialog[open]')) { active.current = data.presentation; setSaved(data.presentation); setError(''); router.refresh(); /* the bell reads the notification this just created */ }
    } catch {
      if (mounted.current) setError('Updates are temporarily unavailable. Your advertising is unchanged.');
    } finally { inflight.current = false; }
  }, [accountId, pathname, router]);
  useEffect(() => {
    mounted.current = true;
    if (!token.current) token.current = crypto.randomUUID();
    const refresh = () => { void load(); };
    refresh();
    window.addEventListener('deepvisor:data-updated', refresh); window.addEventListener('focus', refresh); document.addEventListener('visibilitychange', refresh);
    const interval = window.setInterval(() => { if (active.current) void load(); }, 120000);
    return () => { mounted.current = false; window.clearInterval(interval); window.removeEventListener('deepvisor:data-updated', refresh); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [load, pathname]);
  async function dismiss() {
    if (!saved || busy) return;
    setBusy(true);
    try {
      const r = await fetch('/api/insights/ack', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: saved.id, token: token.current }) });
      if (!r.ok) throw new Error();
      active.current = null; setSaved(null); setError('');
    } catch { setError('Could not save your review. Please try again.'); } finally { setBusy(false); }
  }
  return <>
    {!saved && error && <StatusBanner tone="gap">{error}</StatusBanner>}
    <Modal opened={Boolean(saved)} onClose={() => void dismiss()} title="Insights & Events" size={740} fullScreen={mobile} radius="lg" closeOnClickOutside={false} closeOnEscape={!busy} classNames={insightModalClassNames}>
      {saved && <InsightContent saved={saved} />}
      <InsightFooter error={error} note={additional ? 'More updates are waiting. They stay unread until shown.' : 'This update stays in your history.'} action={busy ? 'Saving…' : 'Got it'} onAction={() => void dismiss()} busy={busy} />
    </Modal>
  </>;
}

const dayOf = (item: SavedPresentation) => presentationDay(item.created_at, item.payload.timezone);
type HistoryFilter = 'all' | 'attention' | 'performance' | 'lifecycle';
const FILTERS: Array<{ id: HistoryFilter; label: string }> = [
  { id: 'all', label: 'All' }, { id: 'attention', label: 'Needs attention' }, { id: 'performance', label: 'Performance' }, { id: 'lifecycle', label: 'Ad changes' },
];
const matches = (item: SavedPresentation, filter: HistoryFilter) => filter === 'all' ? true
  : filter === 'performance' ? Boolean(item.payload.recap) : filter === 'attention' ? item.payload.issues.length > 0 : item.payload.lifecycle.length > 0;
/** Day labels use the account's calendar, matching the daily notification bundle. */
function dayHeading(day: string, timezone: string | null) {
  const today = presentationDay(new Date().toISOString(), timezone);
  const yesterday = presentationDay(new Date(Date.now() - 86_400_000).toISOString(), timezone);
  if (day === today) return 'Today';
  if (day === yesterday) return 'Yesterday';
  const date = new Date(`${day}T12:00:00Z`);
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC', year: day.slice(0, 4) === today.slice(0, 4) ? undefined : 'numeric' });
}
function HistoryRow({ item, onOpen }: { item: SavedPresentation; onOpen: () => void }) {
  const p = item.payload, r = p.recap;
  const urgent = urgentIssues(p.issues).length > 0;
  const Icon = urgent ? AlertTriangle : (p.lifecycle.length || p.issues.length) && !r ? History : p.revisionOf ? RotateCcw : LineChart;
  const tone = urgent ? 'urgent' : (p.lifecycle.length || p.issues.length) && !r ? 'navy' : 'info';
  const summary = [
    r ? dayRange(r.since, r.until) : null,
    r && r.spend !== null ? `${money(r.spend, p.currency)} spent` : null,
    r && r.results !== null ? `${number(r.results)} results` : null,
  ].filter(Boolean).join(' · ');
  const unread = !item.readAt;
  return <button type="button" className={styles.historyCard} data-unread={unread || undefined} onClick={onOpen}>
    <span className={styles.historyIcon} data-tone={tone} aria-hidden="true"><Icon size={18} />{unread ? <span className={styles.unreadDot} /> : null}</span>
    <span className={styles.historyMain}>
      <strong>{unread ? <span className={styles.srOnly}>Unread: </span> : null}{p.revisionOf ? 'Revised report · ' : ''}{headline(p)}</strong>
      <span>{summary || (p.lifecycle[0]?.brief.title ?? p.issues[0]?.title ?? p.account)}</span>
      <Contents p={p} />
    </span>
    <span className={styles.historyTime}>{new Date(item.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
    <ChevronRight size={18} className={styles.historyChevron} aria-hidden="true" />
  </button>;
}

export function InsightsHistory() {
  const [items, setItems] = useState<SavedPresentation[]>([]), [issues, setIssues] = useState<Issue[]>([]), [next, setNext] = useState<string | null>(null), [selected, setSelected] = useState<SavedPresentation | null>(null), [filter, setFilter] = useState<HistoryFilter>('all'), [error, setError] = useState(''), [loading, setLoading] = useState(true), [day, setDay] = useState<string | null>(null);
  const mobile = useMediaQuery('(max-width: 600px)');
  const router = useRouter();
  /** Opening from history marks read for this person only; it never acknowledges or resolves issues. */
  const markRead = useCallback(async (ids: string[]) => {
    if (!ids.length) return;
    const at = new Date().toISOString();
    setItems(prev => prev.map(i => ids.includes(i.id) && !i.readAt ? { ...i, readAt: at } : i));
    try {
      const r = await fetch('/api/insights/seen', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) });
      if (!r.ok) throw new Error();
      window.dispatchEvent(new Event('deepvisor:insights-read'));
    } catch {
      setItems(prev => prev.map(i => ids.includes(i.id) && i.readAt === at ? { ...i, readAt: null } : i));
    }
  }, []);
  const load = useCallback(async (before?: string) => {
    setLoading(true);
    try {
      const r = await fetch(`/api/insights${before ? `?before=${before}` : ''}`);
      if (!r.ok) throw new Error();
      const data = await r.json();
      setItems(prev => before ? [...prev, ...data.items] : data.items); setIssues(data.issues); setNext(data.next); setError('');
    } catch { setError('Your saved updates could not be loaded.'); } finally { setLoading(false); }
  }, []);
  useEffect(() => {
    void load();
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id'), dayParam = params.get('day');
    if (dayParam && /^\d{4}-\d{2}-\d{2}$/.test(dayParam)) setDay(dayParam);
    if (id) void fetch(`/api/insights?id=${encodeURIComponent(id)}`).then(r => r.ok ? r.json() : null).then(d => { if (d) { setSelected(d); void markRead([id]); } else setError('This update is unavailable.'); }).catch(() => setError('This update is unavailable.'));
  }, [load, markRead]);
  /**
   * Live signal or polling update: re-read the newest page and open issues quietly. Older pages
   * already loaded are kept, so a live update never collapses what the person scrolled through.
   */
  useEffect(() => {
    let inflight = false;
    const refresh = async () => {
      if (inflight || document.visibilityState !== 'visible') return;
      inflight = true;
      try {
        const r = await fetch('/api/insights');
        if (!r.ok) return;
        const data = await r.json() as { items: SavedPresentation[]; issues: Issue[]; next: string | null };
        setIssues(data.issues);
        setItems(prev => { const fresh = new Set(data.items.map(i => i.id)); return [...data.items, ...prev.filter(i => !fresh.has(i.id))]; });
        setNext(prev => prev ?? data.next);
      } catch { /* keep what is shown; the next signal or focus retries */ } finally { inflight = false; }
    };
    const onUpdate = () => { void refresh(); };
    window.addEventListener('deepvisor:data-updated', onUpdate);
    return () => window.removeEventListener('deepvisor:data-updated', onUpdate);
  }, []);
  const unresolved = issues.filter(i => !i.resolvedAt), open = urgentIssues(unresolved), notices = unresolved.filter(i => issueLevel(i) === 'notice');
  const scoped = useMemo(() => day ? items.filter(i => dayOf(i) === day) : items, [items, day]);
  const counts = useMemo(() => Object.fromEntries(FILTERS.map(f => [f.id, scoped.filter(i => matches(i, f.id)).length])) as Record<HistoryFilter, number>, [scoped]);
  const visible = useMemo(() => scoped.filter(i => matches(i, filter)), [scoped, filter]);
  const unread = items.filter(i => !i.readAt);
  const groups = useMemo(() => {
    const map = new Map<string, SavedPresentation[]>();
    for (const item of visible) { const key = dayOf(item); map.set(key, [...(map.get(key) ?? []), item]); }
    return [...map].map(([key, rows]) => [key, dayHeading(key, rows[0].payload.timezone), rows] as const);
  }, [visible]);
  const openItem = (item: SavedPresentation) => { setSelected(item); if (!item.readAt) void markRead([item.id]); };
  const back = () => { if (window.history.length > 1) router.back(); else router.push('/dashboard'); };

  return <div className={styles.history}>
    <button type="button" className={styles.backLink} onClick={back}><ArrowLeft size={16} aria-hidden="true" />Back</button>
    <header className={styles.heading}>
      <SpiderMascot size={56} paused state={open.length ? 'attention' : 'idle'} />
      <div><span className={styles.eyebrow}>Your advertising, in context</span><h1>Insights &amp; Events</h1><p>Every catch-up, ad change and issue DeepVisor has shown you, saved as it was at the time.</p></div>
    </header>
    {open.length > 0 && <section className={styles.attention} aria-labelledby="still-open">
      <h2 id="still-open"><AlertTriangle size={16} aria-hidden="true" />{open.length === 1 ? '1 issue still needs attention' : `${open.length} issues still need attention`}</h2>
      <ul>{open.map(i => <li key={i.id}><div><strong>{i.title}</strong>{i.stale ? <span>Status needs a fresh observation</span> : null}</div><Link href={i.href}>{i.action}<ChevronRight size={14} aria-hidden="true" /></Link></li>)}</ul>
      <p>Marking an update as read doesn’t resolve an issue. It clears once Meta reports it fixed.</p>
    </section>}
    {notices.length > 0 && <section className={styles.attention} data-level="notice" aria-labelledby="open-notices">
      <h2 id="open-notices"><CircleAlert size={16} aria-hidden="true" />{notices.length === 1 ? '1 notice from Meta' : `${notices.length} notices from Meta`}</h2>
      <ul>{notices.map(i => <li key={i.id}><div><strong>{i.title}</strong><span>{i.explanation}</span></div><Link href={i.href}>{i.action}<ChevronRight size={14} aria-hidden="true" /></Link></li>)}</ul>
      <p>These ads are still delivering. A notice clears when Meta stops flagging it or the ad stops running.</p>
    </section>}
    <div className={styles.listBar}>
      <div className={styles.filterBar} role="group" aria-label="Show">
        {FILTERS.map(f => <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>{f.label}<span>{counts[f.id]}</span></button>)}
      </div>
      {unread.length > 0 && <button type="button" className={styles.markAll} onClick={() => void markRead(unread.slice(0, 50).map(i => i.id))}>Mark {unread.length === 1 ? '1 update' : `all ${unread.length}`} as read</button>}
    </div>
    {day && <p className={styles.dayScope}>Showing updates from {formatReportDay(day)}<button type="button" onClick={() => { setDay(null); window.history.replaceState(null, '', '/insights'); }}>Show all</button></p>}
    {error && <p role="alert" className={styles.errorLine}>{error} <button type="button" onClick={() => void load()}>Retry</button></p>}
    {!loading && !visible.length && !error && <section className={styles.emptyHistory}>
      <h2>{items.length ? 'Nothing in this view' : 'No saved updates yet'}</h2>
      <p>{items.length ? 'Choose another filter to see the rest of your updates.' : 'Updates appear when synced data provides a completed-day catch-up or a confirmed advertising change.'}</p>
    </section>}
    {groups.map(([key, heading, rows]) => <section key={key} className={styles.historyGroup} aria-label={heading}>
      <h2>{heading}</h2>
      {rows.map(i => <HistoryRow key={i.id} item={i} onOpen={() => openItem(i)} />)}
    </section>)}
    {loading && <p role="status" className={styles.caption}>Loading saved updates…</p>}
    {next && <button type="button" className={styles.loadMore} disabled={loading} onClick={() => void load(next)}>Load older updates</button>}
    <Modal opened={Boolean(selected)} onClose={() => setSelected(null)} title="Saved advertising update" classNames={insightModalClassNames} size={740} fullScreen={mobile} radius="lg">{selected && <InsightContent saved={selected} />}</Modal>
  </div>;
}
