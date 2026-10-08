import { describe, expect, it } from "vitest";
import { deliveryStatuses } from "./delivery";

const chain = () => [
  { external_id: "campaign", parent_external_id: null, entity_level: "campaign", status: "active" },
  { external_id: "set", parent_external_id: "campaign", entity_level: "adset", status: "active" },
  { external_id: "ad", parent_external_id: "set", entity_level: "ad", status: "active" },
];

describe("active delivery hierarchy", () => {
  const now = "2026-10-08T16:00:00Z";
  it.each([0, 1, 2])("excludes explicit completed status at level %i", index => {
    const entities = chain();
    entities[index].status = "completed";
    const statuses = deliveryStatuses(entities, now);
    expect(statuses.get("adset:set")).not.toBe("ACTIVE");
    expect(statuses.get("ad:ad")).not.toBe("ACTIVE");
  });
  it.each([0, 1, 2])("excludes ended schedules at level %i including the exact boundary", index => {
    const entities = chain().map((entity, i) => ({ ...entity,
      raw: i === index ? { [index === 0 ? "stop_time" : "end_time"]: "2026-10-08T12:00:00-04:00" } : {},
    }));
    const statuses = deliveryStatuses(entities, now);
    expect(statuses.get("adset:set")).not.toBe("ACTIVE");
    expect(statuses.get("ad:ad")).not.toBe("ACTIVE");
  });
  it("retains future schedules and excludes malformed end times", () => {
    const entities = chain().map(entity => ({ ...entity, raw: { end_time: "2026-10-09T16:00:00Z" } }));
    expect(deliveryStatuses(entities, now).get("ad:ad")).toBe("ACTIVE");
    entities[1].raw.end_time = "invalid";
    expect(deliveryStatuses(entities, now).get("ad:ad")).not.toBe("ACTIVE");
  });
  it("requires an active campaign, ad set and child ad", () => {
    expect(deliveryStatuses(chain()).get("adset:set")).toBe("ACTIVE");
    expect(deliveryStatuses(chain()).get("ad:ad")).toBe("ACTIVE");
  });
  it.each([0, 1, 2])("does not qualify when level %i is paused", index => {
    const entities = chain();
    entities[index].status = "paused";
    const statuses = deliveryStatuses(entities);
    expect(statuses.get("adset:set")).not.toBe("ACTIVE");
    expect(statuses.get("ad:ad")).not.toBe("ACTIVE");
  });
  it("fails closed on missing parents, status or child ads", () => {
    expect(deliveryStatuses(chain().slice(1)).get("adset:set")).not.toBe("ACTIVE");
    expect(deliveryStatuses(chain().slice(0, 2)).get("adset:set")).toBe("NO_ACTIVE_ADS");
    const entities = chain();
    entities[0].status = "";
    expect(deliveryStatuses(entities).get("ad:ad")).not.toBe("ACTIVE");
  });
  it("allows an active child alongside paused siblings", () => {
    const entities = chain();
    entities.push({ ...entities[2], external_id: "other", status: "paused" });
    const statuses = deliveryStatuses(entities);
    expect(statuses.get("adset:set")).toBe("ACTIVE");
    expect(statuses.get("ad:other")).toBe("PAUSED");
  });
});
