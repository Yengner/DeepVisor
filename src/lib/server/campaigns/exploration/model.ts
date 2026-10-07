import {
  metricsFor,
  periodRange,
  shiftDay,
} from "../../dashboard/overview/model";
import type {
  Daily,
  Metrics,
  Period,
  Delta,
  Media,
  Creative,
  Summary,
} from "./types";

const valid = (n: unknown): n is number =>
  typeof n === "number" && Number.isFinite(n) && n >= 0;
export function aggregate(rows: Daily[], currency: string | null): Metrics {
  const sum = (key: "impressions" | "clicks" | "reach" | "inline_link_clicks") =>
    rows.length && rows.every((r) => valid(r[key]))
      ? rows.reduce((n, r) => n + r[key]!, 0)
      : null;
  const ratio = (a: number | null, b: number | null, multiplier = 1) =>
    a !== null && b !== null && b > 0 ? (a / b) * multiplier : null;
  const base = metricsFor(rows, currency);
  const impressions = sum("impressions"),
    clicks = sum("clicks");
  // Daily reach is not additive across dates. Do not claim deduplicated window reach.
  const reach =
    new Set(rows.map((r) => r.day)).size === 1 ? sum("reach") : null;
  return {
    ...base,
    impressions,
    clicks,
    linkClicks: sum('inline_link_clicks'),
    reach,
    frequency: ratio(impressions, reach),
    ctr: ratio(clicks, impressions, 100),
    cpc: ratio(base.spend, clicks),
    cpm: ratio(base.spend, impressions, 1000),
  };
}
export function complete(
  rows: Daily[],
  since: string,
  until: string,
  currency: string | null,
) {
  const expected =
    Math.round((Date.parse(until) - Date.parse(since)) / 86400000) + 1;
  return (
    rows.length === expected &&
    new Set(rows.map((r) => r.day)).size === expected &&
    rows.every((r) => r.day >= since && r.day <= until) &&
    aggregate(rows, currency).results !== null
  );
}
export function delta(
  key: keyof Metrics,
  current: number | null,
  previous: number | null,
): Delta | null {
  if (
    current === null ||
    previous === null ||
    !valid(current) ||
    !valid(previous) ||
    (key !== "ctr" && previous === 0)
  )
    return null;
  const value =
    key === "ctr"
      ? current - previous
      : ((current - previous) / previous) * 100;
  if (!Number.isFinite(value)) return null;
  const positive = ["results", "ctr"].includes(key),
    negative = ["costPerResult", "cpc", "cpm"].includes(key);
  return {
    value,
    unit: key === "ctr" ? "pp" : "%",
    tone:
      value === 0 || (!positive && !negative)
        ? "neutral"
        : (positive && value > 0) || (negative && value < 0)
          ? "positive"
          : "negative",
  };
}
export function comparisons(
  rows: Daily[],
  period: Period,
  today: string,
  currency: string | null,
) {
  if (period === "today") return {};
  const n = period === "7d" ? 7 : 30;
  const recentStart = shiftDay(today, -n),
    previousStart = shiftDay(today, -2 * n);
  const recent = rows.filter((r) => r.day >= recentStart && r.day < today);
  const previous = rows.filter(
    (r) => r.day >= previousStart && r.day < recentStart,
  );
  if (
    !complete(recent, recentStart, shiftDay(today, -1), currency) ||
    !complete(previous, previousStart, shiftDay(recentStart, -1), currency)
  )
    return {};
  const a = aggregate(recent, currency),
    b = aggregate(previous, currency);
  return Object.fromEntries(
    (Object.keys(a) as Array<keyof Metrics>).flatMap((key) => {
      const d = delta(key, a[key] ?? null, b[key] ?? null);
      return d ? [[key, d]] : [];
    }),
  );
}
export function trend(
  rows: Daily[],
  period: Period,
  today: string,
  currency: string | null,
) {
  const { since } = periodRange(period === "today" ? "7d" : period, today);
  const points = [];
  for (let day = since; day <= today; day = shiftDay(day, 1)) {
    points.push({
      day,
      current: day === today,
      ...aggregate(
        rows.filter((r) => r.day === day),
        currency,
      ),
    });
  }
  return points;
}
export function safeMediaUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}
export function mediaFor(creative: Creative): Media {
  const object = (value: unknown): Record<string, unknown> =>
    value !== null && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const story = object(creative.object_story_spec),
    feed = object(creative.asset_feed_spec);
  const children = object(story.link_data).child_attachments;
  const dynamic = ["images", "videos"].some(
    (key) => Array.isArray(feed[key]) && (feed[key] as unknown[]).length > 1,
  );
  const kind =
    dynamic || creative.creative_type?.toLowerCase().includes("dynamic")
      ? "dynamic"
      : (Array.isArray(children) && children.length > 1) ||
          creative.creative_type?.toLowerCase() === "carousel"
        ? "carousel"
        : creative.video_id || creative.creative_type?.toLowerCase() === "video"
          ? "video"
          : "image";
  return {
    creativeId: creative.platform_creative_id,
    kind,
    image:
      safeMediaUrl(
        kind === "video" ? creative.thumbnail_url : creative.image_url,
      ) ?? safeMediaUrl(creative.thumbnail_url),
    fallbackImage: safeMediaUrl(creative.thumbnail_url),
    headline: creative.headline,
    text: creative.primary_text,
    cta: creative.cta_type,
  };
}
export function rank(items: Summary[]): Summary[] {
  const sorted = [...items].sort(
    (a, b) =>
      (b.metrics.results ?? -1) - (a.metrics.results ?? -1) ||
      (a.metrics.costPerResult ?? Infinity) -
        (b.metrics.costPerResult ?? Infinity) ||
      (b.metrics.spend ?? -1) - (a.metrics.spend ?? -1) ||
      a.id.localeCompare(b.id),
  );
  const eligible =
    sorted.length >= 2 &&
    sorted.every((i) => i.complete && i.metrics.results !== null) &&
    (sorted[0].metrics.results ?? 0) > 0;
  const leaders = eligible
    ? sorted.filter((i) => i.metrics.results === sorted[0].metrics.results)
    : [];
  return sorted.map((item) => ({
    ...item,
    leader: leaders.includes(item),
    tied: leaders.length > 1 && leaders.includes(item),
  }));
}
