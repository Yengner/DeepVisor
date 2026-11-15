import { describe, expect, it } from "vitest";
import { chartCeiling, chartTicks } from "./chartScale";

describe("chartCeiling", () => {
  it("leaves moderate headroom above the highest point on a readable maximum", () => {
    expect(chartCeiling(5)).toBe(8);
    expect(chartCeiling(13)).toBe(20);
    expect(chartCeiling(4.9)).toBe(8);
    expect(chartCeiling(3)).toBe(5);
    expect(chartCeiling(171)).toBe(400);
    expect(chartCeiling(0.4)).toBe(0.6);
  });
  it("falls back to a unit axis when there is nothing to scale", () => {
    expect(chartCeiling(0)).toBe(1);
    expect(chartCeiling(Number.NaN)).toBe(1);
  });
  it("spaces ticks evenly up to the ceiling", () => {
    expect(chartTicks(8)).toEqual([0, 2, 4, 6, 8]);
    expect(chartTicks(20)).toEqual([0, 5, 10, 15, 20]);
    expect(chartTicks(25)).toEqual([0, 5, 10, 15, 20, 25]);
    expect(chartTicks(60)).toEqual([0, 20, 40, 60]);
    expect(chartTicks(1)).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1]);
  });
});
