'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { Modal } from '@mantine/core';
import { AlertTriangle, Archive, ArrowDown, ArrowLeft, ArrowUp, ChevronRight, CircleAlert, CircleCheck, CirclePause, CirclePlay, Download, Flag, History, Info, LineChart, PlugZap, RotateCcw } from 'lucide-react';
import { useMediaQuery } from '@mantine/hooks';
import SpiderMascot, { type SpiderMascotState } from '@/components/brand/SpiderMascot';
import StatusBanner from '@/components/ui/states/StatusBanner';
import { recapChart } from '@/lib/shared/insights/hourly';
import { issueLevel, urgentIssues, headlineMessage, lifecycleKind, relatedLifecycle } from '@/lib/shared/insights/model';
import type { Issue, LifecycleCard, LifecycleKind, Presentation, Recap, SavedPresentation } from '@/lib/shared/insights/model';
import { formatHourShort } from '@/lib/shared/reports/labels';
import { isReportDate } from '@/lib/shared/reports/dates';
import { causeFromCode } from '@/lib/shared/insights/health';
import { leadUp, leadUpTrend } from '@/lib/shared/insights/leadUp';
import { presentationDay } from '@/lib/shared/insights/notification';
import RangeSwitch from '@/components/design/RangeSwitch';
import styles from './InsightsView.module.css';
import PopupCheckin from '@/components/bookings/PopupCheckin';
import IdleSuggestionCard from './IdleSuggestionCard';
import WelcomeCard from './WelcomeCard';
import { InsightDataNotice, MissingObservationTrack } from './InsightDataState';
import { useIssueWords } from './useIssueWords';

type T = ReturnType<typeof useTranslations<'insights'>>;

