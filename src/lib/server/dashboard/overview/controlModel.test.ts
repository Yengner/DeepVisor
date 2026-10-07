import { describe, it, expect } from "vitest";
import {
  controlPerformance,
  recordedActivity,
  selectAdvertising,
  attentionSummary,
  recentChanges,
} from "./controlModel";
import {
  dailyFixture,
  entityFixture,
  explorationFixture,
  fixtureToday,
} from "../../campaigns/exploration/fixtures";
import type { Summary } from "../../campaigns/exploration/types";
import type { ActivityItem } from "./types";

const entity = entityFixture("adset", "set-1");
const rows = dailyFixture("set-1");
const item = (id: string, results = 3, complete = true): Summary => ({
  ...explorationFixture().detail!.unit,
  id,
  metrics: { ...explorationFixture().detail!.unit.metrics, results },
  complete,
});
describe("control-center performance", () => {
  it("uses aggregate numerators, including CTR, and includes partial today", () => {
    const view = controlPerformance(rows, [entity], "7d", fixtureToday, "USD");
    expect(view.metrics.results).toBe(25);
    expect(view.metrics.costPerResult).toBe(150 / 25);
    expect(view.metrics.ctr).toBe(5);
    expect(view.points.at(-1)?.current).toBe(true);
  });
  it("compares completed windows, not partial today", () => {
    const changed = rows.map((r) => ({
      ...r,
      clicks: r.day >= "2026-09-30" && r.day < fixtureToday ? 120 : r.clicks,
    }));
    const view = controlPerformance(
      changed,
      [entity],
      "7d",
      fixtureToday,
      "USD",
    );
    expect(view.deltas.ctr).toEqual({ value: 5, unit: "pp", tone: "positive" });
    expect(view.comparison).toContain("2026-09-30 to 2026-10-06");
    expect(
      controlPerformance(rows, [entity], "today", fixtureToday, "USD").deltas,
    ).toEqual({});
  });
  it("plots recorded data when another ad set has no rows, but suppresses incomplete comparisons", () => {
    const view = controlPerformance(
      rows,
      [entity, entityFixture("adset", "missing")],
      "7d",
      fixtureToday,
      "USD",
    );
    expect(view.deltas).toEqual({});
    expect(view.partial).toBe(true);
    expect(view.points.reduce((sum, p) => sum + (p.results ?? 0), 0)).toBe(view.metrics.results);
    expect(view.points.some((p) => p.results !== null)).toBe(true);
  });
  it("retains a single recorded day between gaps, including confirmed zero results", () => {
    const row = { ...rows[0], day: "2026-10-04", leads: 0, messages: 0, calls: 0 };
    const view = controlPerformance([row], [entity], "7d", fixtureToday, "USD");
    expect(view.points.filter((p) => p.results !== null)).toHaveLength(1);
    expect(view.points.find((p) => p.day === row.day)?.results).toBe(0);
    expect(view.points.find((p) => p.day === row.day)?.costPerResult).toBeNull();
    expect(view.deltas).toEqual({});
  });
  it("excludes other entities and keeps missing days as gaps", () => {
    const view = controlPerformance(
      [
        ...rows.filter((r) => r.day !== "2026-10-04"),
        ...dailyFixture("other", 1000),
      ],
      [entity],
      "7d",
      fixtureToday,
      "USD",
    );
    expect(view.metrics.results).toBe(21);
    expect(view.points.find((p) => p.day === "2026-10-04")?.results).toBeNull();
    expect(view.deltas).toEqual({});
  });
  it("does not turn zero denominators or missing currency into favorable comparisons", () => {
    const zero = rows.map((r) => ({
      ...r,
      leads: 0,
      messages: 0,
      calls: 0,
      impressions: 0,
      clicks: 0,
    }));
    const view = controlPerformance(zero, [entity], "30d", fixtureToday, "USD");
    expect(view.metrics.costPerResult).toBeNull();
    expect(view.metrics.ctr).toBeNull();
    expect(view.deltas.costPerResult).toBeUndefined();
    expect(
      controlPerformance(rows, [entity], "7d", fixtureToday, null).deltas,
    ).toEqual({});
    expect(
      controlPerformance([], [entity], "7d", fixtureToday, "USD").metrics
        .results,
    ).toBeNull();
  });
});
describe("featured ad-set selection", () => {
  it("features the unique comparable positive leader", () => {
    const view = selectAdvertising(
      [item("b", 5), item("a", 2)],
      ["a"],
      new Map(),
    );
    expect(view.featuredId).toBe("b");
    expect(view.featuredLabel).toBe("Most results");
    expect(view.items.every((i) => i.level === "adset")).toBe(true);
  });
  it("breaks layout ties by stable ID, not CPR, without claiming a unique winner", () => {
    const a = item("a", 5);
    a.metrics.costPerResult = 100;
    const b = item("b", 5);
    b.metrics.costPerResult = 1;
    const view = selectAdvertising([b, a], [], new Map());
    expect(view.featuredId).toBe("a");
    expect(view.featuredLabel).toBe("Most results · tied");
  });
  it("uses priority-ordered attention when ranking is unreliable", () => {
    expect(
      selectAdvertising(
        [item("b", 99, false), item("a")],
        ["a", "b"],
        new Map(),
      ).featuredId,
    ).toBe("a");
  });
  it("uses positive recorded activity, never updated_at, with stable final ties", () => {
    const entities = ["a", "b", "c"].map((id) => entityFixture("adset", id));
    const facts = [
      ...dailyFixture("a").slice(-2, -1),
      ...dailyFixture("b").slice(-1),
      ...dailyFixture("c").slice(-1),
    ];
    const activity = recordedActivity(facts, entities, fixtureToday);
    const view = selectAdvertising(
      entities.map((e) => item(e.id, 0)),
      [],
      activity,
    );
    expect(view.featuredId).toBe("b");
    expect(view.featuredLabel).toBe("Recent delivery");
  });
  it("does not feature inactive, zero-only, future, foreign or unsupported candidates", () => {
    const zero = rows.map((r) => ({
      ...r,
      spend: 0,
      impressions: 0,
      clicks: 0,
      leads: 0,
      messages: 0,
      calls: 0,
    }));
    expect(recordedActivity(zero, [entity], fixtureToday).size).toBe(0);
    expect(
      recordedActivity(dailyFixture("other"), [entity], fixtureToday).size,
    ).toBe(0);
    expect(recordedActivity(rows, [entity], "2020-01-01").size).toBe(0);
    expect(
      selectAdvertising(
        [{ ...item("a", 0), delivery: "PAUSED" }],
        [],
        new Map([["a", fixtureToday]]),
      ).featuredId,
    ).toBeNull();
    expect(
      selectAdvertising([item("a", 0)], [], new Map()).featuredId,
    ).toBeNull();
  });
  it("preserves attention alternatives beyond the top-five result positions", () => {
    const view = selectAdvertising(
      Array.from({ length: 12 }, (_, i) => item(String(i), 20 - i)),
      ["11", "10"],
      new Map(),
    );
    expect(view.attentionIds).toEqual(["11", "10"]);
    expect(view.highlightIds).toHaveLength(5);
  });
});
describe("truthful secondary presentation", () => {
  it("retains actionable evaluations and recommendations with unknown historical mode", () => {
    const events: ActivityItem[] = [
      {
        title: "Ad set evaluated",
        state: "Blocked",
        at: "2026-10-07T13:00:00Z",
        entity: "Ad set",
        mode: null,
      },
      {
        title: "Ad set evaluated",
        state: "Approval required",
        at: "2026-10-07T12:00:00Z",
        entity: "Ad set",
        mode: "REVIEW",
      },
      {
        title: "Creative review recommended",
        state: "Evaluation",
        at: "2026-10-07T11:00:00Z",
        entity: "Ad set",
        mode: null,
      },
    ];
    expect(recentChanges(events).map((e) => e.title)).toEqual([
      "Recommendation blocked",
      "Change ready for review",
      "Creative review recommended",
    ]);
  });
  it("never infers stability from no attention, missing or failed evidence", () => {
    expect(attentionSummary(new Map(), 0, false)).toBe(
      "No open attention items",
    );
    expect(
      attentionSummary(new Map([["a", "Insufficient data"]]), 0, false),
    ).toBe("No open attention items");
    expect(attentionSummary(new Map([["a", "Healthy"]]), 0, true)).toBe(
      "Attention status unavailable",
    );
    expect(attentionSummary(new Map([["a", "Healthy"]]), 0, false)).toBe(
      "Everything looks stable",
    );
  });
  it("collapses uneventful activity and orders meaningful events, bounded to three", () => {
    const event = (title: string, state: string, at: string): ActivityItem => ({
      title,
      state,
      at,
      entity: "Ad set",
      mode: null,
    });
    expect(
      recentChanges([event("No change", "HOLD", "2026-10-07T12:00:00Z")]),
    ).toEqual([]);
    const changes = recentChanges([
      event("Approved", "Approved", "2026-10-07T11:00:00Z"),
      event("Observed", "Shadow observation", "2026-10-07T13:00:00Z"),
      event("Executed", "Executed", "2026-10-07T12:00:00Z"),
      event("Old", "Rejected", "2026-10-07T10:00:00Z"),
    ]);
    expect(changes.map((e) => e.title)).toEqual([
      "Observed",
      "Executed",
      "Approved",
    ]);
  });
});
