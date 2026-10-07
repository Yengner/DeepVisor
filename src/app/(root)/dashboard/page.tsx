import { cache, Suspense } from "react";
import Link from "next/link";
import {
  loadOverviewContext,
  loadOverviewDaily,
  loadOverviewDecisions,
  loadOverviewEntities,
  loadOverviewSync,
  type OverviewContext,
} from "@/lib/server/dashboard/overview/load";
import {
  decisionViews,
  parsePeriod,
  performanceView,
} from "@/lib/server/dashboard/overview/model";
import type { Period } from "@/lib/server/dashboard/overview/types";
import {
  Activity,
  Attention,
  Badge,
  Monitoring,
  PerformanceMetrics,
  SectionLoading,
  TopUnits,
  Unavailable,
} from "./components/OverviewSections";
import { PeriodControl, RefreshOverview } from "./components/OverviewControls";
import OverviewTrend from "./components/OverviewTrend";
import classes from "./components/Overview.module.css";
import product from '@/components/product/Product.module.css';

const decisions = cache(async (context: OverviewContext) => {
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
  const [rows, entities] = await Promise.all([
    loadOverviewDaily(context.businessId, context.account!.id, context.today),
    loadOverviewEntities(context.businessId, context.account!.id),
  ]);
  return performanceView({
    rows,
    entities,
    period,
    today: context.today,
    currency: context.account!.currency_code,
    target: context.target,
  });
});
function timestamp(at: string | null | undefined, zone: string) {
  return at
    ? new Intl.DateTimeFormat("en", {
        timeZone: zone,
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(at))
    : "Not recorded";
}
async function Sync({ context }: { context: OverviewContext }) {
  const sync = await loadOverviewSync(context.businessId, context.account!.id);
  return (
    <span>
      {sync.failed
        ? "Sync status unavailable"
        : sync.data?.activeJobStatus === "failed"
          ? "Last sync job failed"
          : ["queued", "running"].includes(sync.data?.activeJobStatus ?? "")
            ? "Sync in progress"
            : !sync.data?.firstFullSyncCompleted
              ? "Initial sync pending"
              : "Account synced"}{" "}
      · Last successful sync:{" "}
      {timestamp(context.account?.last_synced, context.zone)}
    </span>
  );
}
async function LastCheck({ context }: { context: OverviewContext }) {
  const result = await decisions(context).catch(() => null);
  if (result) {
    return (
      <span>
        Last completed evaluation:{" "}
        {timestamp(result.view.lastCheck, context.zone)}
      </span>
    );
  }
  return <span>Evaluation status unavailable</span>;
}
async function Performance({
  context,
  period,
}: {
  context: OverviewContext;
  period: Period;
}) {
  const view = await performance(context, period).catch(() => null);
  if (view) {
    return (
      <PerformanceMetrics
        view={view}
        profileUnavailable={context.profileUnavailable}
      />
    );
  } else {
    return (
      <Unavailable>
        Performance is temporarily unavailable. Decisions can still load
        independently.
      </Unavailable>
    );
  }
}
async function DecisionSection({
  context,
  kind,
}: {
  context: OverviewContext;
  kind: "attention" | "monitoring" | "activity";
}) {
  const result = await decisions(context).catch(() => null);
  if (result) {
    if (kind === "attention" && result.policyUnavailable)
      return (
        <>
          <Unavailable>
            Approval eligibility is unavailable. Open Decisions to check
            recorded recommendations.
          </Unavailable>
          {result.view.attention.length > 0 && (
            <Attention items={result.view.attention} target={null} />
          )}
        </>
      );
    return kind === "attention" ? (
      <Attention items={result.view.attention} target={null} />
    ) : kind === "monitoring" ? (
      <Monitoring view={result.view} />
    ) : (
      <Activity view={result.view} zone={context.zone} />
    );
  } else {
    return (
      <Unavailable>
        Decision records are temporarily unavailable. This does not mean there
        are no decisions.
      </Unavailable>
    );
  }
}
async function Units({
  context,
  period,
}: {
  context: OverviewContext;
  period: Period;
}) {
  const loaded = await Promise.all([
    loadOverviewDaily(context.businessId, context.account!.id, context.today),
    loadOverviewEntities(context.businessId, context.account!.id),
    decisions(context).catch(() => null),
  ]).catch(() => null);
  if (loaded) {
    const [rows, entities, result] = loaded;
    const view = performanceView({
      rows,
      entities,
      period,
      today: context.today,
      currency: context.account!.currency_code,
      target: context.target,
      states: result?.states,
    });
    return (
      <>
        {!result && (
          <p className={classes.subtle}>
            Decision evidence unavailable; health cannot be confirmed.
          </p>
        )}
        <TopUnits view={view} />
      </>
    );
  } else {
    return (
      <Unavailable>Ad-set performance is temporarily unavailable.</Unavailable>
    );
  }
}
async function Trend({
  context,
  period,
}: {
  context: OverviewContext;
  period: Period;
}) {
  const view = await performance(context, period).catch(() => null);
  if (view) {
    return <OverviewTrend points={view.points} currency={view.currency} />;
  } else {
    return <Unavailable>Daily trend is temporarily unavailable.</Unavailable>;
  }
}
async function Content({ period }: { period: Period }) {
  const context = await loadOverviewContext();
  const connected =
    context.platform?.status === "connected" &&
    context.platform.vendor === "meta";
  return (
    <div className={`${classes.page} ${product.page}`}>
      <header className={classes.header}>
        <div>
          <h1>{context.businessName}</h1>
          <p>
            Overview · {context.account?.name ?? "No Meta account selected"}
          </p>
        </div>
        <RefreshOverview disabled={!connected || !context.account} />
      </header>
      <div className={classes.status}>
        <Badge>{connected ? "Meta connected" : "Connect Meta"}</Badge>
      </div>
      {!connected || !context.account ? (
        <p className={classes.empty}>
          Connect Meta and select an ad account to see performance and
          decisions.{" "}
          <Link className={classes.link} href="/integration">
            Open Connections
          </Link>
        </p>
      ) : (
        <>
          <div className={classes.status}>
            <Suspense fallback={<span>Loading sync status…</span>}>
              <Sync context={context} />
            </Suspense>
            <Suspense fallback={<span>Loading evaluation status…</span>}>
              <LastCheck context={context} />
            </Suspense>
            <span>
              {context.timezoneUnavailable
                ? "Account timezone unavailable; using UTC"
                : context.zone}
            </span>
          </div>
          <div className={classes.grid}>
            <section className={`${classes.section} ${classes.performance}`}>
              <div className={classes.sectionHead}>
                <h2>Performance</h2>
                <PeriodControl period={period} />
              </div>
              <Suspense key={period} fallback={<SectionLoading kind="metrics" />}>
                <Performance context={context} period={period} />
              </Suspense>
            </section>
            {(["attention", "monitoring", "activity"] as const).map((kind) => (
              <section
                key={kind}
                className={`${classes.section} ${classes[kind]}`}
              >
                <div className={classes.sectionHead}>
                  <h2>
                    {kind === "attention"
                      ? "Needs attention"
                      : kind === "monitoring"
                        ? "DeepVisor today"
                        : "Activity today"}
                  </h2>
                  {kind === "attention" && (
                    <Link className={classes.link} href="/decisions">
                      All decisions
                    </Link>
                  )}
                </div>
                <Suspense fallback={<SectionLoading kind={kind==='attention'?'attention':'activity'} />}>
                  <DecisionSection context={context} kind={kind} />
                </Suspense>
              </section>
            ))}
            <section className={`${classes.section} ${classes.units}`}>
              <div className={classes.sectionHead}>
                <h2>Top ad sets</h2>
                <Link className={classes.link} href="/campaigns">
                  Campaigns
                </Link>
              </div>
              <Suspense key={period} fallback={<SectionLoading />}>
                <Units context={context} period={period} />
              </Suspense>
            </section>
            <section className={`${classes.section} ${classes.trend}`}>
              <div className={classes.sectionHead}>
                <h2>Daily trend</h2>
                <span className={classes.subtle}>
                  {period === "30d" ? "30 days" : "7 days"} · Today is partial
                </span>
              </div>
              <Suspense key={period} fallback={<SectionLoading kind="chart" />}>
                <Trend context={context} period={period} />
              </Suspense>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const params = await searchParams;
  return (
    <Suspense
      fallback={
        <div className={classes.page}>
          <SectionLoading />
          <SectionLoading />
        </div>
      }
    >
      <Content period={parsePeriod(params.period)} />
    </Suspense>
  );
}
