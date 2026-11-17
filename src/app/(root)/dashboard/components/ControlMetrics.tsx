import { Tooltip } from '@mantine/core';
import type { PeriodContext } from "@/lib/server/dashboard/insights/compare";
import type { ControlPerformance } from "@/lib/server/dashboard/overview/controlModel";
import type { Delta } from "@/lib/server/campaigns/exploration/types";
import classes from "./ControlCenter.module.css";
import { RESULT_LABELS, resultAppsNote, type ResultDefinition } from "@/lib/shared/performance/resultChannel";

export const metricLabels = {
  spend: "Spend",
  results: "Results",
  costPerResult: "Cost / result",
  ctr: "CTR",
};
export type ControlMetric = keyof typeof metricLabels;
/** KPI labels with "results" named for what they are (WhatsApp conversations, leads, …). */
export function metricLabelsFor(result?: ResultDefinition): Record<ControlMetric, string> {
  const words = RESULT_LABELS[result?.kind ?? "results"];
  return { ...metricLabels, results: words.metric, costPerResult: words.cost };
}
const METRIC_HELP: Record<Exclude<ControlMetric, "results">, string> = {
  spend: "Reported advertising spend in account currency.",
  ctr: "Clicks divided by impressions, multiplied by 100.",
  costPerResult: "Spend divided by the count to the left. Unavailable when that count is zero or unknown.",
};
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
  const labels = metricLabelsFor(view.result);
  const help = (key: ControlMetric) => key === "results" ? RESULT_LABELS[view.result?.kind ?? "results"].help : METRIC_HELP[key];
  const appsNote = view.result ? resultAppsNote(view.result) : null;
  return (
    <>
      {referenceNote && referenceLabel && (
        <p className={classes.kpiCoverage}>
          {referenceLabel} has data for only {referenceNote.replace(/ with data$/, "")}, so comparisons are limited. Missing days are not counted as zero.
        </p>
      )}
      <dl className={classes.kpis}>
        {(Object.keys(labels) as ControlMetric[]).map((key) => (
          <div key={key}>
            <dt>{labels[key]} <Tooltip events={{ hover: true, focus: true, touch: true }} multiline w={260} label={key === "results" && appsNote ? `${help(key)} From ${appsNote}.` : help(key)}><button type="button" aria-label={`About ${labels[key]}`}>ⓘ</button></Tooltip></dt>
            <div className={classes.kpiValueRow}>
              <dd title={metricValue(key, view.metrics[key], view.currency)}>
                {metricValue(key, view.metrics[key], view.currency, true)}
              </dd>
              <Sparkline values={view.points.map((p) => p[key])} label={`${labels[key]} over the last ${view.points.length} days`} />
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
