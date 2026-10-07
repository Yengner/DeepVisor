"use client";
import { useState } from "react";
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
import {
  metricLabels,
  metricValue,
  MetricDelta,
  type ControlMetric,
} from "./ControlMetrics";
import classes from "./ControlCenter.module.css";

export default function ControlTrend({
  view,
  todayOnly = false,
}: {
  view: ControlPerformance;
  todayOnly?: boolean;
}) {
  const [metric, setMetric] = useState<ControlMetric>("results");
  const [day, setDay] = useState("");
  const point = view.points.find((p) => p.day === day) ?? view.points.at(-1);
  return (
    <>
      <div className={classes.chartToolbar}>
        <div
          className={classes.metricTabs}
          role="group"
          aria-label="Chart metric"
        >
          {(["results", "spend", "costPerResult", "ctr"] as const).map(
            (key) => (
              <button
                key={key}
                type="button"
                aria-pressed={metric === key}
                onClick={() => setMetric(key)}
              >
                {metricLabels[key]}
              </button>
            ),
          )}
        </div>
        <span className={classes.chartPeriod}>
          {todayOnly ? "7-day daily trend" : "Daily trend"}
        </span>
      </div>
      <div className={classes.chartValue}>
        <strong>
          {metricValue(metric, view.metrics[metric], view.currency, true)}
        </strong>
        <MetricDelta
          change={view.deltas[metric]}
          description={view.comparison}
        />
      </div>
      <div
        className={classes.bigChart}
        role="img"
        aria-label={`${metricLabels[metric]} daily chart. Missing days remain gaps. Daily values available below.`}
      >
        {view.points.some((p) => p[metric] !== null) ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={view.points}
              margin={{ top: 12, right: 14, bottom: 0, left: 0 }}
              accessibilityLayer
            >
              <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
              <XAxis
                dataKey="day"
                tickFormatter={(d) => String(d).slice(5)}
                minTickGap={35}
                tick={{ fill: "var(--chart-text)", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                width={44}
                tickFormatter={(v) =>
                  new Intl.NumberFormat("en", { notation: "compact" }).format(v)
                }
                tick={{ fill: "var(--chart-text)", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <ReferenceLine
                x={view.points.at(-1)?.day}
                stroke="var(--chart-text)"
                strokeDasharray="3 5"
              />
              <Tooltip
                contentStyle={{
                  background: "#fff",
                  color: "#151714",
                  borderRadius: 6,
                  border: "none",
                  fontSize: 12,
                }}
                formatter={(value) => [
                  typeof value === "number"
                    ? metricValue(metric, value, view.currency)
                    : "Not recorded",
                  metricLabels[metric],
                ]}
                labelFormatter={(value) =>
                  `${value}${value === view.points.at(-1)?.day ? " · Today, partial" : ""}`
                }
              />
              <Line
                dataKey={metric}
                type="linear"
                stroke="var(--chart-line)"
                strokeWidth={3}
                dot={{ r: 3, strokeWidth: 0 }}
                activeDot={{ r: 5 }}
                connectNulls={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className={classes.chartEmpty}>
            No recorded {metricLabels[metric].toLowerCase()} for this period
          </div>
        )}
      </div>
      <details className={classes.chartDetails}>
        <summary>
          Daily values{todayOnly ? " · 7-day trend, today highlighted" : ""}
        </summary>
        {view.partial && <p>Recorded data only. Some ad sets or days may be missing; comparisons are hidden unless both windows are complete.</p>}
        <label>
          Date{" "}
          <select
            value={point?.day ?? ""}
            onChange={(e) => setDay(e.target.value)}
          >
            {view.points.map((p) => (
              <option value={p.day} key={p.day}>
                {p.day}
                {p.current ? " · partial" : ""}
              </option>
            ))}
          </select>
        </label>
        <output>
          {point
            ? metricValue(metric, point[metric], view.currency)
            : "Not recorded"}{" "}
          {metricLabels[metric]}
        </output>
        {view.comparison && <p>Changes: {view.comparison}</p>}
      </details>
    </>
  );
}
