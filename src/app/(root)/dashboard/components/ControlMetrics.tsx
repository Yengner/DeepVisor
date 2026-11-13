import { Tooltip } from '@mantine/core';
import type { PeriodContext } from "@/lib/server/dashboard/insights/compare";
import type { ControlPerformance } from "@/lib/server/dashboard/overview/controlModel";
import type { Delta } from "@/lib/server/campaigns/exploration/types";
import classes from "./ControlCenter.module.css";

export const metricLabels = {
  spend: "Spend",
  results: "Results",
  costPerResult: "Cost / result",
  ctr: "CTR",
};
export type ControlMetric = keyof typeof metricLabels;
export function metricValue(
  key: ControlMetric,
  value: number | null,
  currency: string | null,
  compact = false,
) {
  if (value === null || !Number.isFinite(value)) return "—";
  if (["spend", "costPerResult"].includes(key) && !currency) return "—";
  return (
    new Intl.NumberFormat("en", {
      ...(["spend", "costPerResult"].includes(key)
        ? { style: "currency", currency: currency! }
        : {}),
      maximumFractionDigits: key === "results" ? 0 : 2,
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
  return (
    <>
      <dl className={classes.kpis}>
        {(Object.keys(metricLabels) as ControlMetric[]).map((key) => (
          <div key={key}>
            <dt>{metricLabels[key]} <Tooltip events={{ hover: true, focus: true, touch: true }} multiline w={260} label={key === 'results' ? 'Reported leads + messaging conversations + call actions. These are not verified bookings or unique customers.' : key === 'spend' ? 'Reported advertising spend in account currency.' : key === 'ctr' ? 'Clicks divided by impressions, multiplied by 100.' : 'Spend divided by reported results. Unavailable when results are zero or unknown.'}><button type="button" aria-label={`About ${metricLabels[key]}`}>ⓘ</button></Tooltip></dt>
            <div className={classes.kpiValueRow}>
              <dd title={metricValue(key, view.metrics[key], view.currency)}>
                {metricValue(key, view.metrics[key], view.currency, true)}
              </dd>
              <Sparkline values={view.points.map((p) => p[key])} label={`${metricLabels[key]} over the last ${view.points.length} days`} />
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
