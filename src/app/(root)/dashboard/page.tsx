import { agencyEnabled } from '@/lib/server/agency/enabled';
import { attentionText } from '@/lib/server/insights/attentionText';
import { comparisons } from '@/lib/server/dashboard/insights/comparisons';
import { cache, Suspense } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import {
  IconArrowRight,
} from "@tabler/icons-react";
import {
  loadOverviewContext,
  loadChartMarkerSources,
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
import type { ControlPerformance } from "@/lib/server/dashboard/overview/controlModel";
import type { Period } from "@/lib/server/dashboard/overview/types";
import { loadExploration } from "@/lib/server/campaigns/exploration/load";
import { RefreshOverview } from "./components/OverviewControls";
import DashboardHeader from "./components/DashboardHeader";
import DataInfo, { type DataInfoProps } from "./components/DataInfo";
import { AccountSetupProgress } from "@/components/integrations/AccountSetupProgress";
import ControlMetrics from "./components/ControlMetrics";
import ControlTrend from "./components/ControlTrend";
import AdvertisingBoard from "./components/AdvertisingBoard";
import classes from "./components/ControlCenter.module.css";
import { buildDecisionPreview, isDecisionPreview } from '@/lib/server/decisions/preview';
import DecisionPreviewBanner from '@/components/product/DecisionPreviewBanner';
import DesignSurface from '@/components/design/DesignSurface';
import PixelCompanion from '@/components/brand/PixelCompanion';
import SetupChecklist from './components/SetupChecklist';
import { resourceRefreshEnabled } from '@/lib/server/sync/resources/coordinator';
import { loadInsights } from '@/lib/server/dashboard/insights/load';
import { selectRows, publisher, advertisingMetrics, livePerformance, deliveredToday, type Publisher, type Insight } from '@/lib/server/dashboard/insights/model';
import { adSetSignals } from '@/lib/server/dashboard/insights/signals';
import { periodContext, sameHourComparison } from '@/lib/server/dashboard/insights/compare';
import { chartMarkers } from '@/lib/server/dashboard/overview/markers';
import OverviewTakeaways from './components/OverviewTakeaways';
import AttentionList from '@/components/product/AttentionList';
import { attentionItems } from '@/lib/shared/insights/attention';
import { insightsEnabled, openUrgentIssues } from '@/lib/server/insights/issues';
import { audienceObservations, hourlyObservations } from '@/lib/server/dashboard/insights/charts';
import InsightsEntry from '@/components/insights/InsightsEntry';
import BookingCheckin from './components/BookingCheckin';
import { loadCheckins } from '@/lib/server/bookings/checkins';
import { createAdminClient } from '@/lib/server/supabase/admin';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
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
  // Entities only name the live KPIs; their failure must not hide live performance.
  const [live, entities] = await Promise.all([
    loadInsights(context),
    loadOverviewEntities(context.businessId, context.account!.id).catch((error) => {
      console.error("Overview ad-set names unavailable", { code: (error as { code?: string })?.code });
      return null;
    }),
  ]);
  // The KPIs and chart always say "Results". They used to switch to "WhatsApp conversations" whenever
  // every ad set in the period happened to be a WhatsApp one, so the same card changed its name when
  // the period changed (7D "Results", 30D "WhatsApp conversations"). The ⓘ help explains what counts.
  const withContext = <T extends Pick<ControlPerformance, 'metrics' | 'deltas' | 'comparison'>>(view: T, daily: Insight[] | null) => {
    const ctx = periodContext({ daily, hourly: live.hourly, platform: context.publisher, period, today: context.today, now: context.now, zone: context.zone, currency: context.account!.currency_code });
    // Today's badges compare against the "Yesterday by now" figure the card prints beside them.
    return { ...view, ...sameHourComparison(period, view.metrics, ctx, { deltas: view.deltas, comparison: view.comparison }), context: ctx, result: undefined };
  };
  if (live.daily !== null && !(resourceRefreshEnabled() && context.publisher === 'combined')) {
    return withContext({ ...livePerformance(live.daily, context.publisher, period, context.today, context.account!.currency_code), ...comparisons(live.daily, context.publisher, period, context.today, context.account!.currency_code, live.fetchedAt, context.now, { timezone: context.timezoneUnavailable ? undefined : context.zone, cutoff: process.env.DEEPVISOR_KPI_TODAY_CUTOFF ?? '20:00' }) }, live.daily);
  }
  if (context.publisher !== 'combined') return withContext(livePerformance([], context.publisher, period, context.today, context.account!.currency_code), null);
  // Saved rows are scoped through the entity list, so the stored path still requires it.
  if (!entities) throw new Error("Overview entities unavailable");
  const rows = await loadOverviewHistory(context.businessId, context.account!.id, context.today);
  const stored = controlPerformance(rows, entities, period, context.today, context.account!.currency_code);
  const dated: Insight[] = rows.map(row => ({ ...row, externalId: row.entity_id, publisher: 'combined', label: '' }));
  if (resourceRefreshEnabled()) {
    return withContext({
      ...stored,
      ...comparisons(dated, 'combined', period, context.today, context.account!.currency_code, live.canonicalFetchedAt ?? '', context.now,
        { timezone: context.timezoneUnavailable ? undefined : context.zone, cutoff: process.env.DEEPVISOR_KPI_TODAY_CUTOFF ?? '20:00' })
    }, dated);
  }
  return withContext({ ...stored, deltas: {}, comparison: 'Comparison unavailable while using stored fallback data.' }, dated);
});
function timestamp(at: string | null | undefined, zone: string, intl: string) {
  return at && Number.isFinite(Date.parse(at))
    ? new Intl.DateTimeFormat(intl, {
      timeZone: zone,
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(at))
    : null;
}
function Loading({
  kind = "rows",
}: {
  kind?: "rows" | "metrics" | "chart" | "board";
}) {
  // Skeletons mirror the final layouts so sections don't jump as they stream in.
  const bar = (className = "") => <span className={`${classes.skeleton} ${className}`} />;
  if (kind === "metrics") return (
    <div role="status" aria-label="Loading performance" className={classes.skeletonKpis}>
      {[0, 1, 2, 3].map(i => <div key={i}>{bar(classes.skLabel)}{bar(classes.skValue)}{bar(classes.skFoot)}</div>)}
    </div>
  );
  if (kind === "chart") return (
    <div role="status" aria-label="Loading chart" className={classes.skeletonChart}>
      <div>{[0, 1, 2, 3].map(i => <span key={i} className={`${classes.skeleton} ${classes.skTab}`} />)}</div>
      {bar(classes.skPlot)}
    </div>
  );
  if (kind === "board") return (
    <div role="status" aria-label="Loading advertising" className={classes.skeletonBoard}>
      {bar(classes.skHeading)}
      <div className={classes.skCard}>
        {bar(classes.skMedia)}
        <div>{bar(classes.skTitle)}{bar(classes.skStats)}{bar(classes.skFoot)}<div className={classes.skMeters}>{bar()}{bar()}</div></div>
      </div>
    </div>
  );
  return (
    <div role="status" aria-label="Loading dashboard section" className={classes.loading}>
      <PixelCompanion state="analyzing" size={32} />
      <span />
      <span />
      <span />
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
/** The weekly check-in read, shared by the question card and the note in the Results tooltip. */
const checkins = cache(async (context: OverviewContext) => {
  if (context.decisionPreview || context.timezoneUnavailable) return null;
  return loadCheckins(createAdminClient(), { businessId: context.businessId, adAccountId: context.account!.id, today: context.today }).catch((error) => {
    console.error("Booking check-in unavailable", { code: (error as { code?: string })?.code });
    return null;
  });
});
/** "You reported 11 appointments in 3 of the last 4 weeks…" for the Results tooltip; nothing until a week is answered. */
async function AppointmentsNote({ context }: { context: OverviewContext }) {
  const summary = (await checkins(context))?.summary;
  if (!summary?.weeksAnswered) return null;
  const [t, locale] = await Promise.all([getTranslations("checkin"), getLocale()]);
  const currency = context.account!.currency_code;
  const cost = summary.costPerBooking !== null && currency
    ? new Intl.NumberFormat(locale === "es" ? "es-US" : "en-US", { style: "currency", currency }).format(summary.costPerBooking)
    : null;
  return <>{t("note", { bookings: summary.bookings ?? 0, answered: summary.weeksAnswered, weeks: summary.weeksWithSpend })}{cost ? t("noteCost", { cost }) : null}</>;
}
/** The ⓘ next to the controls. It waits for the comparison so it can say when that is limited. */
async function CoverageInfo({ context, period, base }: { context: OverviewContext; period: Period; base: Omit<DataInfoProps, "coverage"> }) {
  const view = await performance(context, period).catch(() => null);
  const reference = view?.context;
  return <DataInfo {...base} coverage={reference?.coverage ?? null} />;
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
    <ControlMetrics view={view} note={<Suspense fallback={null}><AppointmentsNote context={context} /></Suspense>} />
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
  const [view, markers] = await Promise.all([
    performance(context, period).catch(() => null),
    // Markers are optional context; their failure never hides the chart.
    loadChartMarkerSources(context.businessId, context.account!.id, periodRange(period === "today" ? "7d" : period, context.today).since)
      .then(({ entities, events }) => chartMarkers(entities, events, periodRange(period === "today" ? "7d" : period, context.today).since, context.today, context.zone))
      .catch(() => []),
  ]);
  return view ? (
    <ControlTrend view={view} markers={markers} />
  ) : (
    <ErrorMessage>Daily trend unavailable.</ErrorMessage>
  );
}
/** Saved ad-set daily rows keyed by Meta ad-set id, in the shape the signal model reads. */
async function storedInsights(context: OverviewContext): Promise<Insight[]> {
  const [rows, entities] = await Promise.all([
    loadOverviewHistory(context.businessId, context.account!.id, context.today),
    loadOverviewEntities(context.businessId, context.account!.id),
  ]);
  const external = new Map(entities.map(e => [e.id, e.external_id]));
  return rows.flatMap(row => { const id = external.get(row.entity_id); return id ? [{ ...row, externalId: id, publisher: 'combined', label: '' } as Insight] : []; });
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
    // Health must use the same saved rows as the card's metrics and the KPI row when those are
    // the source; the live cache is only used when the board itself reads live rows.
    const stored = resourceRefreshEnabled() && context.publisher === 'combined';
    const healthRows = stored ? await storedInsights(context).catch(() => live.daily) : live.daily;
    const signals = adSetSignals(healthRows, view.items.map(i => i.id), live.learningDetail ?? {}, context.today, context.now, context.target);
    return <AdvertisingBoard view={{ ...view, items: advertisingMetrics(view.items, resourceRefreshEnabled() && context.publisher === 'combined' ? null : live.daily, context.publisher, period, context.today, view.currency) }} learning={live.learning} signals={signals} filtered={context.publisher !== 'combined'} />;
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
  if (!agencyEnabled() && !context.decisionPreview) return null;
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


/**
 * Weekly "how many became appointments?" check-in. Optional: a failure or an account without a
 * timezone (unreliable week boundaries) renders nothing rather than blocking the page.
 */
async function Checkin({ context }: { context: OverviewContext }) {
  const [{ role }, view] = await Promise.all([getRequiredAppContext(), checkins(context)]);
  return view ? <BookingCheckin view={view} canAnswer={role === 'owner' || role === 'admin'} /> : null;
}
/** Meta issues that stop delivery and ad sets about to end, above everything else. */
async function Attention({ context, period }: { context: OverviewContext; period: Period }) {
  const [issues, view] = await Promise.all([
    openUrgentIssues(context.businessId, context.account!.id).catch((error) => {
      console.error("Overview issues unavailable", error);
      return [];
    }),
    // Same cached call the advertising board makes, so this adds no extra read.
    loadExploration(period, "adset", null, true).catch(() => null),
  ]);
  const items = attentionItems(issues, view?.items ?? [], { now: context.now, zone: context.zone, ...(await attentionText()) });
  return <AttentionList items={items} />;
}
async function Content({ requestedPeriod, preview, platform }: { requestedPeriod: Period | null; preview: boolean; platform: Publisher }) {
  const context: OverviewContext = { ...await loadOverviewContext(), decisionPreview: preview, publisher: platform };
  const connected =
    context.platform?.status === "connected" &&
    context.platform.vendor === "meta";
  const savedMetaAccount = context.platform?.vendor === "meta" &&
    ["connected", "error", "needs_reauth"].includes(context.platform.status);
  if (!savedMetaAccount || !context.account)
    return <SetupChecklist metaConnectedWithoutAccount={savedMetaAccount && !context.account} />;
  const sync = await loadOverviewSync(context.businessId, context.account.id);
  if (
    !sync.failed &&
    (sync.data
      ? !sync.data.firstFullSyncCompleted
      : !context.account.last_synced)
  )
    return (
      <section className={classes.emptyState}>
        <PixelCompanion size={64} state={sync.data?.activeJobStatus === 'failed' ? 'attention' : ['queued', 'running'].includes(sync.data?.activeJobStatus ?? '') ? 'analyzing' : 'idle'} />
        <h1>Setting up your account</h1>
        <p>
          {sync.data?.activeJobStatus === "failed"
            ? "Setting up your account could not finish. Check Connections before trying again."
            : "Your results appear here as soon as your account is set up."}
        </p>
        {sync.data?.activeJobId && ['queued', 'running'].includes(sync.data.activeJobStatus ?? '')
          ? <AccountSetupProgress jobId={sync.data.activeJobId} />
          : <RefreshOverview />}
        <Link href="/integration">Connections</Link>
      </section>
    );
  const live = await loadInsights(context);
  // Reuses the already-loaded daily insights: open on Today only when something delivered today.
  const delivering = deliveredToday(live.daily, platform, context.today);
  const period: Period = requestedPeriod ?? (delivering ? "today" : "7d");
  const audience = live.audience === null ? null : audienceObservations(selectRows(live.audience, platform, period, context.today));
  const hourly = live.hourly === null ? null : hourlyObservations(selectRows(live.hourly, platform, period, context.today));
  const retrievedAt = resourceRefreshEnabled() && platform === 'combined' ? live.canonicalFetchedAt : live.fetchedAt;
  const age = retrievedAt ? Date.parse(context.now) - Date.parse(retrievedAt) : Infinity;
  // The page only speaks up when the numbers are unavailable or old; the rest sits behind the ⓘ.
  const [tInfo, locale] = await Promise.all([getTranslations('dashboardInfo'), getLocale()]);
  const readAt = timestamp(retrievedAt, context.zone, locale === 'es' ? 'es-US' : 'en-US');
  const notice = !(live.source === 'api' || live.source === 'stored')
    ? tInfo(platform === 'combined' ? 'savedData' : 'platformUnavailable')
    : readAt && age > 6 * 3600_000 ? tInfo('stale', { time: readAt }) : null;
  const info = { live: delivering, retrievedAt: retrievedAt ?? null, storedSyncAt: context.account.last_synced ?? null, zone: context.zone, disabled: preview };
  return <div className={classes.page} data-publisher={platform}>
    {preview && <DecisionPreviewBanner page="dashboard" />}
    <DashboardHeader
      businessName={context.businessName}
      accountName={context.account.name ?? ""}
      platform={platform}
      period={period}
      insights={insightsEnabled() ? <InsightsEntry countIssues={false} /> : null}
      notice={notice}
      info={<Suspense key={`${period}:${platform}`} fallback={<DataInfo {...info} coverage={null} />}><CoverageInfo context={context} period={period} base={info} /></Suspense>}
    />
    {!connected && <ErrorMessage>Meta connection needs attention. Saved data remains available; reconnect in Connections.</ErrorMessage>}
    <Suspense key={`attention:${period}`} fallback={null}><Attention context={context} period={period} /></Suspense>
    <section aria-label="Account performance" className={classes.kpiSection}><Suspense key={`${period}:${platform}`} fallback={<Loading kind="metrics" />}><Metrics context={context} period={period} /></Suspense></section>
    <Suspense fallback={null}><Checkin context={context} /></Suspense>
    <section className={classes.workspaceChart} aria-label="Performance chart"><Suspense key={`${period}:${platform}`} fallback={<Loading kind="chart" />}><Trend context={context} period={period} /></Suspense></section>
    <section className={classes.board}><Suspense key={`${period}:${platform}`} fallback={<Loading kind="board" />}><Board period={period} context={context} /></Suspense></section>
    <OverviewTakeaways audience={audience} hourly={hourly} currency={context.account.currency_code} platform={platform} audienceCombinedOnly={live.audience?.some(r => r.publisher === 'combined-only') ?? false} hourlyCombinedOnly={live.hourly?.some(r => r.publisher === 'combined-only') ?? false} />
    <Suspense fallback={null}><Activity context={context} /></Suspense>
  </div>;
}
export default async function OverviewPage({ searchParams }: { searchParams: Promise<{ period?: string; preview?: string; publisher?: string }> }) {
  const params = await searchParams;
  return <DesignSurface label="Overview"><Suspense fallback={<Loading kind="chart" />}><Content requestedPeriod={params.period === undefined ? null : parsePeriod(params.period)} preview={isDecisionPreview(params.preview)} platform={publisher(params.publisher)} /></Suspense></DesignSurface>;
}
