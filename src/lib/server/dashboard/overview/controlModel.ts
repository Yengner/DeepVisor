import {
  aggregate,
  complete,
  delta,
  rank,
} from "../../campaigns/exploration/model";
import type {
  Delta,
  Metrics,
  Summary,
} from "../../campaigns/exploration/types";
import { periodRange, shiftDay } from "./model";
import type {
  DailyRow,
  Entity,
  Period,
  UnitState,
  ActivityItem,
} from "./types";

export type ControlPerformance = {
  metrics: Metrics;
  points: Array<Metrics & { day: string; current: boolean }>;
  deltas: Partial<Record<keyof Metrics, Delta>>;
  comparison: string | null;
  currency: string | null;
  partial: boolean;
};

export function controlPerformance(
  rows: DailyRow[],
  entities: Entity[],
  period: Period,
  today: string,
  currency: string | null,
): ControlPerformance {
  const ids = new Set(entities.map((e) => e.id));
  const scoped = rows.filter((r) => ids.has(r.entity_id));
  const validCurrency =
    currency && /^[A-Z]{3}$/.test(currency) ? currency : null;
  const range = periodRange(period, today);
  const window = (since: string, until: string) =>
    scoped.filter((r) => r.day >= since && r.day <= until);
  const covered = (since: string, until: string) =>
    entities.length > 0 &&
    entities.every((e) =>
      complete(
        window(since, until).filter((r) => r.entity_id === e.id),
        since,
        until,
        validCurrency,
      ),
    );
  const points: ControlPerformance["points"] = [];
  for (
    let day = periodRange(period === "today" ? "7d" : period, today).since;
    day <= today;
    day = shiftDay(day, 1)
  ) {
    // Plot recorded totals just like the KPIs; absent entities do not erase valid rows.
    // Complete coverage is still required for comparisons below.
    points.push({
      ...aggregate(window(day, day), validCurrency),
      day,
      current: day === today,
    });
  }
  const deltas: ControlPerformance["deltas"] = {};
  let comparison: string | null = null;
  if (period !== "today") {
    const days = period === "7d" ? 7 : 30;
    const recent = shiftDay(today, -days),
      previous = shiftDay(today, -days * 2),
      end = shiftDay(today, -1);
    if (covered(recent, end) && covered(previous, shiftDay(recent, -1))) {
      const a = aggregate(window(recent, end), validCurrency),
        b = aggregate(window(previous, shiftDay(recent, -1)), validCurrency);
      for (const key of ["spend", "results", "costPerResult", "ctr"] as const) {
        const change = delta(key, a[key], b[key]);
        if (change) deltas[key] = change;
      }
      comparison = `${recent} to ${end} vs previous ${days} completed days`;
    }
  }
  return {
    metrics: aggregate(window(range.since, range.until), validCurrency),
    points,
    deltas,
    comparison,
    currency: validCurrency,
    partial: !covered(range.since, range.until),
  };
}

export function selectAdvertising(
  items: Summary[],
  attentionIds: string[],
  activity: Map<string, string>,
) {
  const ranked = rank(items);
  const leaders = ranked
    .filter((i) => i.leader)
    .sort((a, b) => a.id.localeCompare(b.id));
  const attention = attentionIds.flatMap(
    (id) => ranked.find((i) => i.id === id) ?? [],
  );
  const active = ranked
    .filter((i) => i.delivery.trim().toUpperCase() === "ACTIVE" && activity.has(i.id))
    .sort(
      (a, b) =>
        activity.get(b.id)!.localeCompare(activity.get(a.id)!) ||
        a.id.localeCompare(b.id),
    );
  const featured = leaders[0] ?? attention[0] ?? active[0];
  const label = leaders.length
    ? leaders.length > 1
      ? "Most results · tied"
      : "Most results"
    : attention[0]
      ? "Needs attention"
      : featured
        ? "Recent delivery"
        : null;
  const highlights = [
    ...new Set([...(featured ? [featured] : []), ...attention, ...ranked]),
  ].slice(0, 5);
  // Include bounded attention alternatives, even when they rank outside the highlights.
  const visible = [...new Set([...highlights, ...attention.slice(0, 5)])];
  return {
    items: visible,
    featuredId: featured?.id ?? null,
    featuredLabel: label,
    highlightIds: highlights.map((i) => i.id),
    attentionIds: [...new Set(attention.map((i) => i.id))].slice(0, 5),
  };
}

