import { requiredMetric, actionMetric } from '../meta/normalization';
export type Insight = { entity_id: string; day: string; currency_code: string | null; spend: number | null; impressions: number | null; clicks: number | null; reach: number | null } & { inline_link_clicks: number | null; leads: number | null; messages: number | null; calls: number | null } & { externalId: string; publisher: string; label: string };
export type MetaRow = { adset_id?: string; date_start?: string; date_stop?: string; publisher_platform?: string; age?: string; gender?: string; hourly_stats_aggregated_by_advertiser_time_zone?: string; spend?: string; impressions?: string; clicks?: string; actions?: Array<{ action_type?: string; value?: string }> };
/**
 * `actionsRequested` says whether the request included the `actions` field. When it did,
 * Meta omits `actions` for rows with no conversions, so results are 0, not unknown.
 * Only a request that excluded actions (hourly fallback) leaves results unknown.
 */
export function normalize(rows: MetaRow[], currency: string, hourly = false, actionsRequested = true): Insight[] {
  return rows.map(r => {
    if ((r.date_stop && r.date_stop !== r.date_start) || !r.date_start || !/^\d{4}-\d{2}-\d{2}$/.test(r.date_start) || !r.publisher_platform) throw new Error('Invalid Insights scope');
    const actions = r.actions;
    return { entity_id: r.adset_id ?? 'account', externalId: r.adset_id ?? '', day: r.date_start, currency_code: currency,
      publisher: r.publisher_platform, label: hourly ? r.hourly_stats_aggregated_by_advertiser_time_zone ?? 'Unknown hour' : [r.age, r.gender].filter(Boolean).join(' · '),
      spend: requiredMetric(r.spend), impressions: requiredMetric(r.impressions), clicks: requiredMetric(r.clicks), reach: null, inline_link_clicks: null,
      leads: !actionsRequested ? null : actionMetric(actions, ['onsite_conversion.lead_grouped', 'lead', 'offsite_conversion.fb_pixel_lead']),
      messages: !actionsRequested ? null : actionMetric(actions, ['onsite_conversion.messaging_conversation_started_7d']),
      calls: !actionsRequested ? null : actionMetric(actions, ['onsite_conversion.phone_call_click', 'phone_call']) };
  });
}
export function learningLabel(value: unknown): string {
  const state = value && typeof value === 'object' ? (value as Record<string, unknown>).status : null;
  // Meta's documented values are LEARNING, SUCCESS, FAIL (learning limited) and WAIVING.
  return state === 'LEARNING' ? 'Learning' : state === 'LEARNING_LIMITED' || state === 'FAIL' ? 'Learning limited' : state === 'SUCCESS' ? 'Learning complete' : state === 'WAIVING' ? 'Learning not required' : 'Unavailable';
}

/** Some Meta hourly breakdowns reject action fields while still returning delivery metrics. */
export async function readInsightActions<T>(
  read: (includeActions: boolean) => Promise<T>,
  hourly: boolean,
): Promise<{ rows: T; actionsRequested: boolean }> {
  try {
    return { rows: await read(true), actionsRequested: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (!hourly || !/\bactions?\b/i.test(message) ||
        !/not supported|unsupported|not available|cannot be combined|not compatible|invalid field/i.test(message)) throw error;
    return { rows: await read(false), actionsRequested: false };
  }
}
