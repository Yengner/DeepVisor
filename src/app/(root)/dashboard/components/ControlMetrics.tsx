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
  return change && change.value !== 0 ? (
    <span
      className={`${classes.delta} ${classes[change.tone]}`}
      title={description ?? undefined}
    >
      {change.value > 0 ? "↑" : change.value < 0 ? "↓" : "↔"}{" "}
      {Math.abs(change.value).toFixed(1)}
      {change.unit}
      <span className={classes.srOnly}> {description}</span>
    </span>
  ) : null;
}
export default function ControlMetrics({ view }: { view: ControlPerformance }) {
  return (
    <>
      <dl className={classes.kpis}>
        {(Object.keys(metricLabels) as ControlMetric[]).map((key) => (
          <div key={key}>
            <dt>{metricLabels[key]}</dt>
            <dd title={metricValue(key, view.metrics[key], view.currency)}>
              {metricValue(key, view.metrics[key], view.currency, true)}
            </dd>
            <MetricDelta
              change={view.deltas[key]}
              description={view.comparison}
            />
          </div>
        ))}
      </dl>
      <p className={classes.periodNote}>
        Includes today, partial{view.partial ? " · Incomplete period data" : ""}
        {view.comparison ? " · Changes compare completed days" : ""}
      </p>
    </>
  );
}
