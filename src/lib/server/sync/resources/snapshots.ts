import 'server-only';
import { z } from 'zod';
import { readAllPages } from '@/lib/server/repositories/pagination';
import type { RepositoryClient } from '@/lib/server/repositories/utils';
import { resourceRefreshEnabled } from './coordinator';
const number = z.number().nullable();
const text = z.string().nullable();
const snapshotRow = z.object({
  entity_id: z.string(), entity_level: z.literal('adset'), ad_account_id: z.string(), campaign_id: text, adset_id: text, ad_id: text,
  first_day: z.string(), last_day: z.string(), breakdown_type: z.string(),
  dimension_1_key: z.string(), dimension_1_value: z.string(), dimension_2_key: z.string(), dimension_2_value: z.string(),
  publisher_platform: text, platform_position: text, impression_device: text, currency_code: text,
  spend: number, impressions: number, reach: number, clicks: number, inline_link_clicks: number, leads: number, messages: number, calls: number, updated_at: z.string(),
});
/** Prefer one complete exact-window batch. Never concatenate different batches or coverage windows. */
export async function readAudienceSnapshot(db: RepositoryClient, input: { businessId: string; accountId: string; breakdown: string; since: string; until: string }) {
  if (!resourceRefreshEnabled()) return null;
  const base = () => db.from('audience_snapshot_batches').select('id,row_count,coverage_start,coverage_end,published_at').eq('business_id', input.businessId)
    .eq('ad_account_id', input.accountId).eq('completeness', 'complete').contains('query', { breakdown: input.breakdown });
  let result = await base().eq('coverage_start', input.since).eq('coverage_end', input.until).order('published_at', { ascending: false }).limit(1).maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) result = await base().order('coverage_end', { ascending: false }).order('published_at', { ascending: false }).limit(1).maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) return null;
  const batch = result.data;
  const rows = await readAllPages((from, to) => {
    if (from >= 10000) throw new Error('Audience lookup exceeds 10,000 observations');
    return db.from('audience_snapshot_rows').select('data').eq('batch_id', batch.id).order('row_number').range(from, to);
  }, { nullDataError: 'Snapshot rows unavailable' });
  if (rows.length !== batch.row_count) throw new Error('Incomplete audience batch');
  const parsed = rows.map(row => snapshotRow.parse(row.data));
  if (parsed.some(row => row.ad_account_id !== input.accountId || row.first_day !== batch.coverage_start || row.last_day !== batch.coverage_end)) throw new Error('Invalid audience batch scope');
  return { batch, rows: parsed.map(row => ({ ...row, actions_json: null, cost_per_action_type_json: null, created_at: batch.published_at, day: row.last_day, objective: null, raw: null, source: 'api' })) };
}