/** Numbers, money, days and hours in the reader's language; dates stay on the report's calendar (UTC noon). */
export function useInsightFormat() {
  const t = useTranslations('insights');
  const intl = useLocale() === 'es' ? 'es-US' : 'en-US';
  return useMemo(() => {
    const number = (v: number | null) => v === null ? '—' : new Intl.NumberFormat(intl, { maximumFractionDigits: 0 }).format(v);
    const money = (v: number | null, currency: string | null) => {
      if (v === null) return '—';
      return currency ? new Intl.NumberFormat(intl, { style: 'currency', currency, maximumFractionDigits: 2 }).format(v) : t('currencyUnknown', { value: v.toFixed(2) });
    };
    const day = (iso: string | null | undefined, withYear = true) => {
      if (!iso || !isReportDate(iso)) return '—';
      return new Intl.DateTimeFormat(intl, { month: 'short', day: 'numeric', year: withYear ? 'numeric' : undefined, timeZone: 'UTC' }).format(new Date(`${iso}T12:00:00Z`));
    };
    const range = (from: string, to: string) => {
      if (from === to) return day(from);
      return `${day(from, from.slice(0, 4) !== to.slice(0, 4))} – ${day(to)}`;
    };
    /** "Oct 31 – Nov 6": the year is already in the card's own date range. */
    const shortRange = (since: string, until: string) => since === until ? day(since, false) : `${day(since, false)} – ${day(until, false)}`;
    const zone = (timezone: string | null | undefined) => {
      const city = timezone?.split('/').at(-1)?.replaceAll('_', ' ');
      return city ? t('timezone', { city }) : t('timezoneUnknown');
    };
    const hour = (h: number) => new Intl.DateTimeFormat(intl, { hour: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(2000, 0, 1, ((h % 24) + 24) % 24)));
    const hourShort = (h: number) => intl === 'en-US' ? formatHourShort(h) : `${((h % 24) + 24) % 24} h`;
    /** Entity schedule timestamps are stored with offsets; show them as a date in the account's timezone. */
    const schedule = (value: string | null, timezone: string | null) => {
      if (!value) return null;
      const date = new Date(value);
      if (!Number.isFinite(date.getTime())) return value;
      try { return date.toLocaleDateString(intl, { month: 'short', day: 'numeric', year: 'numeric', timeZone: timezone ?? undefined }); }
      catch { return date.toLocaleDateString(intl, { month: 'short', day: 'numeric', year: 'numeric' }); }
    };
    const time = (iso: string) => new Date(iso).toLocaleTimeString(intl, { hour: 'numeric', minute: '2-digit' });
    const weekday = (iso: string, withYear: boolean) => new Date(`${iso}T12:00:00Z`).toLocaleDateString(intl, { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC', year: withYear ? 'numeric' : undefined });
    const dayRange = (since: string, until: string) => since === until ? day(since) : range(since, until);
    return { t, number, money, day, range, dayRange, shortRange, zone, hour, hourShort, schedule, time, weekday };
  }, [intl, t]);
}
type Format = ReturnType<typeof useInsightFormat>;

/** The update's headline in the reader's language (see `headlineMessage`). */
function useHeadline() {
  const t = useTranslations('insights.headline');
  const f = useInsightFormat();
  return (p: Presentation) => {
    const { key, values } = headlineMessage(p);
    const v = { ...values, ...(typeof values.day === 'string' ? { day: f.day(values.day, false) } : {}) };
    return t(key as Parameters<typeof t>[0], v);
  };
}

const percent = (value: number) => `${Math.abs(value) >= 10 ? Math.round(Math.abs(value)) : Math.abs(value).toFixed(1)}%`;

/**
 * "Up 21%" / "Down 50%" in words, coloured by whether the move is good for the business:
 * more results is good, a higher cost per result is bad, spend on its own is neither.
 */
function Change({ value, goodWhenUp, label }: { value: number; goodWhenUp: boolean | null; label?: string }) {
  const t = useTranslations('insights.change');
  const flat = Math.abs(value) < 0.5;
  const tone = flat || goodWhenUp === null ? 'neutral' : (value > 0) === goodWhenUp ? 'good' : 'bad';
  const Arrow = value > 0 ? ArrowUp : ArrowDown;
  return <span className={styles.change}>
    <span className={styles.changePill} data-tone={tone}>
      {flat ? t('none') : <><Arrow size={13} strokeWidth={2.5} aria-hidden="true" />{value > 0 ? t('up', { pct: percent(value) }) : t('down', { pct: percent(value) })}</>}
      {tone !== 'neutral' && <span className={styles.srOnly}>{tone === 'good' ? t('better') : t('worse')}</span>}
    </span>
    {label ? <span className={styles.changeLabel}>{label}</span> : null}
  </span>;
}

function Metrics({ spend, results, cpr, currency, comparison, comparisonLabel }: {
  spend: number | null; results: number | null; cpr: number | null; currency: string | null;
  comparison?: Recap['comparison']; comparisonLabel?: string;
}) {
  const f = useInsightFormat();
  return <dl className={styles.metrics}>
    <div className={styles.leadMetric}><dt>{f.t('metric.results')}</dt><dd>{f.number(results)}</dd>{comparison ? <Change value={comparison.results} goodWhenUp label={comparisonLabel} /> : null}</div>
    <div><dt>{f.t('metric.spend')}</dt><dd>{f.money(spend, currency)}</dd>{comparison ? <Change value={comparison.spend} goodWhenUp={null} label={comparisonLabel} /> : null}</div>
    <div><dt>{f.t('metric.cpr')}</dt><dd>{f.money(cpr, currency)}</dd></div>
  </dl>;
}

const KIND_ICON: Record<LifecycleKind, typeof Info> = {
  ended: Flag, active: CirclePlay, resumed: CirclePlay, paused: CirclePause, interrupted: CirclePause,
  archived: Archive, rejected: AlertTriangle, update: Info,
};

function Creative({ card, currency, timezone, preview = false }: { card: LifecycleCard; currency: string | null; timezone: string | null; preview?: boolean }) {
  const f = useInsightFormat(), t = f.t;
  const b = card.brief, creative = b.media.find(m => m.image), config = b.configuration;
  const kind = lifecycleKind(card), ended = kind === 'ended';
  const Icon = KIND_ICON[kind];
  const adLevel = b.affected.length > 0 && b.affected.every(a => a.level === 'ad');
  const ads = b.affected.filter(a => a.level === 'ad').length;
  const count = ads ? t('affectedAds', { count: ads }) : b.affected.length ? t('affected', { count: b.affected.length }) : null;
  // Budget owner: the ad set when it holds the budget, otherwise the campaign. Shown by name only.
  const group = config && config.owner !== 'Budget owner unavailable' ? config.owner : null;
  const label = ended ? t(adLevel ? 'label.adEnded' : 'label.deliveryEnded') : t(`label.${kind}`);
  const noMetrics = b.spend === null && b.results === null && b.cpr === null;
  // A scheduled end is expected; the timeline already states that missing dates are not zero.
  const missing = !ended && (!creative || !currency || b.spend === null || b.results === null);
  return <section className={styles.lifecycleCard} data-kind={kind} aria-label={`${label}: ${b.title}`}>
    <header className={styles.statusBand}><Icon size={18} aria-hidden="true" /><div><strong>{label}</strong>{count || group ? <span>{[count, group].filter(Boolean).join(' · ')}</span> : null}</div></header>
    <div className={styles.lifecycleBody}>
      <div className={styles.creativeHeading}>
        {creative?.image && <div className={styles.lifecycleCreative}><Image src={creative.image} alt={creative.name} width={72} height={92} unoptimized onError={e => { e.currentTarget.parentElement!.style.display = 'none'; }} />{ended && <span>{t('endedBadge')}</span>}</div>}
        <div><h3>{b.title}</h3><p>{ended ? t('endedExplanation') : b.explanation}</p></div>
      </div>
      {b.provenance === 'reconstructed' && <p className={styles.notice}>{t('reconstructed')}</p>}
      {!(ended && noMetrics) && <p className={styles.metricsRange}>{t('totals', { range: f.dayRange(b.since, b.until) })}</p>}
      {!(ended && noMetrics) && <Metrics spend={b.spend} results={b.results} cpr={b.cpr} currency={currency} />}
      {missing && <div className={styles.dataInset}>
        <InsightDataNotice title={t('missing.title')}>{[!creative ? t('missing.noCreative') : null, !currency ? t('missing.noCurrency') : null, b.spend === null || b.results === null ? t('missing.dashes') : t('missing.shown')].filter(Boolean).join(' ')}</InsightDataNotice>
        {!creative && <div className={styles.missingMedia}>{t('missing.media')}</div>}
      </div>}
      <LeadUpSummary card={card} kind={kind} currency={currency} />
      {config && <details className={styles.configDetails}><summary>{t('config.summary')}</summary>
        <dl>
          <div><dt>{t('config.budget')}</dt><dd>{config.owner} · {config.dailyBudget !== null ? t('config.daily', { amount: f.money(config.dailyBudget, currency) }) : config.lifetimeBudget !== null ? t('config.lifetime', { amount: f.money(config.lifetimeBudget, currency) }) : t('config.budgetUnavailable')}</dd></div>
          <div><dt>{t('config.audience')}</dt><dd>{config.audience} · {config.geography}</dd></div>
          <div><dt>{t('config.placements')}</dt><dd>{config.platforms.length ? config.platforms.join(' / ') : t('config.notRecorded')}</dd></div>
          {b.affected.slice(0, 5).map(e => <div key={e.id}><dt>{t('config.schedule')}</dt><dd>{e.name}: {f.schedule(e.start, timezone) ?? t('config.startUnknown')} → {f.schedule(e.end, timezone) ?? t('config.noEnd')}</dd></div>)}
        </dl>
      </details>}
      {preview ? <span className={styles.caption}>{t('previewLinkOff')}</span> : <Link className={styles.link} href={`/lifecycle/${b.id}`}>{t('openReport')}</Link>}
    </div>
  </section>;
}

/** One sentence an owner can read without the table: did it get more results, and at what cost. */
function trendSentence(t: T, trend: ReturnType<typeof leadUpTrend>) {
  const results = t(trend.results === 'more' ? 'trend.more' : trend.results === 'fewer' ? 'trend.fewer' : 'trend.steady');
  const cost = trend.cost === 'higher' ? t('trend.higher') : trend.cost === 'lower' ? t('trend.lower') : null;
  if (!cost) return t('trend.only', { results });
  const agree = (trend.results === 'more' && trend.cost === 'lower') || (trend.results === 'fewer' && trend.cost === 'higher');
  return t(agree ? 'trend.and' : 'trend.but', { results, cost });
}

/** How the affected advertising was doing in the days before the change, against the days before that. */
function LeadUpSummary({ card, kind, currency }: { card: LifecycleCard; kind: LifecycleKind; currency: string | null }) {
  const f = useInsightFormat(), t = f.t;
  const lead = leadUp(card.brief.days ?? [], card.brief.until);
  if (!lead) return null;
  const trend = leadUpTrend(lead);
  const tone = trend.results === 'fewer' || trend.cost === 'higher' ? (trend.results === 'more' || trend.cost === 'lower' ? 'mixed' : 'bad')
    : trend.results === 'more' || trend.cost === 'lower' ? 'good' : 'neutral';
  const earlier = f.shortRange(lead.priorFrom, lead.priorTo), later = f.shortRange(lead.recentFrom, lead.recentTo);
  const rows = [
    { key: 'results', label: t('metric.results'), before: f.number(lead.prior.results), after: f.number(lead.recent.results), change: lead.resultsChange, goodWhenUp: true as boolean | null },
    { key: 'spend', label: t('metric.spend'), before: f.money(lead.prior.spend, currency), after: f.money(lead.recent.spend, currency), change: lead.spendChange, goodWhenUp: null },
    { key: 'cpr', label: t('metric.cprLong'), before: f.money(lead.prior.cpr, currency), after: f.money(lead.recent.cpr, currency), change: trend.costChange, goodWhenUp: false },
  ];
  return <section className={styles.leadUp} aria-labelledby={`lead-${card.eventId}`}>
    <h4 id={`lead-${card.eventId}`} className={styles.leadUpTitle}>{t('leadUp.title', { days: lead.windowDays, event: t(`before.${kind}`) })}</h4>
    <p className={styles.leadUpTakeaway} data-tone={tone}>{t('leadUp.takeaway', { days: lead.windowDays, sentence: trendSentence(t, trend) })}</p>
    <table className={styles.leadUpTable}>
      <thead><tr><th scope="col"><span className={styles.srOnly}>{t('leadUp.measure')}</span></th><th scope="col">{earlier}</th><th scope="col">{later}</th><th scope="col">{t('leadUp.change')}</th></tr></thead>
      <tbody>{rows.map(row => <tr key={row.key}>
        <th scope="row">{row.label}</th>
        <td data-head={earlier}>{row.before}</td>
        <td data-head={later}><strong>{row.after}</strong></td>
        <td>{row.change === null ? <span className={styles.changeNone}>{t('leadUp.notComparable')}</span> : <Change value={row.change} goodWhenUp={row.goodWhenUp} />}</td>
      </tr>)}</tbody>
    </table>
    {lead.matchedDays < lead.windowDays && <p className={styles.leadUpNote}>{t('leadUp.matched', { matched: lead.matchedDays, days: lead.windowDays })}</p>}
  </section>;
}

type IssueMessages = (typeof import('../../../messages/en.json'))['insights']['issue'];
type IssueKind = { tag: keyof IssueMessages['tag']; status: keyof IssueMessages['status']; badge: keyof IssueMessages['badge'] };
function issueKind(issue: Issue): IssueKind {
  const k = (tag: IssueKind['tag'], status: IssueKind['status'], badge: IssueKind['badge']): IssueKind => ({ tag, status, badge });
  if (issue.code === 'CREATIVE_FATIGUE') return k('fatigue', 'stillDelivering', 'fatigue');
  if (issue.code === 'DISAPPROVED') return k('rejected', 'notDelivering', 'rejected');
  if (issue.code === 'REAUTH_REQUIRED') return k('connection', 'stopUpdating', 'reconnect');
  const cause = causeFromCode(issue.code);
  if (cause === 'billing' || cause === 'payment-risk') return k('billing', 'cantRun', 'billing');
  if (cause === 'billing-pending') return k('billing', 'paymentPending', 'billing');
  if (cause === 'policy' || cause === 'review') return k('review', cause === 'policy' ? 'disabled' : 'underReview', 'review');
  if (cause === 'compromised') return k('security', 'disabled', 'security');
  if (cause === 'closed') return k('account', 'closed', 'closed');
  if (issue.code.startsWith('ACCOUNT_STATUS') || issue.code.includes('BILLING')) return k('account', 'mayBeBlocked', 'account');
  return k('attention', 'reported', 'attention');
}

function AttentionCard({ issue: i, related, currency, timezone, preview = false }: { issue: Issue; related: LifecycleCard[]; currency: string | null; timezone: string | null; preview?: boolean }) {
  const f = useInsightFormat(), t = f.t;
  const words = useIssueWords()(i);
  const creative = related.flatMap(c => c.brief.media).find(m => m.image);
  const kind = issueKind(i), rejected = i.code === 'DISAPPROVED';
  const tag = t(`issue.tag.${kind.tag}`);
  const status = t(`issue.status.${i.stale ? 'needsConfirmation' : kind.status}`);
  const Icon = i.code === 'REAUTH_REQUIRED' ? PlugZap : i.code === 'CREATIVE_FATIGUE' ? CircleAlert : AlertTriangle;
  const notice = issueLevel(i) === 'notice';
  if (i.resolvedAt) return <section className={styles.urgentCard} data-level="resolved" aria-label={t('issue.ariaResolved', { title: words.title })}>
    <div className={styles.urgentHeader}><span><CircleCheck size={16} aria-hidden="true" />{t('issue.resolved', { tag })}</span><span>{t('issue.status.noLonger')}</span></div>
    <div className={styles.urgentBody}><div className={styles.urgentDetail}>
      <h3>{words.title}</h3><p>{words.explanation}</p>
      <div className={styles.urgentNotice}><CircleCheck size={15} aria-hidden="true" /><span>{t('issue.resolvedNote', { day: f.day(i.resolvedAt.slice(0, 10)) })}</span></div>
    </div></div>
  </section>;
  const note = i.stale ? t('issue.staleNote', { day: f.day(i.observedAt.slice(0, 10)) }) : notice ? t('issue.noticeNote') : rejected ? t('issue.rejectedNote')
    : i.code === 'REAUTH_REQUIRED' ? t('issue.reauthNote') : causeFromCode(i.code) ? t('issue.causeNote') : t('issue.reviewNote');
  return <section className={styles.urgentCard} data-level={notice ? 'notice' : undefined} aria-label={t(notice ? 'issue.ariaNotice' : 'issue.ariaAttention', { title: words.title })}>
    <div className={styles.urgentHeader}><span><Icon size={16} aria-hidden="true" />{t(notice ? 'issue.worthALook' : 'issue.actionRequired')} · {tag}</span><span>{status}</span></div>
    <div className={styles.urgentBody}>
      {creative?.image && <div className={styles.urgentCreative}><Image src={creative.image} alt={creative.name} width={84} height={108} unoptimized onError={e => { e.currentTarget.parentElement!.style.display = 'none'; }} /><span>{t(`issue.badge.${i.stale ? 'lastObserved' : kind.badge}`)}</span></div>}
      <div className={styles.urgentDetail}>
        <h3>{words.title}</h3><p>{words.explanation}</p>
        <div className={styles.urgentNotice}><CircleAlert size={15} aria-hidden="true" /><span>{note}</span></div>
        <div className={styles.urgentActions}>{preview ? <button type="button" className={styles.urgentPrimary} disabled>{words.action}</button> : (/^https?:/.test(i.href) ? <a className={styles.urgentPrimary} href={i.href} target="_blank" rel="noopener noreferrer">{words.action}<span className={styles.srOnly}>{t('issue.opensMeta')}</span></a> : <Link className={styles.urgentPrimary} href={i.href}>{words.action}</Link>)}</div>
        {related.length > 0 && <details className={styles.urgentRelated}><summary>{t('issue.viewPerformance')}</summary>{related.map(c => <Creative key={c.eventId} card={c} currency={currency} timezone={timezone} preview={preview} />)}</details>}
        {preview && <p className={styles.caption}>{t('issue.previewOnly')}</p>}
      </div>
    </div>
  </section>;
}

function RecapChart({ recap, currency, timezone }: { recap: Recap; currency: string | null; timezone: string | null }) {
  const f = useInsightFormat(), t = f.t;
  const [metric, setMetric] = useState<'spend' | 'results'>('spend');
  const chart = recapChart(recap);
  const unit = chart.hourly ? 'hour' : 'day';
  const values = chart.points.map(d => d[metric]).filter((v): v is number => v !== null);
  const max = Math.max(1, ...values);
  const peakIndex = values.length ? chart.points.findIndex(d => d[metric] === Math.max(...values)) : -1;
  // Name a peak only when one slot clearly leads; ties would make the callout arbitrary.
  const top = values.length ? Math.max(...values) : 0;
  const peak = peakIndex >= 0 && top > 0 && values.filter(v => v === top).length === 1 ? chart.points[peakIndex] : null;
  const label = (index: number) => chart.hourly ? f.hour(index) : f.day(chart.points[index].label, false);
  const format = (v: number | null) => metric === 'spend' ? f.money(v, currency) : f.number(v);
  const showTick = (index: number) => chart.hourly ? index % 6 === 0 : chart.points.length <= 8 || index === 0 || index === chart.points.length - 1 || index % 7 === 0;
  return <>
    <div className={styles.chartHeading}>
      <h3>{t('chart.title', { unit, metric })}</h3>
      <RangeSwitch label={t('chart.metricLabel')} value={metric} onChange={setMetric} options={[{ value: 'spend', label: t('metric.spend') }, { value: 'results', label: t('metric.results') }]} />
    </div>
    {peak ? <p className={styles.peak}>{t.rich('chart.peak', { unit, value: format(peak[metric]), when: label(peakIndex), b: chunks => <strong>{chunks}</strong> })}</p> : null}
    <div className={styles.chart} data-granularity={unit} role="img" aria-label={t('chart.aria', { unit, metric, observed: chart.observed, expected: chart.expected })}>
      {chart.points.map((d, index) => <div key={d.label} className={styles.column}>
        <div className={styles.barTrack}>{d[metric] === null
          ? <span className={styles.gap} title={t('chart.noObservation', { when: label(index) })} />
          : <span className={styles.bar} data-peak={(peak && index === peakIndex) || undefined} style={{ height: `${Math.max(d[metric] === 0 ? 0 : 2, d[metric]! / max * 100)}%`, '--bar-index': index } as CSSProperties} title={`${label(index)}: ${format(d[metric])}`} />}</div>
        <span className={styles.date}>{showTick(index) ? chart.hourly ? f.hourShort(index) : label(index) : ''}</span>
      </div>)}
    </div>
    {chart.hourly && chart.observed > 0 && chart.observed < chart.expected && <p className={styles.gapLegend}><span aria-hidden="true" />{t('chart.gapLegend', { observed: chart.observed, expected: chart.expected })}</p>}
    {/* Every caveat lives here once, instead of a sentence under each chart. */}
    <details className={styles.valuesNotes}>
      <summary><ChevronRight size={15} aria-hidden="true" />{t('chart.valuesNotes', { unit })}</summary>
      <table><thead><tr><th>{t(chart.hourly ? 'chart.hour' : 'chart.date')}</th><th>{t('metric.spend')}</th><th>{t('metric.results')}</th></tr></thead><tbody>{chart.points.map((d, index) => <tr key={d.label}><td>{label(index)}</td><td>{f.money(d.spend, currency)}</td><td>{d.results === null && d.spend === null ? <span className={styles.noData}>{t('chart.noData')}</span> : f.number(d.results)}</td></tr>)}</tbody></table>
      <ul className={styles.notes}>
        {chart.hourly && <li>{t('chart.noteHours', { zone: f.zone(timezone) })}</li>}
        {recap.capped && <li>{t('chart.noteCapped')}</li>}
        <li>{t('chart.noteResults')}</li>
      </ul>
    </details>
  </>;
}

/** A one-line index of what this update contains, so owners know what to scroll for. */
function Contents({ p }: { p: Presentation }) {
  const t = useTranslations('insights.contents');
  const resolved = p.issues.filter(i => i.resolvedAt).length;
  const open = urgentIssues(p.issues).length, notices = p.issues.length - open - resolved, changes = p.lifecycle.length;
  const items: Array<{ key: string; tone: string; text: string }> = [];
  if (open) items.push({ key: 'issues', tone: 'urgent', text: t('toCheck', { count: open }) });
  if (resolved) items.push({ key: 'resolved', tone: 'neutral', text: t('resolvedSince', { count: resolved }) });
  if (notices) items.push({ key: 'notices', tone: 'navy', text: t('notices', { count: notices }) });
  if (p.recap) items.push({ key: 'recap', tone: 'info', text: p.recap.since === p.recap.until ? t('oneDay') : t('days', { count: p.recap.expectedDays }) });
  if (changes) items.push({ key: 'changes', tone: 'navy', text: t('changes', { count: changes }) });
  if (p.revisionOf) items.push({ key: 'revised', tone: 'neutral', text: t('revised') });
  // One chip only repeats the headline; the index earns its place when an update mixes kinds.
  if (items.length < 2) return null;
  return <ul className={styles.contents} aria-label={t('label')}>{items.map(item => <li key={item.key} data-tone={item.tone}>{item.text}</li>)}</ul>;
}

/**
 * The character sets the mood before anything is read: worried when something needs attention,
 * waving on a first look, an idea when ads are off, cheering when results went up, calm otherwise.
 */
function mascotState(p: Presentation): SpiderMascotState {
  if (urgentIssues(p.issues).length) return 'attention';
  if (p.welcome) return 'wave';
  if (p.suggestion) return 'idea';
  if (p.recap?.comparison && p.recap.comparison.results > 0) return 'success';
  return 'idle';
}

export function InsightContent({ saved, preview = false }: { saved: SavedPresentation; preview?: boolean }) {
  const f = useInsightFormat(), t = f.t;
  const headline = useHeadline();
  const p = saved.payload, r = p.recap;
  const onHistory = usePathname().startsWith('/insights');
  const chart = r ? recapChart(r) : null;
  const unavailableHours = Boolean(chart?.hourly && chart.observed === 0);
  const partial = Boolean(r && (r.observedDays < r.expectedDays || r.spend === null || r.results === null));
  const zeroResults = r?.results === 0;
  // Amber is reserved for real gaps. An observed zero is a fact, shown with a neutral note.
  const gapState = unavailableHours || partial;
  const dataTitle = unavailableHours ? t(r?.hourly?.status === 'error' ? 'data.hourlyError' : 'data.hourlyUnavailable') : partial ? t('data.incomplete') : null;
  const related = new Set(p.issues.flatMap(i => p.lifecycle.filter(c => relatedLifecycle(i, c)).map(c => c.eventId)));
  const cards: Array<{ key: string; node: ReactNode }> = [
    ...p.issues.map(i => ({ key: i.id, node: <AttentionCard issue={i} related={p.lifecycle.filter(c => relatedLifecycle(i, c))} currency={p.currency} timezone={p.timezone} preview={preview} /> })),
    ...p.lifecycle.filter(c => !related.has(c.eventId)).map(c => ({ key: c.eventId, node: <Creative card={c} currency={p.currency} timezone={p.timezone} preview={preview} /> })),
  ];
  const lead = cards.filter(c => urgentIssues(p.issues).some(i => i.id === c.key)).slice(0, 1);
  const rest = cards.filter(c => !lead.some(l => l.key === c.key));
  const visibleRest = rest.slice(0, p.issues.length ? 2 : 3), hiddenRest = rest.slice(visibleRest.length);
  const comparisonLabel = r ? t('comparison', { days: r.expectedDays }) : '';
  return <div className={styles.content} data-insight-preview={preview ? saved.id : undefined}>
    <header className={styles.heading}>
      <SpiderMascot state={mascotState(p)} size={64} className={styles.mascot} />
      <div>
        <h2>{headline(p)}</h2>
        <p>{[p.account, p.revisionOf ? t('contents.revised') : null, r ? f.dayRange(r.since, r.until) : null, r ? f.zone(p.timezone) : null].filter(Boolean).join(' · ')}</p>
        <Contents p={p} />
      </div>
    </header>
    {p.welcome && <WelcomeCard welcome={p.welcome} hasSuggestion={Boolean(p.suggestion)} interactive={!preview} />}
    {lead.map(c => <div key={c.key}>{c.node}</div>)}
    {!r && !p.issues.length && !p.lifecycle.length && !p.suggestion && !p.welcome && <section className={`${styles.card} ${styles.dataState}`}>
      <Metrics spend={null} results={null} cpr={null} currency={p.currency} />
      <div className={styles.dataInset}><InsightDataNotice title={t('data.noObsTitle')}>{t('data.noObsBody')}</InsightDataNotice><MissingObservationTrack /></div>
    </section>}
    {r && chart && <section className={`${styles.performance} ${gapState ? styles.dataState : ''}`} aria-label={t('performanceLabel')}>
      <Metrics spend={r.spend} results={r.results} cpr={r.cpr} currency={p.currency} comparison={r.comparison} comparisonLabel={comparisonLabel} />
      <div className={gapState ? styles.dataInset : undefined}>
        {dataTitle && <InsightDataNotice title={dataTitle} hourly={unavailableHours}>{unavailableHours ? t('data.hourlyBody', { available: r.spend !== null && r.results !== null ? 'yes' : 'no' }) : t('data.observedBody', { observed: r.observedDays, expected: r.expectedDays })}</InsightDataNotice>}
        {!dataTitle && zeroResults && <InsightDataNotice title={t('data.zeroTitle')} tone="neutral">{t('data.zeroBody')}</InsightDataNotice>}
        {unavailableHours ? <MissingObservationTrack hourly /> : <RecapChart recap={r} currency={p.currency} timezone={p.timezone} />}
      </div>
    </section>}
    {p.suggestion && <IdleSuggestionCard suggestion={p.suggestion} currency={p.currency} interactive={!preview} welcomed={Boolean(p.welcome)} />}
    {visibleRest.map(c => <div key={c.key}>{c.node}</div>)}
    {hiddenRest.length > 0 && <details className={styles.more}><summary>{t('more', { count: hiddenRest.length })}</summary>{hiddenRest.map(c => <div key={c.key}>{c.node}</div>)}</details>}
    {!preview && <div className={styles.actions}>
      <a href={`/api/insights/export?id=${saved.id}&format=pdf`} aria-label={t('downloadPdf')}><Download size={15} aria-hidden="true" />PDF</a>
      <a href={`/api/insights/export?id=${saved.id}&format=csv`} aria-label={t('downloadCsv')}><Download size={15} aria-hidden="true" />CSV</a>
      {/* Already on the history page, this link would only close the dialog. */}
      {!onHistory && <Link className={styles.allUpdates} href="/insights">{t('allUpdates')}<ChevronRight size={15} aria-hidden="true" /></Link>}
    </div>}
  </div>;
}

/** The modal footer shared by the live popup and the preview workbench. */
export function InsightFooter({ note, action, onAction, busy = false, error }: { note: string; action: string; onAction: () => void; busy?: boolean; error?: string }) {
  return <footer className={styles.footer}>{error && <p role="alert">{error}</p>}<span>{note}</span><button type="button" onClick={onAction} disabled={busy}>{action}</button></footer>;
}
export const insightModalClassNames = { content: styles.modalContent, header: styles.modalHeader, title: styles.modalTitle, body: styles.modalBody };

export default function InsightsPopup({ accountId }: { accountId: string | null }) {
  const t = useTranslations('insights.popup');
  const [saved, setSaved] = useState<SavedPresentation | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [additional, setAdditional] = useState(false);
  const active = useRef<SavedPresentation | null>(null), token = useRef(''), inflight = useRef(false), mounted = useRef(true);
  // A first look waiting on account setup: ask again every few seconds, for up to about three minutes.
  const retry = useRef<number | undefined>(undefined), waits = useRef(0);
  const mobile = useMediaQuery('(max-width: 600px)'), pathname = usePathname(), router = useRouter();
  const unavailable = t('unavailable');
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
      if (mounted.current && !data.presentation && typeof data.retryInSeconds === 'number' && waits.current < 36) {
        waits.current += 1;
        window.clearTimeout(retry.current);
        retry.current = window.setTimeout(() => window.dispatchEvent(new Event('deepvisor:data-updated')), data.retryInSeconds * 1000);
      } else if (data.presentation) waits.current = 0;
      if (mounted.current && data.presentation && !active.current && !document.querySelector('[role="dialog"],dialog[open]')) { active.current = data.presentation; setSaved(data.presentation); setError(''); router.refresh(); /* the bell reads the notification this just created */ }
    } catch {
      if (mounted.current) setError(unavailable);
    } finally { inflight.current = false; }
  }, [accountId, pathname, router, unavailable]);
  useEffect(() => {
    mounted.current = true;
    if (!token.current) token.current = crypto.randomUUID();
    const refresh = () => { void load(); };
    refresh();
    window.addEventListener('deepvisor:data-updated', refresh); window.addEventListener('focus', refresh); document.addEventListener('visibilitychange', refresh);
    const interval = window.setInterval(() => { if (active.current) void load(); }, 120000);
    return () => { mounted.current = false; window.clearInterval(interval); window.clearTimeout(retry.current); window.removeEventListener('deepvisor:data-updated', refresh); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [load, pathname]);
  async function dismiss() {
    if (!saved || busy) return;
    setBusy(true);
    try {
      const r = await fetch('/api/insights/ack', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: saved.id, token: token.current }) });
      if (!r.ok) throw new Error();
      active.current = null; setSaved(null); setError('');
    } catch { setError(t('saveFailed')); } finally { setBusy(false); }
  }
  return <>
    {!saved && error && <StatusBanner tone="gap">{error}</StatusBanner>}
    <Modal opened={Boolean(saved)} onClose={() => void dismiss()} title={t('title')} closeButtonProps={{ 'aria-label': t('close') }} size={740} fullScreen={mobile} radius="lg" closeOnClickOutside={false} closeOnEscape={!busy} classNames={insightModalClassNames}>
      {saved && <InsightContent saved={saved} />}
      {saved && <PopupCheckin key={saved.id} />}
      <InsightFooter error={error} note={additional ? t('moreWaiting') : t('inHistory')} action={busy ? t('saving') : t('gotIt')} onAction={() => void dismiss()} busy={busy} />
    </Modal>
  </>;
}

