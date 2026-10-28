import 'server-only';
import { createAdminClient } from '@/lib/server/supabase/admin';
import { getPrimaryAdAccountSelection } from '@/lib/server/integrations/service';
import { enqueueAutomaticAccountSync, targetedSimulationAllowed, AUTO_SYNC_LOOKBACK_DAYS, AUTO_SYNC_STALE_MINUTES } from './automaticRefresh';

export type ScheduledAccountSyncResult = {
  consideredCount: number; queuedCount: number; skippedCount: number; failedCount: number;
  results: Array<{ businessId: string; integrationId: string; adAccountId: string | null;
    status: 'queued' | 'skipped' | 'failed'; jobId?: string; message: string }>;
};
function clamp(value: number | undefined, fallback: number, max: number) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.min(Math.floor(value), max)
    : fallback;
}

export async function enqueueScheduledAccountSyncJobs(input?: {
  limit?: number; lookbackDays?: number; staleAfterMinutes?: number; businessId?: string | null; adAccountId?: string | null;
}): Promise<ScheduledAccountSyncResult> {
  const client = createAdminClient(), results: ScheduledAccountSyncResult['results'] = [];
  const limit = clamp(input?.limit,25,100);
  const seen = new Set<string>();
  // Paging skips fresh/ineligible integrations without starving later businesses.
  outer: for (let offset=0;;offset+=100) {
    let query=client.from('platform_integrations').select('id,business_id,platform_id,integration_details,platforms!inner(key)')
      .in('status',['connected','error']).eq('platforms.key','meta').order('updated_at',{ascending:false}).order('id').range(offset,offset+99);
    if(input?.businessId) query=query.eq('business_id',input.businessId);
    const {data: integrations,error}=await query;if(error)throw error;
    for(const integration of integrations??[]) {
      const key=`${integration.business_id}:${integration.platform_id}`;if(seen.has(key))continue;seen.add(key);
      const base={businessId:integration.business_id,integrationId:integration.id};
      try {
        const primary=getPrimaryAdAccountSelection(integration.integration_details);
        let accountQuery=client.from('ad_accounts').select('id').eq('business_id',integration.business_id)
          .eq('platform_id',integration.platform_id).eq('external_account_id',primary.externalAccountId??'');
        if(input?.adAccountId)accountQuery=accountQuery.eq('id',input.adAccountId);
        const {data:account,error:accountError}=await accountQuery.maybeSingle();if(accountError)throw accountError;
        if(!account){results.push({...base,adAccountId:null,status:'skipped',message:'No selected account.'});continue;}
        const result=await enqueueAutomaticAccountSync({...base,adAccountId:account.id,source:'scheduled_refresh',
          staleAfterMinutes:clamp(input?.staleAfterMinutes,AUTO_SYNC_STALE_MINUTES,1440),
          lookbackDays:clamp(input?.lookbackDays,AUTO_SYNC_LOOKBACK_DAYS,30),
          allowSimulation:Boolean(input?.businessId&&input?.adAccountId&&targetedSimulationAllowed()),
        });
        results.push({...base,adAccountId:account.id,jobId:result.jobId,
          status:result.reason==='enqueued'?'queued':'skipped',message:result.reason});
        if(results.filter(r=>r.status==='queued').length>=limit)break outer;
      } catch {
        results.push({...base,adAccountId:null,status:'failed',message:'Could not queue account refresh.'});
      }
    }
    if(!integrations||integrations.length<100)break;
  }
  return {consideredCount:results.length,queuedCount:results.filter(r=>r.status==='queued').length,
    skippedCount:results.filter(r=>r.status==='skipped').length,failedCount:results.filter(r=>r.status==='failed').length,results};
}
