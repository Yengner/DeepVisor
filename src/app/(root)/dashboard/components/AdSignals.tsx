import type { AdSignals as Signals } from "@/lib/server/dashboard/insights/signals";
import { LEARNING_EVENTS, LEARNING_DAYS } from "@/lib/shared/performance/learning";
import { metricValue } from "./ControlMetrics";
import classes from "./AdSignals.module.css";

const healthTone = {
  Strong: "positive",
  "On track": "positive",
  Watch: "warning",
  "Needs attention": "negative",
  "Not enough data": "muted",
} as const;
const learningTone = { complete: "positive", learning: "accent", limited: "warning", unknown: "muted" } as const;

const shortDay = (d: string) => new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`));

/** `percent` undefined renders no bar: used for comparisons that are not progress. */
function Meter({ label, value, percent, tone, detail }: { label: string; value: string; percent?: number | null; tone: string; detail: string }) {
  return (
    <div className={classes.meter} data-tone={tone}>
      <div className={classes.head}>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      {percent !== undefined && <div
        className={classes.track}
        role="meter"
        aria-label={`${label}: ${value}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent ?? undefined}
        aria-valuetext={percent === null ? "Unavailable" : `${percent}%`}
        data-empty={percent === null}
      >
        <span style={{ width: `${percent ?? 0}%` }} />
      </div>}
      <small>{detail}</small>
    </div>
  );
}

export default function AdSignals({ signals, currency }: { signals: Signals; currency: string | null }) {
  const { health, learning } = signals;
  const money = (v: number | null) => metricValue("costPerResult", v, currency);
  const healthDetail =
    health.label === "Not enough data"
      ? health.benchmark === null ? "No benchmark yet" : "Needs a few more results"
      : health.benchmarkSource === "target"
        ? `${money(health.costPerResult)} per result (last 7 days) vs your ${money(health.benchmark)} target`
        : `${money(health.costPerResult)} per result (last 7 days) vs ${money(health.benchmark)} for the account, ${health.benchmarkWindow ? `${shortDay(health.benchmarkWindow.since)} – ${shortDay(health.benchmarkWindow.until)}${health.benchmarkWindow.observedDays < health.benchmarkWindow.days ? ` (${health.benchmarkWindow.observedDays} of ${health.benchmarkWindow.days} days with data)` : ""}` : "the previous 30 days"}`;
  // Headline is the progress itself; the state moves into the detail line.
  const learningValue =
    learning.tone === "learning" && learning.percent !== null ? `${learning.percent}%`
      : learning.tone === "limited" ? "Limited"
        : learning.tone === "complete" ? "Complete"
          : "Unavailable";
  const learningDetail =
    learning.events === null
      ? learning.tone === "complete" ? learning.label : "Not reported by Meta"
      : `${learning.events} of ${LEARNING_EVENTS} ${learning.estimated ? "results" : "events"}${learning.day ? ` · day ${learning.day} of ${LEARNING_DAYS}` : " in 7 days"}${learning.estimated ? " · estimate" : ""}`;
  return (
    <div className={classes.signals}>
      <Meter label="Health" value={health.label} tone={healthTone[health.label]} detail={healthDetail} />
      <Meter label="Meta learning" value={learningValue} percent={learning.percent} tone={learningTone[learning.tone]} detail={learningDetail} />
    </div>
  );
}
