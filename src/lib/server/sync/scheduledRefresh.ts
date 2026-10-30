import 'server-only';
import { parallelTasks } from './concurrency';
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
    const eligible = (integrations ?? []).filter(integration => {
      const key=`${integration.business_id}:${integration.platform_id}`;
      if(seen.has(key)) return false; seen.add(key); return true;
    });
    const accounts: Array<{id:string; business_id:string; platform_id:string; external_account_id:string}> = [];
    if (eligible.length) for(let from=0;;from+=500) {
      let accountQuery = client.from('ad_accounts').select('id,business_id,platform_id,external_account_id')
        .in('business_id',eligible.map(i=>i.business_id)).in('platform_id',eligible.map(i=>i.platform_id))
        .in('external_account_id',eligible.map(i=>getPrimaryAdAccountSelection(i.integration_details).externalAccountId ?? ''))
        .order('id').range(from,from+499);
      if(input?.adAccountId) accountQuery=accountQuery.eq('id',input.adAccountId);
      const {data,error}=await accountQuery; if(error) throw error;
      accounts.push(...(data ?? [])); if(!data || data.length<500) break;
    }
    const byScope = new Map(accounts.map(a=>[`${a.business_id}:${a.platform_id}:${a.external_account_id}`,a]));
    let queued = results.reduce((n,r)=>n+Number(r.status==='queued'),0);
    for(let index=0;index<eligible.length;) {
      const batch=eligible.slice(index,index+Math.min(3,limit-queued)); index+=batch.length;
      const outcomes=await parallelTasks(batch.map(integration=>async ():Promise<ScheduledAccountSyncResult['results'][number]>=>{
        const base={businessId:integration.business_id,integrationId:integration.id};
        const primary=getPrimaryAdAccountSelection(integration.integration_details);
        const account=byScope.get(`${integration.business_id}:${integration.platform_id}:${primary.externalAccountId ?? ''}`);
        if(!account) return {...base,adAccountId:null,status:'skipped',message:'No selected account.'};
        try {
          const result=await enqueueAutomaticAccountSync({...base,adAccountId:account.id,source:'scheduled_refresh',
            staleAfterMinutes:clamp(input?.staleAfterMinutes,AUTO_SYNC_STALE_MINUTES,1440),
            lookbackDays:clamp(input?.lookbackDays,AUTO_SYNC_LOOKBACK_DAYS,30),
            allowSimulation:Boolean(input?.businessId&&input?.adAccountId&&targetedSimulationAllowed())});
          return {...base,adAccountId:account.id,jobId:result.jobId,status:result.reason==='enqueued'?'queued':'skipped',message:result.reason};
        } catch {return {...base,adAccountId:account.id,status:'failed',message:'Could not queue account refresh.'};}
      }));
      results.push(...outcomes); queued+=outcomes.filter(r=>r.status==='queued').length;
      if(queued>=limit) break outer;
    }
    if(!integrations||integrations.length<100)break;
  }
  return {consideredCount:results.length,queuedCount:results.filter(r=>r.status==='queued').length,
    skippedCount:results.filter(r=>r.status==='skipped').length,failedCount:results.filter(r=>r.status==='failed').length,results};
}
