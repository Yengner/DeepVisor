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

/**
 * When the ad set ends. Close to the end (a week or less) the countdown is the card's headline,
 * with a start→end bar and both dates. Further out, or with no end date, it is one quiet line:
 * there is nothing to act on yet.
 */
export function RunWindow({ schedule }: { schedule?: AdSchedule }) {
  if (!schedule || (!schedule.start && !schedule.end)) return null;
  const { startDay, endDay, daysLeft, elapsedPercent, daysRunning } = schedule;

  if (schedule.ended && endDay) {
    return <p className={classes.runLine}><strong>Ended</strong> {day(endDay)}</p>;
  }

  if (endDay === null || daysLeft === null) {
    return (
      <p className={classes.runLine}>
        {daysRunning !== null ? <><strong>{daysRunning}</strong> {daysRunning === 1 ? "day" : "days"} running</> : <strong>Running</strong>}
        {" · No end date"}
      </p>
    );
  }

  const tone = urgency(daysLeft);
  if (tone === "calm") {
    return <p className={classes.runLine}><strong>{daysLeft}</strong> {daysLeft === 1 ? "day" : "days"} left · Ends {day(endDay)}</p>;
  }
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

/**
 * Meta's learning phase as one thin bar, only while it is still learning or limited. A finished or
 * unknown phase gives the owner nothing to do, so it takes no space.
 */
export function LearningBar({ learning }: { learning?: LearningProgress }) {
  if (!learning || (learning.tone !== "learning" && learning.tone !== "limited")) return null;
  const value = learningText[learning.tone](learning);
  return (
    <div className={classes.learning} data-tone={learning.tone}>
      <p><span>Learning</span><strong>{value}</strong></p>
      <div className={classes.thin} role="meter" aria-label={`Meta learning: ${value}`}
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={learning.percent ?? undefined}
        aria-valuetext={learning.percent === null ? value : `${learning.percent}%`} data-empty={learning.percent === null}>
        <span style={{ width: `${learning.percent ?? 0}%` }} />
      </div>
    </div>
  );
}

/** Three numbers: results lead, then cost and spend. Missing values show as a dash, never zero. */
export function QuickStats({ metrics, deltas, currency, comparison, result }: {
  metrics: Metrics; deltas: Partial<Record<keyof Metrics, Delta>>; currency: string | null; comparison: string | null;
  /** Names the results (e.g. WhatsApp conversations); absent means "Results". */
  result?: ResultDefinition;
}) {
  const { labels, help, short } = useMetricLabels(result);
  const value = (key: "results" | "costPerResult" | "spend") => (metrics[key] === null ? "—" : metricValue(key, metrics[key], currency, true));
  return (
    <dl className={classes.stats}>
      <div className={classes.statMain}>
        <dt title={help.results}>{short}</dt>
        <dd>{value("results")}</dd>
        <MetricDelta change={deltas.results} description={comparison} />
      </div>
      <div>
        <dt>{labels.costPerResult}</dt>
        <dd>{value("costPerResult")}</dd>
        <MetricDelta change={deltas.costPerResult} description={comparison} />
      </div>
      <div>
        <dt>{labels.spend}</dt>
        <dd>{value("spend")}</dd>
      </div>
    </dl>
  );
}
