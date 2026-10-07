import { cache, Suspense } from "react";
import Link from "next/link";
import {
  IconArrowRight,
  IconCircleCheck,
  IconBrandMeta,
} from "@tabler/icons-react";
import {
  loadOverviewContext,
  loadOverviewHistory,
  loadOverviewDecisions,
  loadOverviewEntities,
  loadOverviewPolicy,
  loadOverviewSync,
  type OverviewContext as LiveOverviewContext,
} from "@/lib/server/dashboard/overview/load";
import {
  decisionViews,
  modeLabel,
  parsePeriod,
  performanceView,
} from "@/lib/server/dashboard/overview/model";
import {
  attentionSummary,
  controlPerformance,
  recentChanges,
} from "@/lib/server/dashboard/overview/controlModel";
import type { Period } from "@/lib/server/dashboard/overview/types";
import { loadExploration } from "@/lib/server/campaigns/exploration/load";
import StatusBadge from "@/components/product/StatusBadge";
import { PeriodControl, RefreshOverview } from "./components/OverviewControls";
import ControlMetrics from "./components/ControlMetrics";
import ControlTrend from "./components/ControlTrend";
import AdvertisingBoard from "./components/AdvertisingBoard";
import classes from "./components/ControlCenter.module.css";
import { buildDecisionPreview, isDecisionPreview } from '@/lib/server/decisions/preview';
import DecisionPreviewBanner from '@/components/product/DecisionPreviewBanner';
type OverviewContext = LiveOverviewContext & { decisionPreview?: boolean };

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
  const [rows, entities] = await Promise.all([
    loadOverviewHistory(context.businessId, context.account!.id, context.today),
    loadOverviewEntities(context.businessId, context.account!.id),
  ]);
  return controlPerformance(
    rows,
    entities,
    period,
    context.today,
    context.account!.currency_code,
  );
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
async function Check({ context }: { context: OverviewContext }) {
  const result = await decisions(context).catch((error) => {
    console.error("Overview checks unavailable", error);
    return null;
  });
  return (
    <p>
      {result
        ? result.view.lastCheck
          ? `Checked ${timestamp(result.view.lastCheck, context.zone)}`
          : "No completed check recorded"
        : "Check status unavailable"}
    </p>
  );
}
async function Mode({ context }: { context: OverviewContext }) {
  const policy = await loadOverviewPolicy(context.businessId);
  const mode = modeLabel(policy.data?.mode ?? null, policy.failed);
  return (
    <details className={classes.mode}>
      <summary>
        {mode === "Unavailable" ? "Mode unavailable" : `${mode} mode`}
      </summary>
      <p>
        Configured business policy.
        {mode === "Unavailable"
          ? " The policy could not be loaded; do not assume automation is on or off."
          : mode === "SHADOW"
            ? " Observations do not execute advertising changes."
            : mode === "REVIEW"
              ? " Eligible changes require approval. Approval is not execution."
              : mode === "LIMITED AUTO"
                ? " Limited automation still requires all safety checks and execution controls. Configuration does not confirm execution is enabled."
                : " Automatic changes are off."}
      </p>
    </details>
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
async function Attention({ context }: { context: OverviewContext }) {
  const result = await decisions(context).catch(() => null);
  if (!result)
    return (
      <ErrorMessage>
        Attention status unavailable. Check Decisions for saved records.
      </ErrorMessage>
    );
  const item = result.view.attention[0];
  const title = attentionSummary(
    result.states,
    result.allAttention.length,
    result.policyUnavailable,
  );
  if (!item)
    return (
      <div className={classes.quietAttention}>
        <strong>
          {title === "Everything looks stable" && <IconCircleCheck size={20} />}
          {title}
        </strong>
        {title === "Everything looks stable" && (
          <p>No action needed right now.</p>
        )}
      </div>
    );
  return (
    <div className={classes.attentionBody}>
      <h2>
        {item.state === "Recommendation" ||
        item.state === "Shadow recommendation"
          ? "Worth a look"
          : "Needs you"}
      </h2>
      <h3>{item.entity}</h3>
      <p>{item.title}</p>
      {item.detail && <p>{item.detail}</p>}
      <details>
        <summary>Why this matters</summary>
        <p>{item.reason}</p>
        {item.detail && <p className={classes.mobileChange}>{item.detail}</p>}
        {item.evidence && (
          <p>
            {item.evidence} · {item.period}
          </p>
        )}
        {item.confidence !== null && (
          <p>Confidence {Math.round(item.confidence * 100)}%</p>
        )}
        <p>
          {item.state}
          {item.mode ? ` · ${item.mode}` : ""}
        </p>
        {result.policyUnavailable && <p>Approval eligibility unavailable</p>}
      </details>
      <Link href={context.decisionPreview ? '/decisions?preview=decisions' : '/decisions'}>
        Review decision <IconArrowRight size={16} />
      </Link>
      {result.allAttention.length > 1 && (
        <p className={classes.more}>
          +{result.allAttention.length - 1} more open{" "}
          {result.allAttention.length === 2 ? "item" : "items"}
        </p>
      )}
    </div>
  );
}
async function Board({ period }: { period: Period }) {
  const view = await loadExploration(period, "adset", null, true).catch(
    (error) => {
      console.error("Overview advertising unavailable", error);
      return null;
    },
  );
  return view ? (
    <AdvertisingBoard view={view} />
  ) : (
    <ErrorMessage>
      Advertising previews and performance are temporarily unavailable.
    </ErrorMessage>
  );
}
async function Monitoring({ context }: { context: OverviewContext }) {
  const result = await decisions(context).catch(() => null);
  if (!result)
    return <ErrorMessage>Today’s checks are unavailable.</ErrorMessage>;
  const c = result.view.counts;
  return (
    <>
      <div className={classes.monitorHeader}>
        <h2>DeepVisor today</h2>
        <StatusBadge status="Meta" />
      </div>
      <dl>
        {(
          [
            ["CHECKED", c.evaluations],
            ["NO CHANGE", c.holds],
            ["WATCHING", c.recommendations],
            [
              "NEEDS YOU",
              result.policyUnavailable ? null : result.allAttention.length,
            ],
          ] as const
        ).map(([label, value]) => (
          <div key={label}>
            <dd>{value ?? "—"}</dd>
            <dt>{label}</dt>
          </div>
        ))}
      </dl>
      <details>
        <summary>Check details</summary>
        <p>
          {c.checked} distinct ad sets checked today in {context.zone}. Checks,
          no-change decisions and recommendations can overlap. Open attention
          includes unresolved items from earlier days. No change does not mean
          overall account health.
        </p>
        <p>
          {c.blocked} blocked · {c.shadow ?? "Unknown"} shadow observations ·{" "}
          {c.executed} successful executions.
        </p>
        {result.view.provenanceUnavailable && (
          <p>Some historical modes are unavailable.</p>
        )}
        <Link href={context.decisionPreview ? '/decisions?preview=decisions' : '/decisions'}>All decisions</Link>
      </details>
    </>
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
async function Content({ period, preview }: { period: Period; preview: boolean }) {
  const context: OverviewContext = { ...await loadOverviewContext(), decisionPreview: preview };
  const connected =
    context.platform?.status === "connected" &&
    context.platform.vendor === "meta";
  if (!connected || !context.account)
    return (
      <section className={classes.emptyState}>
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
  const target = performanceView({
    rows: [],
    entities: [],
    period,
    today: context.today,
    currency: context.account.currency_code,
    target: context.target,
  }).targetLabel;
  return (
    <div className={classes.page}>
      {preview && <DecisionPreviewBanner page="dashboard" />}
      <div className={classes.layout}>
        <div className={classes.inkBackdrop} aria-hidden="true" />
        <header className={classes.identity}>
          <div>
            <h1>{context.businessName}</h1>
            <p>{context.account.name ?? "Selected Meta account"}</p>
            <Suspense fallback={<p>Loading last check…</p>}>
              <Check context={context} />
            </Suspense>
            <details className={classes.contextDetails}>
              <summary>Account details</summary>
              <p>
                {sync.failed
                  ? "Sync status unavailable"
                  : sync.data?.activeJobStatus === "failed"
                    ? "Last sync job failed"
                    : ["queued", "running"].includes(
                          sync.data?.activeJobStatus ?? "",
                        )
                      ? "Sync in progress"
                      : "Last successful sync"}{" "}
                · {timestamp(context.account.last_synced, context.zone)}
              </p>
              <p>
                {context.zone}
                {context.timezoneUnavailable
                  ? " · Account timezone unavailable; using UTC"
                  : ""}
              </p>
              <p>
                {context.profileUnavailable
                  ? "Saved preferences unavailable"
                  : target
                    ? `Saved lead-cost preference: ${target}. Target comparison unavailable.`
                    : "No saved lead-cost preference."}
              </p>
            </details>
          </div>
          <div className={classes.identityRight}>
            <span className={classes.connected} aria-label="Meta connected">
              <IconBrandMeta size={17} /> Meta{" "}
              <span className={classes.connectionWord}>connected</span>
            </span>
            <Suspense fallback={<span>Loading mode…</span>}>
              <Mode context={context} />
            </Suspense>
          </div>
        </header>
        <section className={classes.metrics} aria-label="Account performance">
          <Suspense key={period} fallback={<Loading kind="metrics" />}>
            <Metrics context={context} period={period} />
          </Suspense>
        </section>
        <section className={classes.trend} aria-label="Performance chart">
          <Suspense key={period} fallback={<Loading kind="chart" />}>
            <Trend context={context} period={period} />
          </Suspense>
        </section>
        <aside className={classes.attention} aria-label="Attention and period">
          <div className={classes.controls}>
            <PeriodControl period={period} />
            <RefreshOverview disabled={preview} />
          </div>
          <Suspense fallback={<Loading />}>
            <Attention context={context} />
          </Suspense>
        </aside>
        <section className={classes.board} aria-label="Your advertising">
          <Suspense key={period} fallback={<Loading kind="board" />}>
            <Board period={period} />
          </Suspense>
        </section>
        <section className={classes.monitor} aria-label="DeepVisor today">
          <Suspense fallback={<Loading />}>
            <Monitoring context={context} />
          </Suspense>
        </section>
        <Suspense fallback={null}>
          <Activity context={context} />
        </Suspense>
      </div>
    </div>
  );
}
export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; preview?: string }>;
}) {
  const params = await searchParams;
  return (
    <Suspense
      fallback={
        <div className={classes.page}>
          <Loading />
          <Loading kind="chart" />
        </div>
      }
    >
      <Content period={parsePeriod(params.period)} preview={isDecisionPreview(params.preview)} />
    </Suspense>
  );
}
