import { comparisons } from '@/lib/server/dashboard/insights/comparisons';
import { cache, Suspense } from "react";
import Link from "next/link";
import {
  IconArrowRight,
} from "@tabler/icons-react";
import {
  loadOverviewContext,
  loadOverviewHistory,
  loadOverviewDecisions,
  loadOverviewEntities,
  loadOverviewSync,
  type OverviewContext as LiveOverviewContext,
} from "@/lib/server/dashboard/overview/load";
import {
  decisionViews,
  parsePeriod,
  periodRange,
} from "@/lib/server/dashboard/overview/model";
import {
  controlPerformance,
  recentChanges,
} from "@/lib/server/dashboard/overview/controlModel";
import type { Period } from "@/lib/server/dashboard/overview/types";
import { loadExploration } from "@/lib/server/campaigns/exploration/load";
import { PeriodControl, RefreshOverview } from "./components/OverviewControls";
import ControlMetrics from "./components/ControlMetrics";
import ControlTrend from "./components/ControlTrend";
import AdvertisingBoard from "./components/AdvertisingBoard";
import classes from "./components/ControlCenter.module.css";
import { buildDecisionPreview, isDecisionPreview } from '@/lib/server/decisions/preview';
import DecisionPreviewBanner from '@/components/product/DecisionPreviewBanner';
import DesignSurface from '@/components/design/DesignSurface';
import PixelCompanion from '@/components/brand/PixelCompanion';
import { resourceRefreshEnabled } from '@/lib/server/sync/resources/coordinator';
import { loadInsights } from '@/lib/server/dashboard/insights/load';
import { selectRows, publisher, advertisingMetrics, livePerformance, type Publisher } from '@/lib/server/dashboard/insights/model';
import AudienceIntelligence from './components/AudienceIntelligence';
import { audienceObservations, hourlyObservations } from '@/lib/server/dashboard/insights/charts';
import { PlatformControl } from './components/OverviewControls';
type OverviewContext = LiveOverviewContext & { decisionPreview?: boolean; publisher: Publisher };

