/** Ingestion contract v2: malformed delivery totals fail the stage; they never become zero. */
export const META_NORMALIZATION_VERSION = 2;
export function optionalMetric(value: unknown): number | null {
  if (value == null || value === '') return null;
  const number = typeof value === 'number' ? value : typeof value === 'string' && /^\d+(?:\.\d+)?$/.test(value.trim()) ? Number(value) : NaN;
  if (!Number.isFinite(number) || number < 0) throw new Error('Invalid Meta metric');
  return number;
}
export function requiredMetric(value: unknown): number {
  const metric = optionalMetric(value);
  if (metric === null) throw new Error('Required Meta delivery metric unavailable');
  return metric;
}
/**
 * Spend, impressions and clicks for one Meta Insights row. Meta omits zero-valued fields, so a day
 * with no paid delivery (spend reported as exactly 0: ads off, but conversations from earlier clicks
 * still attributed to that day) arrives without impressions or clicks. That is zero delivery, not
 * missing data. A missing spend, or missing impressions/clicks on a day that spent, still fails.
 */
export function deliveryMetrics(row: { spend?: unknown; impressions?: unknown; clicks?: unknown }): { spend: number; impressions: number; clicks: number } {
  const spend = requiredMetric(row.spend);
  if (spend === 0) return { spend, impressions: optionalMetric(row.impressions) ?? 0, clicks: optionalMetric(row.clicks) ?? 0 };
  return { spend, impressions: requiredMetric(row.impressions), clicks: requiredMetric(row.clicks) };
}
/** Ordered aliases represent the same result family, not additive independent conversions. */
export function actionMetric(actions: Array<{action_type?: string;value?: string}> | undefined, aliases: string[]): number {
  if (actions === undefined) return 0; // Meta omits action types with no reported actions.
  if (!Array.isArray(actions)) throw new Error('Invalid Meta actions');
  for (const alias of aliases) {
    const matches=actions.filter(action=>action.action_type===alias);
    if(matches.length>1) throw new Error('Ambiguous duplicate Meta action');
    if(matches.length) return requiredMetric(matches[0].value);
  }
  return 0;
}
export function metricRatio(numerator: number, denominator: number, scale = 1): number | null {
  return denominator > 0 ? numerator / denominator * scale : null;
}
