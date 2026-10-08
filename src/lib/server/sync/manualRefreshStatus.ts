import 'server-only';
import { createHash } from 'node:crypto';
import type { RepositoryClient } from '@/lib/server/repositories/utils';

export async function performanceFingerprint(client: RepositoryClient, account: string, since: string, until: string) {
  const hash = createHash('sha256');
  for (let from = 0; ; from += 500) {
    const { data, error } = await client.from('ad_entity_performance_daily')
      .select('entity_id,day,spend,leads,messages,calls,impressions,clicks,reach,inline_link_clicks,currency_code')
      .eq('ad_account_id', account).eq('entity_level', 'adset')
      .gte('day', since).lte('day', until).order('entity_id').order('day').range(from, from + 499);
    if (error) throw error;
    for (const row of data ?? []) hash.update(JSON.stringify(row));
    if (!data || data.length < 500) break;
  }
  return hash.digest('hex');
}