export function recordedActivity(
  rows: DailyRow[],
  entities: Entity[],
  today: string,
) {
  const external = new Map(entities.map((e) => [e.id, e.external_id]));
  const result = new Map<string, string>();
  for (const row of rows) {
    const id = external.get(row.entity_id);
    if (
      id &&
      row.day <= today &&
      [
        row.spend,
        row.impressions,
        row.clicks,
        row.leads,
        row.messages,
        row.calls,
      ].some((n) => typeof n === "number" && n > 0)
    ) {
      if (!result.has(id) || row.day > result.get(id)!) result.set(id, row.day);
    }
  }
  return result;
}

export function selectBoardAdvertising(
  items: Summary[],
  attentionIds: string[],
  rows: DailyRow[],
  entities: Entity[],
  period: Period,
  today: string,
) {
  const { since, until } = periodRange(period, today);
  const activity = recordedActivity(
    rows.filter((r) => r.day >= since && r.day <= until),
    entities,
    today,
  );
  const active = items.filter((i) => i.delivery.trim().toUpperCase() === "ACTIVE");
  const selected = selectAdvertising(active, attentionIds, activity);
  const featured =
    selected.featuredId ??
    [...active].sort((a, b) => a.id.localeCompare(b.id))[0]?.id ??
    null;
  const activeIds = [
    ...new Set([...(featured ? [featured] : []), ...selected.highlightIds]),
  ].slice(0, 5);
  const highlights = rank(items.filter((i) => activity.has(i.id))).slice(0, 5);
  const attention = attentionIds
    .flatMap((id) => items.find((i) => i.id === id) ?? [])
    .slice(0, 5);
  const visibleIds = new Set([
    ...activeIds,
    ...highlights.map((i) => i.id),
    ...attention.map((i) => i.id),
  ]);
  return {
    items: items
      .filter((i) => visibleIds.has(i.id))
      .map((i) => highlights.find((h) => h.id === i.id) ?? i),
    board: {
      activeIds,
      activeFeaturedId: featured,
      activeFeaturedLabel:
        active.length === 1
          ? "Active now"
          : (selected.featuredLabel ?? "Active now"),
      featuredId: null,
      featuredLabel: null,
      highlightIds: highlights.map((i) => i.id),
      attentionIds: attention.map((i) => i.id),
    },
  };
}

export function attentionSummary(
  states: Map<string, UnitState>,
  count: number,
  failed: boolean,
) {
  if (failed) return "Attention status unavailable";
  if (count) return "Needs you";
  return states.size > 0 && [...states.values()].every((s) => s === "Healthy")
    ? "Everything looks stable"
    : "No open attention items";
}
export function recentChanges(events: ActivityItem[]) {
  return events
    .filter(
      (e) =>
        [
          "Approved",
          "Rejected",
          "Executed",
          "Needs attention",
          "Check failed",
          "Blocked",
          "Approval required",
          "Shadow observation",
          "Post-action observation",
        ].includes(e.state) || e.title === "Creative review recommended",
    )
    .map((e) =>
      e.title === "Ad set evaluated"
        ? {
            ...e,
            title:
              e.state === "Blocked"
                ? "Recommendation blocked"
                : "Change ready for review",
          }
        : e,
    )
    .sort((a, b) => b.at.localeCompare(a.at) || a.title.localeCompare(b.title))
    .slice(0, 3);
}