const dayOf = (item: SavedPresentation) => presentationDay(item.created_at, item.payload.timezone);
type HistoryFilter = 'all' | 'attention' | 'performance' | 'lifecycle';
const FILTERS: HistoryFilter[] = ['all', 'attention', 'performance', 'lifecycle'];
const matches = (item: SavedPresentation, filter: HistoryFilter) => filter === 'all' ? true
  : filter === 'performance' ? Boolean(item.payload.recap) : filter === 'attention' ? item.payload.issues.some(i => !i.resolvedAt) : item.payload.lifecycle.length > 0;
/** Day labels use the account's calendar, matching the daily notification bundle. */
function dayHeading(f: Format, day: string, timezone: string | null) {
  const today = presentationDay(new Date().toISOString(), timezone);
  const yesterday = presentationDay(new Date(Date.now() - 86_400_000).toISOString(), timezone);
  if (day === today) return f.t('history.today');
  if (day === yesterday) return f.t('history.yesterday');
  return f.weekday(day, day.slice(0, 4) !== today.slice(0, 4));
}
function HistoryRow({ item, onOpen }: { item: SavedPresentation; onOpen: () => void }) {
  const issueWords = useIssueWords();
  const f = useInsightFormat(), t = f.t;
  const headline = useHeadline();
  const p = item.payload, r = p.recap;
  const urgent = urgentIssues(p.issues).length > 0;
  const Icon = urgent ? AlertTriangle : (p.lifecycle.length || p.issues.length) && !r ? History : p.revisionOf ? RotateCcw : LineChart;
  const tone = urgent ? 'urgent' : (p.lifecycle.length || p.issues.length) && !r ? 'navy' : 'info';
  const summary = [
    // A one-day headline already names the day.
    r && r.since !== r.until ? f.dayRange(r.since, r.until) : null,
    r && r.spend !== null ? t('history.spent', { amount: f.money(r.spend, p.currency) }) : null,
    r && r.results !== null ? t('history.results', { count: r.results }) : null,
  ].filter(Boolean).join(' · ');
  const unread = !item.readAt;
  return <button type="button" className={styles.historyCard} data-unread={unread || undefined} onClick={onOpen}>
    <span className={styles.historyIcon} data-tone={tone} aria-hidden="true"><Icon size={18} />{unread ? <span className={styles.unreadDot} /> : null}</span>
    <span className={styles.historyMain}>
      <strong>{unread ? <span className={styles.srOnly}>{t('history.unread')}</span> : null}{p.revisionOf ? t('history.revisedReport') : ''}{headline(p)}</strong>
      <span>{summary || (p.lifecycle[0]?.brief.title ?? (p.issues[0] ? issueWords(p.issues[0]).title : undefined) ?? p.account)}</span>
      <Contents p={p} />
    </span>
    <span className={styles.historyTime}>{f.time(item.created_at)}</span>
    <ChevronRight size={18} className={styles.historyChevron} aria-hidden="true" />
  </button>;
}

