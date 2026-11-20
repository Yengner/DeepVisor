import { Tooltip } from '@mantine/core';
import type { PeriodContext } from "@/lib/server/dashboard/insights/compare";
import type { ControlPerformance } from "@/lib/server/dashboard/overview/controlModel";
import type { Delta } from "@/lib/server/campaigns/exploration/types";
import classes from "./ControlCenter.module.css";
import { useTranslations } from "next-intl";
import type { ResultDefinition } from "@/lib/shared/performance/resultChannel";
import TickerNumber, { SyncSpider, type Polarity } from "./TickerNumber";

/** Which way is good news, for the refresh glow: spend is neither. */
const POLARITY: Record<"spend" | "results" | "costPerResult" | "ctr", Polarity> = {
  spend: "neutral",
  results: "up-good",
  costPerResult: "up-bad",
  ctr: "up-good",
};

export const CONTROL_METRICS = ["spend", "results", "costPerResult", "ctr"] as const;
export type ControlMetric = (typeof CONTROL_METRICS)[number];

/** KPI labels and help in the viewer's language, with "results" named for what they are. */
export function useMetricLabels(result?: ResultDefinition) {
  const t = useTranslations();
  const kind = result?.kind ?? "results";
  const labels: Record<ControlMetric, string> = {
    spend: t("metrics.spend"),
    results: t(`results.${kind}.metric`),
    costPerResult: t(`results.${kind}.cost`),
    ctr: t("metrics.ctr"),
  };
  const help: Record<ControlMetric, string> = {
    spend: t("metrics.help.spend"),
    results: t(`results.${kind}.help`),
    costPerResult: t("metrics.help.costPerResult"),
    ctr: t("metrics.help.ctr"),
  };
  const apps = result?.kind === "conversations" && result.apps.length ? result.apps.map((a) => t(`apps.${a}`)).join(" · ") : null;
  return { labels, help, short: t(`results.${kind}.short`), appsNote: apps ? t("metrics.fromApps", { apps }) : null, t };
}
/** Extra chartable metrics, offered behind the chart's "More" menu (not KPI cards). */
export type ExtraMetric = "impressions" | "clicks" | "cpm";
const MONEY_KEYS = ["spend", "costPerResult", "cpm"];
export function metricValue(
  key: ControlMetric | ExtraMetric,
  value: number | null,
  currency: string | null,
  compact = false,
) {
  if (value === null || !Number.isFinite(value)) return "—";
  if (MONEY_KEYS.includes(key) && !currency) return "—";
  return (
    new Intl.NumberFormat("en", {
      ...(MONEY_KEYS.includes(key)
        ? { style: "currency", currency: currency! }
        : {}),
      maximumFractionDigits: key === "results" || key === "impressions" || key === "clicks" ? 0 : 2,
      ...(compact && value >= 10000 ? { notation: "compact" } : {}),
    }).format(value) + (key === "ctr" ? "%" : "")
  );
}
export function MetricDelta({
  change,
  description,
}: {
  change?: Delta;
  description: string | null;
}) {
  return change ? (
    <Tooltip label={description} multiline w={300} events={{ hover: true, focus: true, touch: true }}><span tabIndex={0}
      className={`${classes.delta} ${classes[change.tone]}`}
      title={description ?? undefined}
    >
      {change.value > 0 ? "↑" : change.value < 0 ? "↓" : "↔"}{" "}
      {Math.abs(change.value).toFixed(1)}
      {change.unit}
      <span className={classes.srOnly}> {description}</span>
    </span></Tooltip>
  ) : null;
}
function Sparkline({ values, label }: { values: Array<number | null>; label: string }) {
  const known = values.filter((v): v is number => v !== null);
  if (known.length < 2) return null;
  const max = Math.max(...known), min = Math.min(...known);
  const span = max - min || 1;
  const w = 96, h = 28, step = w / Math.max(1, values.length - 1);
  // Gaps stay gaps: break the path at missing days.
  let path = "", open = false;
  values.forEach((v, i) => {
    if (v === null) { open = false; return; }
    const x = i * step, y = h - 3 - ((v - min) / span) * (h - 6);
    path += `${open ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)} `;
    open = true;
  });
  return (
    <svg className={classes.sparkline} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label={label}>
      <path d={path} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export default function ControlMetrics({ view }: { view: ControlPerformance & { context?: PeriodContext } }) {
  const reference = view.context?.reference ?? null;
  const referenceLabel = view.context?.referenceLabel ?? null;
  const referenceNote = view.context?.referenceNote ?? null;
  const { labels, help, appsNote, t } = useMetricLabels(view.result);
  return (
    <>
      {referenceNote && referenceLabel && (
        <p className={classes.kpiCoverage}>
          {referenceLabel} has data for only {referenceNote.replace(/ with data$/, "")}, so comparisons are limited. Missing days are not counted as zero.
        </p>
      )}
      <dl className={classes.kpis}>
        {CONTROL_METRICS.map((key, index) => (
          <div key={key} className={classes.kpiCard}>
            <SyncSpider announce={index === 0} />
            <dt>{labels[key]} <Tooltip events={{ hover: true, focus: true, touch: true }} multiline w={260} label={key === "results" && appsNote ? `${help[key]} ${appsNote}` : help[key]}><button type="button" aria-label={t("metrics.about", { label: labels[key] })}>ⓘ</button></Tooltip></dt>
            <div className={classes.kpiValueRow}>
              <dd title={metricValue(key, view.metrics[key], view.currency)}>
                <TickerNumber text={metricValue(key, view.metrics[key], view.currency, true)} value={view.metrics[key]} polarity={POLARITY[key]} />
              </dd>
              <Sparkline values={view.points.map((p) => p[key])} label={t("metrics.overDays", { label: labels[key], days: view.points.length })} />
            </div>
            <div className={classes.kpiFoot}>
              <MetricDelta
                change={view.deltas[key]}
                description={view.comparison}
              />
              {reference && referenceLabel && (
                <span className={classes.kpiReference}>
                  {referenceLabel} {metricValue(key, reference[key], view.currency, true)}
                </span>
              )}
            </div>
          </div>
        ))}
      </dl>
    </>
  );
}
