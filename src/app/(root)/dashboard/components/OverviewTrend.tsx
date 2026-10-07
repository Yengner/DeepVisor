"use client";
import { useState } from "react";
import { SegmentedControl } from "@mantine/core";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TrendPoint } from "@/lib/server/dashboard/overview/types";
import classes from "./Overview.module.css";

const labels = {
  spend: "Spend",
  results: "Results",
  costPerResult: "Cost per result",
  ctr: "CTR",
};
export default function OverviewTrend({
  points,
  currency,
}: {
  points: TrendPoint[];
  currency: string | null;
}) {
  const [metric, setMetric] = useState<keyof typeof labels>("results");
  const color =
    metric === "results" || metric === "ctr"
      ? "#287f60"
      : metric === "spend"
        ? "#3074d5"
        : "#a86a27";
  const format = (value: number) =>
    metric === "ctr"
      ? `${value.toFixed(2)}%`
      : metric === "results"
        ? new Intl.NumberFormat().format(value)
        : currency
          ? new Intl.NumberFormat("en", {
              style: "currency",
              currency,
              maximumFractionDigits: 2,
            }).format(value)
          : String(value);
  const last = points.filter((p) => p[metric] != null).at(-1);
  return (
    <>
      <SegmentedControl
        className={classes.trendModes}
        aria-label="Trend metric"
        mb="md"
        size="xs"
        radius="sm"
        value={metric}
        onChange={(value) => setMetric(value as keyof typeof labels)}
        data={Object.entries(labels)
          .filter(([key]) => key !== "ctr" || points.some((p) => "ctr" in p))
          .map(([value, label]) => ({
            value,
            label,
          }))}
      />
      {points.some((p) => p[metric] != null) ? (
        <div
          className={classes.chart}
          role="img"
          aria-label={`${labels[metric]} daily trend from ${points[0]?.day} to ${points.at(-1)?.day}`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={points}
              margin={{ top: 12, right: 12, bottom: 0, left: 0 }}
            >
              <CartesianGrid vertical={false} stroke="#e7ecef" />
              <XAxis
                dataKey="day"
                tickFormatter={(day) => String(day).slice(5)}
                tick={{ fontSize: 11, fill: "#62727c" }}
                minTickGap={25}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                width={42}
                tick={{ fontSize: 11, fill: "#62727c" }}
                axisLine={false}
                tickLine={false}
              />
              <ReferenceLine
                x={points.at(-1)?.day}
                stroke="#8096a9"
                strokeDasharray="3 3"
              />
              <Tooltip
                formatter={(value) => [
                  typeof value === "number" ? format(value) : "Unavailable",
                  labels[metric],
                ]}
                labelFormatter={(day) =>
                  `${day}${String(day) === points.at(-1)?.day ? " (today, partial)" : ""}`
                }
                contentStyle={{ fontSize: 12, borderRadius: 6 }}
              />
              <Line
                type="linear"
                dataKey={metric}
                stroke={color}
                strokeWidth={2}
                connectNulls={false}
                isAnimationActive={false}
                dot={{ r: 2 }}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className={classes.empty}>
          No daily {labels[metric].toLowerCase()} data for this period.
        </p>
      )}
      {last && (
        <p className={classes.chartSummary}>
          {last.day}
          {last.current ? " · Today, partial" : ""} · {labels[metric]}:{" "}
          {format(last[metric]!)}
        </p>
      )}
    </>
  );
}
