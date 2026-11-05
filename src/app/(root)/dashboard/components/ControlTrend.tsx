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
      <div
        className={classes.bigChart}
        role="img"
        aria-label={`${metricLabels[metric]} daily chart. Missing days remain gaps. Use arrow keys to inspect observations.`}
      >
        {view.points.some((p) => p[metric] !== null) ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={view.points}
              onClick={event => { if (event?.activeLabel) setDay(String(event.activeLabel)); }}
              margin={{ top: 12, right: 14, bottom: 0, left: 0 }}
              accessibilityLayer
            >
              <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
              <XAxis
                dataKey="day"
                tickFormatter={(d) => new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`))}
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
                x={day || view.points.at(-1)?.day}
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
                formatter={(value) => [
                  typeof value === "number"
                    ? metricValue(metric, value, view.currency)
                    : "Not recorded",
                  metricLabels[metric],
                ]}
                labelFormatter={(value) =>
                  `${new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`))}${value === view.points.at(-1)?.day ? " · Today, partial" : ""}`
                }
              />
              <Line
                dataKey={metric}
                type="linear"
                stroke="var(--chart-line)"
                strokeWidth={3}
                dot={{ r: 4, fill: "var(--chart-line)", stroke: "var(--ui-panel, #fff)", strokeWidth: 2 }}
                activeDot={{ r: 6, fill: "var(--chart-line)", stroke: "var(--ui-panel, #fff)", strokeWidth: 2 }}
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

    </>
  );
}
