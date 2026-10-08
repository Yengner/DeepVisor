import { describe, expect, it } from "vitest";
import { selectBoardAdvertising } from "./controlModel";
import {
  dailyFixture,
  entityFixture,
  explorationFixture,
  fixtureToday,
} from "../../campaigns/exploration/fixtures";
import type { Summary } from "../../campaigns/exploration/types";

const item = (id: string, delivery = "ACTIVE", results = 5): Summary => ({
  ...explorationFixture().detail!.unit,
  id,
  delivery,
  metrics: { ...explorationFixture().detail!.unit.metrics, results },
  complete: true,
});
const entities = ["a", "b", "c"].map((id) => entityFixture("adset", id));
const facts = entities.flatMap((e) => dailyFixture(e.id));
describe("dashboard current advertising and period history", () => {
  it("features only the single active set, even when paused history has more results", () => {
    const view = selectBoardAdvertising(
      [item("a"), item("b", "PAUSED", 99)],
      [],
      facts,
      entities,
      "7d",
      fixtureToday,
    );
    expect(view.board.activeIds).toEqual(["a"]);
    expect(view.board.activeFeaturedId).toBe("a");
    expect(view.board.activeFeaturedLabel).toBe("Active now");
    expect(view.board.highlightIds).toEqual(["b", "a"]);
    expect(view.items.find((i) => i.id === "b")?.delivery).toBe("PAUSED");
  });
  it("ranks active sets within their own group and preserves ties", () => {
    const view = selectBoardAdvertising(
      [item("b"), item("a"), item("c", "PAUSED", 99)],
      [],
      facts,
      entities,
      "7d",
      fixtureToday,
    );
    expect(view.board.activeIds).toEqual(["a", "b"]);
    expect(view.board.activeFeaturedLabel).toBe("Most results · tied");
  });
  it("has no active feature when all sets are paused, but retains period history", () => {
    const view = selectBoardAdvertising(
      [item("a", "PAUSED")],
      [],
      facts,
      entities,
      "30d",
      fixtureToday,
    );
    expect(view.board.activeIds).toEqual([]);
    expect(view.board.activeFeaturedId).toBeNull();
    expect(view.board.highlightIds).toEqual(["a"]);
  });
  it("changes historical eligibility with the period, never current status", () => {
    const old = facts.filter((r) => r.day === "2026-09-20");
    const items = [item("a", "PAUSED"), item("b")];
    const today = selectBoardAdvertising(
      items,
      [],
      old,
      entities,
      "today",
      fixtureToday,
    );
    const month = selectBoardAdvertising(
      items,
      [],
      old,
      entities,
      "30d",
      fixtureToday,
    );
    expect(today.board.highlightIds).toEqual([]);
    expect(month.board.highlightIds).toHaveLength(2);
    expect(today.board.activeIds).toEqual(month.board.activeIds);
  });
  it("omits dormant history but retains persisted attention without manufacturing delivery", () => {
    const view = selectBoardAdvertising(
      [item("a", "PAUSED"), item("b", "PAUSED")],
      ["a"],
      [],
      entities,
      "7d",
      fixtureToday,
    );
    expect(view.board.highlightIds).toEqual([]);
    expect(view.board.attentionIds).toEqual(["a"]);
    expect(view.items.map((i) => i.id)).toEqual(["a"]);
  });
  it("keeps an active set with no period data without assigning a winner", () => {
    const empty = {
      ...item("a"),
      complete: false,
      metrics: { ...item("a").metrics, results: null, spend: null },
    };
    const view = selectBoardAdvertising(
      [empty],
      [],
      [],
      entities,
      "today",
      fixtureToday,
    );
    expect(view.board.activeIds).toEqual(["a"]);
    expect(view.board.highlightIds).toEqual([]);
    expect(view.items[0].metrics.results).toBeNull();
  });
});