const decisions = cache(async (context: OverviewContext) => {
  if (context.decisionPreview) return buildDecisionPreview(context.now, context.zone).overview;
  const [data, entities] = await Promise.all([
    loadOverviewDecisions(context.businessId, context.account!.id),
    loadOverviewEntities(context.businessId, context.account!.id),
  ]);
  return {
    ...decisionViews({
      data,
      entities,
      businessId: context.businessId,
      accountId: context.account!.id,
      now: context.now,
      zone: context.zone,
    }),
    policyUnavailable: data.policyUnavailable,
  };
});
const performance = cache(async (context: OverviewContext, period: Period) => {
  const live = await loadInsights(context);
  if (live.daily !== null && !(resourceRefreshEnabled() && context.publisher === 'combined')) return { ...livePerformance(live.daily, context.publisher, period, context.today, context.account!.currency_code), ...comparisons(live.daily, context.publisher, period, context.today, context.account!.currency_code, live.fetchedAt, context.now, { timezone: context.timezoneUnavailable ? undefined : context.zone, cutoff: process.env.DEEPVISOR_KPI_TODAY_CUTOFF ?? '20:00' }) };
  if (context.publisher !== 'combined') return livePerformance([], context.publisher, period, context.today, context.account!.currency_code);
  const [rows, entities] = await Promise.all([
    loadOverviewHistory(context.businessId, context.account!.id, context.today),
    loadOverviewEntities(context.businessId, context.account!.id),
  ]);
  if (resourceRefreshEnabled()) {
    const dated = rows.map(row => ({ ...row, externalId: row.entity_id, publisher: 'combined', label: '' }));
    return { ...controlPerformance(rows, entities, period, context.today, context.account!.currency_code),
      ...comparisons(dated, 'combined', period, context.today, context.account!.currency_code, live.canonicalFetchedAt ?? '', context.now,
        { timezone: context.timezoneUnavailable ? undefined : context.zone, cutoff: process.env.DEEPVISOR_KPI_TODAY_CUTOFF ?? '20:00' }) };
  }
  return { ...controlPerformance(rows, entities, period, context.today, context.account!.currency_code), deltas: {}, comparison: 'Comparison unavailable while using stored fallback data.' };
});
function timestamp(at: string | null | undefined, zone: string) {
  return at && Number.isFinite(Date.parse(at))
    ? new Intl.DateTimeFormat("en", {
        timeZone: zone,
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(at))
    : "Not recorded";
}
function Loading({
  kind = "rows",
}: {
  kind?: "rows" | "metrics" | "chart" | "board";
}) {
  return (
    <div
      role="status"
      aria-label="Loading dashboard section"
      className={`${classes.loading} ${kind === "chart" ? classes.chartLoading : kind === "board" ? classes.boardLoading : kind === "metrics" ? classes.metricsLoading : ""}`}
    >
      {kind === 'rows' && <PixelCompanion state="analyzing" size={28} />}
      <span />
      <span />
      <span />
      {kind === "metrics" && <span />}
    </div>
  );
}
function ErrorMessage({ children }: { children: string }) {
  return (
    <p className={classes.error} role="status">
      {children}
    </p>
  );
}
async function Metrics({
  context,
  period,
}: {
  context: OverviewContext;
  period: Period;
}) {
  const view = await performance(context, period).catch((error) => {
    console.error("Overview performance unavailable", error);
    return null;
  });
  return view ? (
    <ControlMetrics view={view} />
  ) : (
    <ErrorMessage>
      Performance unavailable. Please try again shortly.
    </ErrorMessage>
  );
}
async function Trend({
  context,
  period,
}: {
  context: OverviewContext;
  period: Period;
}) {
  const view = await performance(context, period).catch(() => null);
  return view ? (
    <ControlTrend view={view} todayOnly={period === "today"} />
  ) : (
    <ErrorMessage>Daily trend unavailable.</ErrorMessage>
  );
}
async function Board({ period, context }: { period: Period; context: OverviewContext }) {
  const view = await loadExploration(period, "adset", null, true).catch(
    (error) => {
      console.error("Overview advertising unavailable", error);
      return null;
    },
  );
  if (view) {
    const live = await loadInsights(context);
    return <AdvertisingBoard view={{ ...view, items: advertisingMetrics(view.items, resourceRefreshEnabled() && context.publisher === 'combined' ? null : live.daily, context.publisher, period, context.today, view.currency) }} learning={live.learning} filtered={context.publisher !== 'combined'} />;
  }
  return view ? (
    <AdvertisingBoard view={view} />
  ) : (
    <ErrorMessage>
      Advertising previews and performance are temporarily unavailable.
    </ErrorMessage>
  );
}
async function Activity({ context }: { context: OverviewContext }) {
  const result = await decisions(context).catch(() => null);
  if (!result) return null;
  const items = recentChanges(result.allActivity);
  if (!items.length) return null;
  return (
    <section className={classes.activity}>
      <div className={classes.boardHeader}>
        <h2>Recent changes</h2>
        <Link href={context.decisionPreview ? '/decisions?preview=decisions' : '/decisions'}>
          Decisions <IconArrowRight size={15} />
        </Link>
      </div>
      <ol>
        {items.map((item, i) => (
          <li key={i}>
            <div>
              {item.title}
              <p>
                {item.entity} · {item.state}
              </p>
            </div>
            <time dateTime={item.at}>
              {new Intl.DateTimeFormat("en", {
                timeZone: context.zone,
                hour: "numeric",
                minute: "2-digit",
              }).format(new Date(item.at))}
            </time>
          </li>
        ))}
      </ol>
      {result.view.outcomesUnavailable && (
        <p className={classes.quiet}>
          Performance observations are unavailable.
        </p>
      )}
    </section>
  );
}
async function Content({ period, preview, platform }: { period: Period; preview: boolean; platform: Publisher }) {
  const context: OverviewContext = { ...await loadOverviewContext(), decisionPreview: preview, publisher: platform };
  const connected =
    context.platform?.status === "connected" &&
    context.platform.vendor === "meta";
  const savedMetaAccount = context.platform?.vendor === "meta" &&
    ["connected", "error", "needs_reauth"].includes(context.platform.status);
  if (!savedMetaAccount || !context.account)
    return (
      <section className={classes.emptyState}>
        <PixelCompanion size={56} />
        <h1>Connect your advertising</h1>
        <p>
          Connect Meta and choose an account to see your advertising and
          decisions here.
        </p>
        <Link href="/integration">
          Open Connections <IconArrowRight size={16} />
        </Link>
      </section>
    );
  const sync = await loadOverviewSync(context.businessId, context.account.id);
  if (
    !sync.failed &&
    (sync.data
      ? !sync.data.firstFullSyncCompleted
      : !context.account.last_synced)
  )
    return (
      <section className={classes.emptyState}>
        <PixelCompanion size={56} state={sync.data?.activeJobStatus === 'failed' ? 'attention' : ['queued', 'running'].includes(sync.data?.activeJobStatus ?? '') ? 'analyzing' : 'idle'} />
        <h1>Your first sync</h1>
        <p>
          {sync.data?.activeJobStatus === "failed"
            ? "The initial sync could not finish. Check Connections before trying again."
            : "Performance will appear once your account’s initial sync completes."}
        </p>
        <RefreshOverview />
        <Link href="/integration">Connections</Link>
      </section>
    );
  const live = await loadInsights(context);
  const audience = live.audience === null ? null : audienceObservations(selectRows(live.audience, platform, period, context.today));
  const hourly = live.hourly === null ? null : hourlyObservations(selectRows(live.hourly, platform, period, context.today));
  const retrievedAt = resourceRefreshEnabled() && platform === 'combined' ? live.canonicalFetchedAt : live.fetchedAt;
  const age = retrievedAt ? Date.parse(context.now) - Date.parse(retrievedAt) : Infinity;
  return <div className={classes.page} data-publisher={platform}>
    {preview && <DecisionPreviewBanner page="dashboard" />}
    <header className={classes.workspaceHeader}><div><h1>{context.businessName}</h1><p>{context.account.name}</p></div><div><PlatformControl platform={platform} /><PeriodControl period={period} /></div></header>
    <details className={classes.freshness}><summary>{live.source === 'api' || live.source === 'stored' ? age > 600000 ? 'Previously retrieved Meta data' : 'Updated recently' : platform === 'combined' ? 'Stored data · live retrieval unavailable' : 'Platform data unavailable'}</summary>
      <p>Meta attribution may change after reporting. {retrievedAt ? `Retrieved ${timestamp(retrievedAt, context.zone)}.` : `Stored sync ${timestamp(context.account.last_synced, context.zone)}.`} Account timezone: {context.zone}.</p>
      <p>Today is partial. Gaps and unknown metrics remain unavailable. Publisher means where an ad was delivered, not where a customer contacted you.</p>
      <RefreshOverview disabled={preview} label="Recover stored Meta data" /><Link href="/integration">Connection settings</Link>
    </details>
    {!connected && <ErrorMessage>Meta connection needs attention. Saved data remains available; reconnect in Connections.</ErrorMessage>}
    <section aria-label="Account performance"><Suspense key={`${period}:${platform}`} fallback={<Loading kind="metrics" />}><Metrics context={context} period={period} /></Suspense></section>
    <section className={classes.workspaceChart} aria-label="Performance chart"><Suspense key={`${period}:${platform}`} fallback={<Loading kind="chart" />}><Trend context={context} period={period} /></Suspense></section>
    <section className={classes.board}><Suspense key={`${period}:${platform}`} fallback={<Loading kind="board" />}><Board period={period} context={context} /></Suspense></section>
    <AudienceIntelligence key={`${period}:${platform}`} audience={audience} hourly={hourly} currency={context.account.currency_code} zone={context.zone} period={period} platform={platform} fetchedAt={live.fetchedAt} audienceFetchedAt={live.audienceFetchedAt} hourlyFetchedAt={live.hourlyFetchedAt} since={periodRange(period, context.today).since} until={context.today} audienceCombinedOnly={live.audience?.some(r => r.publisher === 'combined-only') ?? false} hourlyCombinedOnly={live.hourly?.some(r => r.publisher === 'combined-only') ?? false} />
    <Suspense fallback={null}><Activity context={context} /></Suspense>
  </div>;
}
export default async function OverviewPage({ searchParams }: { searchParams: Promise<{ period?: string; preview?: string; publisher?: string }> }) {
  const params = await searchParams;
  return <DesignSurface label="Overview"><Suspense fallback={<Loading kind="chart" />}><Content period={parsePeriod(params.period)} preview={isDecisionPreview(params.preview)} platform={publisher(params.publisher)} /></Suspense></DesignSurface>;
}
