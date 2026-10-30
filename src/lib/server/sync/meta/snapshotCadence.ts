import type { RepositoryClient } from '../../repositories/utils';
/** Timestamp controls refresh cadence only; measurement coverage stays in Meta's rows. */
export async function snapshotsDue(client: RepositoryClient, businessId: string, accountId: string, key: string, now: string) {
  const {data,error} = await client.from('account_sync_jobs').select('finished_at')
    .eq('business_id',businessId).eq('ad_account_id',accountId).eq('status','completed')
    .contains('metadata',{last_processed_ids:{snapshotKey:key}})
    .gte('finished_at',new Date(Date.parse(now)-24*3600000).toISOString())
    .order('finished_at',{ascending:false}).limit(1).maybeSingle();
  if(error) throw error;
  return !data;
}
