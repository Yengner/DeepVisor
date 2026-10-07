import { describe, expect, it } from "vitest";
import {
  aggregate,
  comparisons,
  complete,
  delta,
  mediaFor,
  rank,
  safeMediaUrl,
  trend,
} from "./model";
import {
  creativeFixture,
  dailyFixture,
  explorationFixture,
  fixtureToday,
} from "./fixtures";
import { dayInZone, shiftDay } from "../../dashboard/overview/model";

describe("exploration metrics", () => {
  it("derives ratios from totals and includes calls in results", () => {
    const rows = dailyFixture().slice(-2);
    rows[0].calls = 2;
    const metrics = aggregate(rows, "USD");
    expect(metrics.results).toBe(7);
    expect(metrics.costPerResult).toBe(30 / 7);
    expect(metrics.ctr).toBe(5);
    expect(metrics.cpc).toBe(0.25);
    expect(metrics.cpm).toBe(12.5);
  });
  it("keeps all zero denominator ratios unavailable", () => {
    const rows = dailyFixture()
      .slice(0, 1)
      .map((r) => ({
        ...r,
        clicks: 0,
        impressions: 0,
        reach: 0,
        leads: 0,
        calls: 0,
        messages: 0,
      }));
    expect(aggregate(rows, "USD")).toMatchObject({
      results: 0,
      costPerResult: null,
      ctr: null,
      cpc: null,
      cpm: null,
      frequency: null,
    });
  });
  it("does not turn missing metrics or currency mismatches into zeros", () => {
    expect(aggregate([], "USD")).toMatchObject({
      spend: null,
      results: null,
      clicks: null,
    });
    expect(
      aggregate(
        dailyFixture().map((r) => ({ ...r, calls: null as unknown as number })),
        "USD",
      ).results,
    ).toBeNull();
    expect(aggregate(dailyFixture(), "EUR").spend).toBeNull();
    expect(aggregate(dailyFixture(), null).costPerResult).toBeNull();
  });
  it("only displays reach and frequency for a single day", () => {
    expect(aggregate(dailyFixture(), "USD")).toMatchObject({
      reach: null,
      frequency: null,
    });
    expect(aggregate(dailyFixture().slice(-1), "USD")).toMatchObject({
      reach: 800,
      frequency: 1.5,
    });
  });
  it("compares equal completed-day periods and excludes partial today", () => {
    const rows = dailyFixture();
    rows.at(-1)!.leads = 9999;
    expect(comparisons(rows, "7d", fixtureToday, "USD").results?.value).toBe(0);
    expect(comparisons(rows, "30d", fixtureToday, "USD").results?.value).toBe(
      0,
    );
    expect(comparisons(rows, "today", fixtureToday, "USD")).toEqual({});
  });
  it("suppresses incomplete and duplicate-day comparisons", () => {
    const rows = dailyFixture();
    expect(comparisons(rows.slice(-8), "7d", fixtureToday, "USD")).toEqual({});
    rows[50] = rows[49];
    expect(comparisons(rows, "7d", fixtureToday, "USD")).toEqual({});
    expect(complete([], fixtureToday, fixtureToday, "USD")).toBe(false);
  });
  it("retains trend gaps and shows seven days for Today", () => {
    const points = trend(
      dailyFixture().slice(-1),
      "today",
      fixtureToday,
      "USD",
    );
    expect(points).toHaveLength(7);
    expect(points[0].results).toBeNull();
    expect(points.at(-1)?.current).toBe(true);
  });
  it("uses the account calendar across DST and UTC midnight", () => {
    expect(dayInZone("2026-10-07T01:00:00Z", "America/New_York")).toBe(
      "2026-10-06",
    );
    expect(shiftDay("2026-11-02", -1)).toBe("2026-11-01");
  });
});
describe("honest visual evidence", () => {
  it.each([
    ["results", "positive"],
    ["ctr", "positive"],
    ["costPerResult", "negative"],
    ["cpc", "negative"],
    ["cpm", "negative"],
    ["spend", "neutral"],
    ["frequency", "neutral"],
  ] as const)("%s increase is %s", (metric, tone) => {
    expect(delta(metric, 12, 10)?.tone).toBe(tone);
  });
  it("distinguishes percentage points and undefined percentage baselines", () => {
    expect(delta("ctr", 3.75, 3.33)).toMatchObject({ unit: "pp" });
    expect(delta("ctr", 3.75, 3.33)?.value).toBeCloseTo(0.42);
    expect(delta("results", 1, 0)).toBeNull();
    expect(delta("cpc", null, 1)).toBeNull();
    expect(delta("results", Infinity, 1)).toBeNull();
  });
  it("requires a complete comparison group and preserves tied leaders", () => {
    const items = explorationFixture().items;
    expect(rank([items[0]])[0].leader).toBe(false);
    expect(
      rank(items.map((i) => ({ ...i, complete: false }))).some((i) => i.leader),
    ).toBe(false);
    const tied = rank(
      items.slice(0, 2).map((i) => ({ ...i, metrics: items[0].metrics })),
    );
    expect(tied.every((i) => i.leader && i.tied)).toBe(true);
    expect(
      rank(
        items.map((i) => ({ ...i, metrics: { ...i.metrics, results: 0 } })),
      ).some((i) => i.leader),
    ).toBe(false);
  });
  it("does not give individual ads inherited health or recommendations", () => {
    expect(explorationFixture().items.every((i) => i.state === null)).toBe(
      true,
    );
  });
  it("uses actual images, video thumbnails, and safe media URLs", () => {
    expect(mediaFor(creativeFixture()).image).toContain("colour.jpg");
    expect(mediaFor(creativeFixture({ video_id: "123" })).image).toContain(
      "thumb.jpg",
    );
    expect(
      mediaFor(creativeFixture({ video_id: "123", thumbnail_url: null })).image,
    ).toBeNull();
    expect(safeMediaUrl("javascript:alert(1)")).toBeNull();
    expect(safeMediaUrl("http://insecure.test/image")).toBeNull();
    expect(mediaFor(creativeFixture({ creative_type: "carousel" })).kind).toBe(
      "carousel",
    );
    expect(
      mediaFor(
        creativeFixture({
          creative_type: "SHARE",
          object_story_spec: { link_data: { child_attachments: [{}, {}] } },
        }),
      ).kind,
    ).toBe("carousel");
    expect(
      mediaFor(
        creativeFixture({
          asset_feed_spec: { images: [{ hash: "a" }, { hash: "b" }] },
        }),
      ).kind,
    ).toBe("dynamic");
  });
});
