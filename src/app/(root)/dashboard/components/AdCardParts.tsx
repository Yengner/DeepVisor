import type { CSSProperties } from "react";
import type { Delta, Metrics } from "@/lib/server/campaigns/exploration/types";
import type { AdSchedule } from "@/lib/shared/performance/schedule";
import type { LearningProgress } from "@/lib/server/dashboard/insights/signals";
import { metricValue, MetricDelta, useMetricLabels } from "./ControlMetrics";
import type { ResultDefinition } from "@/lib/shared/performance/resultChannel";
import classes from "./AdCardParts.module.css";

/** Days arrive as account-local YYYY-MM-DD, so format them at noon UTC to avoid shifting. */
const day = (ymd: string) =>
  new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${ymd}T12:00:00Z`));

/** Urgency by days left: the bar warms from blue to red as the end approaches. */
function urgency(daysLeft: number) {
  return daysLeft <= 2 ? "urgent" : daysLeft <= 7 ? "soon" : "calm";
}

/** The countdown is the card's headline: days left, a start→end bar, and both dates. */
export function RunWindow({ schedule }: { schedule?: AdSchedule }) {
  if (!schedule || (!schedule.start && !schedule.end)) return null;
  const { startDay, endDay, daysLeft, elapsedPercent, daysRunning } = schedule;

  if (schedule.ended && endDay) {
    return (
      <div className={classes.run} data-tone="open">
        <p className={classes.count}><strong>Ended</strong></p>
        <p className={classes.dates}>{startDay ? <span>{day(startDay)}</span> : <span />}<span>{day(endDay)}</span></p>
      </div>
    );
  }

  if (endDay === null || daysLeft === null) {
    return (
      <div className={classes.run} data-tone="open">
        <p className={classes.count}>
          {daysRunning !== null ? <><strong>{daysRunning}</strong> {daysRunning === 1 ? "day" : "days"} running</> : <strong>Running</strong>}
        </p>
        <p className={classes.dates}>{startDay ? `Started ${day(startDay)}` : null}<span>No end date</span></p>
      </div>
    );
  }

  const tone = urgency(daysLeft);
  const label = daysLeft === 0 ? "Ends today" : `${daysLeft} ${daysLeft === 1 ? "day" : "days"} left`;
  return (
    <div className={classes.run} data-tone={tone}>
      <p className={classes.count}>
        {daysLeft === 0 ? <strong>Ends today</strong> : <><strong>{daysLeft}</strong> {daysLeft === 1 ? "day" : "days"} left</>}
      </p>
      {elapsedPercent !== null && (
        <div className={classes.track} role="meter" aria-label={`Run time used, ${label}`}
          aria-valuemin={0} aria-valuemax={100} aria-valuenow={elapsedPercent} aria-valuetext={`${elapsedPercent}% of the run used, ${label}`}>
          <span style={{ "--fill": `${elapsedPercent}%` } as CSSProperties} />
        </div>
      )}
      <p className={classes.dates}>
        {startDay ? <span>{day(startDay)}</span> : <span />}
        <span>{day(endDay)}</span>
      </p>
    </div>
  );
}

const learningText: Record<LearningProgress["tone"], (p: LearningProgress) => string> = {
  complete: () => "Complete",
  learning: (p) => (p.percent !== null ? `${p.percent}%` : "In progress"),
  limited: () => "Limited",
  unknown: () => "Unavailable",
};

/** Meta's learning phase as one thin bar. */
export function LearningBar({ learning }: { learning?: LearningProgress }) {
  if (!learning) return null;
  const value = learningText[learning.tone](learning);
  return (
    <div className={classes.learning} data-tone={learning.tone}>
      <p><span>Meta learning</span><strong>{value}</strong></p>
      <div className={classes.thin} role="meter" aria-label={`Meta learning: ${value}`}
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={learning.percent ?? undefined}
        aria-valuetext={learning.percent === null ? value : `${learning.percent}%`} data-empty={learning.percent === null}>
        <span style={{ width: `${learning.percent ?? 0}%` }} />
      </div>
    </div>
  );
}

const kpis = [
  { key: "results" },
  { key: "costPerResult" },
  { key: "spend" },
  { key: "ctr" },
] as const;

/** Four quick numbers. Missing values show as a dash, never zero. */
export function QuickStats({ metrics, deltas, currency, comparison, result }: {
  metrics: Metrics; deltas: Partial<Record<keyof Metrics, Delta>>; currency: string | null; comparison: string | null;
  /** Names the results (e.g. WhatsApp conversations); absent means "Results". */
  result?: ResultDefinition;
}) {
  const { labels, help, short } = useMetricLabels(result);
  return (
    <dl className={classes.stats}>
      {kpis.map(({ key }) => (
        <div key={key}>
          <dt title={key === "results" ? help.results : undefined}>{key === "results" ? short : labels[key]}</dt>
          <dd>{metrics[key] === null ? "—" : metricValue(key, metrics[key], currency, key !== "ctr")}</dd>
          {(key === "results" || key === "costPerResult") && <MetricDelta change={deltas[key]} description={comparison} />}
        </div>
      ))}
    </dl>
  );
}
