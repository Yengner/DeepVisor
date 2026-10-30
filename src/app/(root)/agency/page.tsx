import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import DesignSurface from '@/components/design/DesignSurface';
import SpiderMascot from '@/components/brand/SpiderMascot';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import { createServerClient } from '@/lib/server/supabase/server';
import { loadBusinessObjectives } from '@/lib/server/agency/loadObjectives';
import { loadOverviewContext, loadOverviewDaily, loadOverviewEntities, loadOverviewPolicy, loadOverviewSync } from '@/lib/server/dashboard/overview/load';
import { controlPerformance } from '@/lib/server/dashboard/overview/controlModel';
import { modeLabel, shiftDay } from '@/lib/server/dashboard/overview/model';
import { loadDecisionSurface } from '@/lib/server/decisions/loadSurface';
import { buildDecisionPreview, isDecisionPreview } from '@/lib/server/decisions/preview';
import DecisionsFeed from '../decisions/DecisionsFeed';
import { metricLabels, metricValue, type ControlMetric } from '../dashboard/components/ControlMetrics';
import classes from './Agency.module.css';

export const metadata: Metadata = { title: 'AI Agency | DeepVisor' };
const safe = async <T,>(promise: Promise<T>) => promise.catch(() => null);

async function AgencyContent({ page, preview }: { page: number; preview: boolean }) {
  const auth = await getRequiredAppContext();
  if (preview) return <div className={classes.content}>
    <section className={classes.notice}><h2>Agency story · Development preview</h2><p>A salon wants more appointments, with a $1,000–$2,500 monthly budget preference and a $10–$25 lead-cost preference. These are illustrative choices, not customer settings.</p><p>The decisions and execution history below are fictional. No data is saved, no review is submitted, and no ads are changed. This preview does not prove real execution or performance improvements.</p><Link href="/agency">Return to saved account data</Link></section>
    <DecisionsFeed cards={buildDecisionPreview(new Date().toISOString()).cards} canReview={false} preview />
  </div>;
  const client = await createServerClient();
  const context = await loadOverviewContext();
  const account = context.account;
  const [objectives, policy, sync, decisions, performance] = await Promise.all([
    safe(loadBusinessObjectives(client, auth.businessId)), loadOverviewPolicy(auth.businessId),
    account ? loadOverviewSync(auth.businessId, account.id) : null,
    account ? safe(loadDecisionSurface(client, auth.businessId, page, account.id)) : null,
    account ? safe(Promise.all([loadOverviewDaily(auth.businessId, account.id, context.today), loadOverviewEntities(auth.businessId, account.id)])
      .then(([rows, entities]) => controlPerformance(rows, entities, '7d', context.today, account.currency_code))) : null,
  ]);
  const needsReview = decisions?.cards.flatMap(card => card.proposals).filter(proposal => proposal.canReview).length ?? 0;
  const stale = !account?.last_synced || !Number.isFinite(Date.parse(account.last_synced)) || Date.parse(context.now) - Date.parse(account.last_synced) > 6 * 3600000;
  const disconnected = !account || context.platform?.status !== 'connected';
  const issue = !objectives || policy.failed || disconnected || stale || sync?.failed || sync?.data?.activeJobStatus === 'failed' || (account && !decisions);
  const state = needsReview || issue ? 'attention' : 'idle';
  const operatingMode = modeLabel(policy.data?.mode ?? null, policy.failed);
  return <div className={classes.content}>
    <section className={classes.hero} aria-labelledby="agency-title">
      <SpiderMascot size={64} state={state} />
      <div><p className={classes.eyebrow}>{context.businessName}</p><h1 id="agency-title">Your Meta agency.</h1>
        <p>{needsReview ? `${needsReview} recommendation${needsReview === 1 ? '' : 's'} on this page can be reviewed.` : issue ? 'Your account needs attention before relying on new recommendations.' : 'Your saved intelligence, with you in control.'}</p></div>
      <Link className={classes.button} href="/dashboard">Open Overview →</Link>
    </section>
    {account?.name?.includes('[SYNTHETIC') && <p className={classes.notice}>Synthetic account · Test observations and simulated changes are demonstration evidence, not live advertising results.</p>}
    <div className={classes.columns}>
      <section className={classes.panel} aria-labelledby="observing-title"><h2 id="observing-title">What I’m observing</h2>
        <h3>{account?.name ?? 'No Meta account selected'}</h3>
        <p>{disconnected ? 'Connect or reconnect Meta and select an account to see its saved intelligence.' : 'Facebook & Instagram · Selected advertising account'}</p>
        <p className={classes.meta}>Last successful data sync: {account?.last_synced && Number.isFinite(Date.parse(account.last_synced)) ? new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short', timeZone: context.zone }).format(new Date(account.last_synced)) : 'Not recorded'} · {context.zone}{context.timezoneUnavailable ? ' (timezone unavailable; UTC fallback)' : ''}</p>
        {stale && account && <p className={classes.warning}>Fresh data is needed. Saved decisions retain their original observation dates.</p>}
        {sync?.failed ? <p role="alert">Sync status is unavailable.</p> : sync?.data?.activeJobStatus && <p>Latest sync job: {sync.data.activeJobStatus}. Queuing work does not mean data has been updated.</p>}
        {performance ? <><p className={classes.meta}>Recorded ad-set totals · {shiftDay(context.today, -6)} – {context.today}</p><dl className={classes.metrics}>{(Object.keys(metricLabels) as ControlMetric[]).map(key => <div key={key}><dt>{metricLabels[key]}</dt><dd>{metricValue(key, performance.metrics[key], performance.currency)}</dd></div>)}</dl><p className={classes.meta}>Includes today, partial{performance.partial ? " · Incomplete period data" : ""}</p><p className={classes.meta}>Results are Meta-reported leads, messages and calls, not verified bookings or customers.</p></> : <p>{account ? 'Performance is unavailable. Missing observations are not zero.' : 'Performance will appear after a successful sync.'}</p>}
        <Link href={disconnected ? '/integration' : '/dashboard'}>{disconnected ? 'Manage connections' : 'View performance and refresh data'} →</Link>
      </section>
      <section className={classes.panel} aria-labelledby="controls-title"><h2 id="controls-title">Your goals & controls</h2>
        {objectives ? <dl className={classes.preferences}>{[
          ['Business goal', objectives.objective], ['Monthly budget preference', objectives.monthlyBudget], ['Target lead cost', objectives.targetCost],
          ['Preferred lead type', objectives.leadType], ['Industry', objectives.industry], ['Recommendation preference', objectives.recommendationStyle], ['Safety preference', objectives.safety],
        ].map(([label, value]) => <div key={String(label)}><dt>{String(label)}</dt><dd>{typeof value === 'object' && value ? value.label : 'Not specified'}</dd></div>)}</dl> : <p role="alert">Business preferences could not be loaded.</p>}
        <p className={classes.meta}>Budget and cost preferences are saved ranges, not exact limits. Their currency is not explicitly stored.</p>
        <div className={classes.mode}><strong>Operating mode: {operatingMode}</strong><p>Preferences guide recommendations. Your safety policy and review permissions control what is allowed. Approving here saves a decision; it does not execute an advertising change.</p></div>
        <nav className={classes.links} aria-label="Business controls"><Link href="/settings/profile">Edit business profile</Link><Link href="/settings">Goals & preferences</Link><Link href="/decisions">Reviews & safety checks</Link></nav>
      </section>
    </div>
    <section aria-labelledby="activity-title"><div className={classes.activityHeading}><div><p className={classes.eyebrow}>OBSERVATION → DECISION → HUMAN REVIEW</p><h2 id="activity-title">Agency activity</h2><p>Saved evaluations for this account. Each decision keeps its own evidence period.</p></div><Link href="/decisions">All business decisions →</Link></div>
      {!account ? <div className={classes.panel}>Connect Meta to begin. No evaluations have been invented for this view.</div> : !decisions ? <div className={classes.notice} role="alert">Saved evaluations could not be loaded. <Link href="/agency">Try again</Link></div> : <>
        {!['owner', 'admin'].includes(auth.role) && <p>Only business owners and admins can approve or reject recommendations.</p>}
        <DecisionsFeed cards={decisions.cards} canReview={['owner', 'admin'].includes(auth.role)} />
        <nav className={classes.links} aria-label="Activity pages">{page > 0 && <Link href={`/agency?page=${page - 1}`}>← Newer evaluations</Link>}{decisions.hasNext && <Link href={`/agency?page=${page + 1}`}>Older evaluations →</Link>}</nav>
      </>}
    </section>
    {process.env.NODE_ENV === 'development' && <Link href="/agency?preview=decisions">Open clearly labeled sample story (development only)</Link>}
  </div>;
}

export default async function AgencyPage({ searchParams }: { searchParams: Promise<{ page?: string; preview?: string }> }) {
  const params = await searchParams;
  const value = Number(params.page ?? 0);
  const page = Number.isSafeInteger(value) && value >= 0 && value <= 10000 ? value : 0;
  return <DesignSurface label="DeepVisor · AI Agency"><div className={classes.page}>
    <Suspense key={`${page}:${params.preview}`} fallback={<div className={classes.loading} role="status"><SpiderMascot state="scanning" size={64} />Loading saved agency intelligence…</div>}>
      <AgencyContent page={page} preview={isDecisionPreview(params.preview)} />
    </Suspense>
  </div></DesignSurface>;
}