export function InsightsHistory() {
  const issueWords = useIssueWords();
  const f = useInsightFormat(), t = f.t;
  const [items, setItems] = useState<SavedPresentation[]>([]), [issues, setIssues] = useState<Issue[]>([]), [next, setNext] = useState<string | null>(null), [selected, setSelected] = useState<SavedPresentation | null>(null), [filter, setFilter] = useState<HistoryFilter>('all'), [error, setError] = useState(''), [loading, setLoading] = useState(true), [day, setDay] = useState<string | null>(null);
  const mobile = useMediaQuery('(max-width: 600px)');
  const router = useRouter();
  const loadError = t('history.loadError'), unavailable = t('history.unavailable');
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
    } catch { setError(loadError); } finally { setLoading(false); }
  }, [loadError]);
  useEffect(() => {
    void load();
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id'), dayParam = params.get('day');
    if (dayParam && /^\d{4}-\d{2}-\d{2}$/.test(dayParam)) setDay(dayParam);
    if (id) void fetch(`/api/insights?id=${encodeURIComponent(id)}`).then(r => r.ok ? r.json() : null).then(d => { if (d) { setSelected(d); void markRead([id]); } else setError(unavailable); }).catch(() => setError(unavailable));
  }, [load, markRead, unavailable]);
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
  const counts = useMemo(() => Object.fromEntries(FILTERS.map(id => [id, scoped.filter(i => matches(i, id)).length])) as Record<HistoryFilter, number>, [scoped]);
  const visible = useMemo(() => scoped.filter(i => matches(i, filter)), [scoped, filter]);
  const unread = items.filter(i => !i.readAt);
  const groups = useMemo(() => {
    const map = new Map<string, SavedPresentation[]>();
    for (const item of visible) { const key = dayOf(item); map.set(key, [...(map.get(key) ?? []), item]); }
    return [...map].map(([key, rows]) => [key, dayHeading(f, key, rows[0].payload.timezone), rows] as const);
  }, [visible, f]);
  const openItem = (item: SavedPresentation) => { setSelected(item); if (!item.readAt) void markRead([item.id]); };
  const back = () => { if (window.history.length > 1) router.back(); else router.push('/dashboard'); };

  return <div className={styles.history}>
    <button type="button" className={styles.backLink} onClick={back}><ArrowLeft size={16} aria-hidden="true" />{t('history.back')}</button>
    <header className={styles.heading}>
      <SpiderMascot size={56} paused state={open.length ? 'attention' : 'idle'} />
      <div><h1>{t('history.title')}</h1><p>{t('history.lead')}</p></div>
    </header>
    {open.length > 0 && <section className={styles.attention} aria-labelledby="still-open">
      <h2 id="still-open"><AlertTriangle size={16} aria-hidden="true" />{t('history.openIssues', { count: open.length })}</h2>
      <ul>{open.map(i => <li key={i.id}><div><strong>{issueWords(i).title}</strong>{i.stale ? <span>{t('history.staleObs')}</span> : null}</div><Link href={i.href}>{issueWords(i).action}<ChevronRight size={14} aria-hidden="true" /></Link></li>)}</ul>
      <p>{t('history.readNote')}</p>
    </section>}
    {notices.length > 0 && <section className={styles.attention} data-level="notice" aria-labelledby="open-notices">
      <h2 id="open-notices"><CircleAlert size={16} aria-hidden="true" />{t('history.noticesTitle', { count: notices.length })}</h2>
      <ul>{notices.map(i => <li key={i.id}><div><strong>{issueWords(i).title}</strong><span>{issueWords(i).explanation}</span></div><Link href={i.href}>{issueWords(i).action}<ChevronRight size={14} aria-hidden="true" /></Link></li>)}</ul>
      <p>{t('history.noticesNote')}</p>
    </section>}
    <div className={styles.listBar}>
      <div className={styles.filterBar} role="group" aria-label={t('history.show')}>
        {FILTERS.map(id => <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)}>{t(`history.filter.${id}`)}<span>{counts[id]}</span></button>)}
      </div>
      {unread.length > 0 && <button type="button" className={styles.markAll} onClick={() => void markRead(unread.slice(0, 50).map(i => i.id))}>{t('history.markAll', { count: unread.length })}</button>}
    </div>
    {day && <p className={styles.dayScope}>{t('history.showingDay', { day: f.day(day) })}<button type="button" onClick={() => { setDay(null); window.history.replaceState(null, '', '/insights'); }}>{t('history.showAll')}</button></p>}
    {error && <p role="alert" className={styles.errorLine}>{error} <button type="button" onClick={() => void load()}>{t('history.retry')}</button></p>}
    {!loading && !visible.length && !error && <section className={styles.emptyHistory}>
      <h2>{t(items.length ? 'history.emptyFilteredTitle' : 'history.emptyTitle')}</h2>
      <p>{t(items.length ? 'history.emptyFilteredBody' : 'history.emptyBody')}</p>
    </section>}
    {groups.map(([key, heading, rows]) => <section key={key} className={styles.historyGroup} aria-label={heading}>
      <h2>{heading}</h2>
      {rows.map(i => <HistoryRow key={i.id} item={i} onOpen={() => openItem(i)} />)}
    </section>)}
    {loading && <p role="status" className={styles.caption}>{t('history.loading')}</p>}
    {next && <button type="button" className={styles.loadMore} disabled={loading} onClick={() => void load(next)}>{t('history.loadOlder')}</button>}
    <Modal opened={Boolean(selected)} onClose={() => setSelected(null)} title={t('history.savedTitle')} closeButtonProps={{ 'aria-label': t('close') }} classNames={insightModalClassNames} size={740} fullScreen={mobile} radius="lg">{selected && <InsightContent saved={selected} />}</Modal>
  </div>;
}
