import type { ReactNode } from "react";
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
const deltaText = (change: Delta) =>
  `${change.value > 0 ? "↑" : change.value < 0 ? "↓" : "↔"} ${Math.abs(change.value).toFixed(1)}${change.unit}`;
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
      {deltaText(change)}
      <span className={classes.srOnly}> {description}</span>
    </span></Tooltip>
  ) : null;
}
/** A label whose last word never parts from the info mark after it, so the mark never wraps alone. */
function LabelWithInfo({ label, children }: { label: string; children: ReactNode }) {
  const cut = label.lastIndexOf(" ");
  const head = cut === -1 ? "" : label.slice(0, cut + 1);
  const last = cut === -1 ? label : label.slice(cut + 1);
  return <>{head}<span className={classes.nowrap}>{last} {children}</span></>;
}

/**
 * A KPI figure whose hover, tap or keyboard focus tells how it compares: the change, the earlier
 * value and what it is compared against, plus the exact figure when the card shows a short one.
 * With nothing to add, it is a plain number.
 */
function KpiValue({ shown, exact, value, polarity, details }: {
  shown: string; exact: string; value: number | null; polarity: Polarity; details: Array<string | null>;
}) {
  const lines = [exact !== shown ? exact : null, ...details].filter((line): line is string => Boolean(line));
  const number = <TickerNumber text={shown} value={value} polarity={polarity} />;
  if (lines.length === 0) return <dd>{number}</dd>;
  return (
    <dd>
      <Tooltip multiline w={280} events={{ hover: true, focus: true, touch: true }}
        label={lines.map((line) => <span key={line} className={classes.tipLine}>{line}</span>)}>
        <span tabIndex={0} className={classes.kpiHover}>
          {number}
          <span className={classes.srOnly}> {lines.join(". ")}</span>
        </span>
      </Tooltip>
    </dd>
  );
}

/**
 * Four numbers. How each one compares is in the number's hover, and why a comparison may be limited
 * is behind the page's ⓘ, so the cards carry only the figure. `note` adds a line to the Results help
 * (the weekly appointments the owner reported).
 */
export default function ControlMetrics({ view, note = null }: { view: ControlPerformance & { context?: PeriodContext }; note?: ReactNode }) {
  const reference = view.context?.reference ?? null;
  const referenceLabel = view.context?.referenceLabel ?? null;
  const { labels, help, appsNote, t } = useMetricLabels(view.result);
  return (
    <>
      <dl className={classes.kpis}>
        {CONTROL_METRICS.map((key, index) => (
          <div key={key} className={classes.kpiCard}>
            <SyncSpider announce={index === 0} />
            <dt><LabelWithInfo label={labels[key]}><Tooltip events={{ hover: true, focus: true, touch: true }} multiline w={260} label={<>{key === "results" && appsNote ? `${help[key]} ${appsNote}` : help[key]}{key === "results" ? <span className={classes.tipNote}>{note}</span> : null}</>}><button type="button" aria-label={t("metrics.about", { label: labels[key] })}>ⓘ</button></Tooltip></LabelWithInfo></dt>
            <div className={classes.kpiValueRow}>
              <KpiValue
                shown={metricValue(key, view.metrics[key], view.currency, true)}
                exact={metricValue(key, view.metrics[key], view.currency)}
                value={view.metrics[key]}
                polarity={POLARITY[key]}
                details={[
                  view.deltas[key] ? deltaText(view.deltas[key]) : null,
                  reference && referenceLabel ? `${referenceLabel}: ${metricValue(key, reference[key], view.currency, true)}` : null,
                  view.comparison,
                ]}
              />
            </div>
          </div>
        ))}
      </dl>
    </>
  );
}
