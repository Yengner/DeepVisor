"use client";
import { useMemo, useState } from "react";
import {
  Line,
  LineChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ControlPerformance } from "@/lib/server/dashboard/overview/controlModel";
import type { PeriodContext } from "@/lib/server/dashboard/insights/compare";
import type { ChartMarker } from "@/lib/server/dashboard/overview/markers";
import {
  metricLabels,
  metricValue,
  type ControlMetric,
} from "./ControlMetrics";
import classes from "./ControlCenter.module.css";
import { chartCeiling, chartTicks } from "./chartScale";

type Row = { x: string; current: number | null; previous: number | null; live: boolean };
const dayLabel = (d: string) =>
  new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`));
const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? "AM" : "PM"}`;

export default function ControlTrend({
  view,
  markers = [],
}: {
  view: ControlPerformance & { context?: PeriodContext };
  markers?: ChartMarker[];
}) {
  const [metric, setMetric] = useState<ControlMetric>("results");
  const [selected, setSelected] = useState("");
  const hourly = view.context?.hourly ?? null;
  const previousName = hourly ? "Yesterday" : view.context?.referenceLabel ?? null;
  const currentName = hourly ? "Today" : "This period";

  const rows: Row[] = useMemo(() => {
    if (hourly) {
      const lastToday = hourly.reduce((last, p, i) => (p.today.spend !== null ? i : last), -1);
      return hourly.map((p, i) => ({ x: hourLabel(p.hour), current: p.today[metric], previous: p.yesterday[metric], live: i === lastToday }));
    }
    return view.points.map((p, i) => ({
      x: p.day,
      current: p[metric],
      previous: view.context?.previousPoints?.[i]?.[metric] ?? null,
      live: p.current,
    }));
  }, [hourly, view.points, view.context?.previousPoints, metric]);

  const hasPrevious = rows.some((r) => r.previous !== null);
  const ceiling = chartCeiling(Math.max(0, ...rows.flatMap((r) => [r.current ?? 0, r.previous ?? 0])));
  // Cost per result is cumulative (running) on both the daily and hourly charts.
  const label = metric === "costPerResult" ? `${metricLabels.costPerResult} (running)` : metricLabels[metric];
  const shownMarkers = hourly ? [] : markers.filter((m) => rows.some((r) => r.x === m.day));
  const format = (v: number) => metricValue(metric, v, view.currency);
  const xLabel = (x: string) => (hourly ? x : dayLabel(x));

  return (
    <>
      <div className={classes.chartToolbar}>
        <div className={classes.metricTabs} role="group" aria-label="Chart metric">
          {(["results", "spend", "costPerResult", "ctr"] as const).map((key) => (
            <button key={key} type="button" aria-pressed={metric === key} onClick={() => setMetric(key)}>
              {metricLabels[key]}
            </button>
          ))}
        </div>
        <div className={classes.chartLegend} aria-hidden="true">
          <span><i className={classes.legendCurrent} />{currentName}</span>
          {hasPrevious && previousName && <span><i className={classes.legendPrevious} />{previousName}</span>}
          {shownMarkers.length > 0 && <span><i className={classes.legendMarker} />Changes</span>}
        </div>
      </div>
      <div
        className={classes.bigChart}
        role="img"
        aria-label={`${label} ${hourly ? "cumulative by hour, today versus yesterday" : "by day"}${hasPrevious && !hourly ? `, with ${previousName?.toLowerCase()} for comparison` : ""}. Missing data remains gaps.`}
      >
        {rows.some((r) => r.current !== null || r.previous !== null) ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={rows}
              onClick={(event) => { if (event?.activeLabel) setSelected(String(event.activeLabel)); }}
              margin={{ top: 18, right: 14, bottom: 0, left: 0 }}
              accessibilityLayer
            >
              <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
              <XAxis
                dataKey="x"
                tickFormatter={xLabel}
                minTickGap={hourly ? 28 : 35}
                tick={{ fill: "var(--chart-text)", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                width={44}
                domain={[0, ceiling]}
                ticks={chartTicks(ceiling)}
                tickFormatter={(v) => new Intl.NumberFormat("en", { notation: "compact" }).format(v)}
                tick={{ fill: "var(--chart-text)", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              {shownMarkers.map((m) => (
                <ReferenceLine
                  key={`${m.day}:${m.label}`}
                  x={m.day}
                  stroke="var(--ui-warning, #855a13)"
                  strokeOpacity={0.55}
                  strokeDasharray="2 4"
                  label={{ value: "◆", position: "top", fill: "var(--ui-warning, #855a13)", fontSize: 10 }}
                />
              ))}
              <ReferenceLine
                x={selected || rows.find((r) => r.live)?.x || rows.at(-1)?.x}
                stroke="var(--chart-text)"
                strokeDasharray="3 5"
              />
              <Tooltip
                contentStyle={{
                  background: "var(--ui-panel, #fff)",
                  color: "var(--ui-text, #082d56)",
                  borderRadius: 10,
                  border: "1px solid var(--ui-line, #d9e3ef)",
                  fontSize: 12,
                }}
                formatter={(value, name) => [
                  typeof value === "number" ? format(value) : "Not recorded",
                  name === "previous" ? previousName ?? "Previous" : `${currentName} · ${label}`,
                ]}
                labelFormatter={(x) => {
                  const row = rows.find((r) => r.x === x);
                  const changes = shownMarkers.filter((m) => m.day === x).map((m) => m.label);
                  return `${xLabel(String(x))}${row?.live ? " · Live" : ""}${changes.length ? ` · ${changes.join(", ")}` : ""}`;
                }}
              />
              {hasPrevious && (
                <Line
                  dataKey="previous"
                  type="linear"
                  stroke="var(--chart-text)"
                  strokeOpacity={0.45}
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                  activeDot={{ r: 4, fill: "var(--chart-text)" }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              )}
              <Line
                dataKey="current"
                type="linear"
                stroke="var(--chart-line)"
                strokeWidth={3}
                dot={hourly ? false : { r: 4, fill: "var(--chart-line)", stroke: "var(--ui-panel, #fff)", strokeWidth: 2 }}
                activeDot={{ r: 6, fill: "var(--chart-line)", stroke: "var(--ui-panel, #fff)", strokeWidth: 2 }}
                connectNulls={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className={classes.chartEmpty}>No recorded {metricLabels[metric].toLowerCase()} for this period</div>
        )}
      </div>
    </>
  );
}
