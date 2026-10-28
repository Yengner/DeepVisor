import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { describe,expect,it,vi } from 'vitest';
import type { Database, Json } from '@/lib/shared/types/supabase';
vi.mock('server-only',()=>({}));vi.mock('@/lib/server/supabase/admin',()=>({createAdminClient:vi.fn()}));
import { createAdminClient } from '@/lib/server/supabase/admin';
import { enqueueAutomaticAccountSync } from './automaticRefresh';
import { enqueueScheduledAccountSyncJobs } from './scheduledRefresh';
import { createOrReuseQueuedSyncJob } from '../repositories/ad_accounts/syncState';
import { processMetaBackfillJobs } from './meta/processBackfillJobs';
import { SIMULATION_TAG } from '../integrations/simulation/meta';
import { asRecord } from '@/lib/shared';
const project='gkdyyjqepzayjdpvqnja';
const must=<T>(r:{data:T;error:unknown})=>{if(r.error)throw new Error(JSON.stringify(r.error));return r.data as NonNullable<T>;};
describe.skipIf(process.env.DEEPVISOR_AUTO_SYNC_TEST!==project)('automatic refresh against development Supabase',()=>{
 it('deduplicates visit/scheduled/manual work, runs the real worker with the mock provider and preserves manual cooldown',async()=>{
  expect(process.env.NEXT_PUBLIC_SUPABASE_URL).toBe(`https://${project}.supabase.co`);
  expect(process.env.DEEPVISOR_META_EXECUTION_ENABLED).not.toBe('true');
  const user=JSON.parse(readFileSync('.env.beta-phase5.json','utf8')).users[0];
  const admin=createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
  vi.mocked(createAdminClient).mockReturnValue(admin);
  const integration=must(await admin.from('platform_integrations').select('*').eq('business_id',user.businessId).single());
  const original=asRecord(integration.integration_details),simulation=asRecord(original[SIMULATION_TAG]);
  expect(simulation.businessId).toBe(user.businessId);
  const account=must(await admin.from('ad_accounts').select('*').eq('business_id',user.businessId).eq('external_account_id',String(original.primary_ad_account_external_id)).single());
  const state=must(await admin.from('ad_account_sync_state').select('*').eq('ad_account_id',account.id).single());
  expect(state.first_full_sync_completed).toBe(true);
  expect(must(await admin.from('account_sync_jobs').select('id').eq('ad_account_id',account.id).in('status',['queued','running']))).toHaveLength(0);
  // The fixture is stale naturally; never falsify a successful sync timestamp.
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:account.timezone!,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const changed={...original,[SIMULATION_TAG]:{...simulation,anchorDay:today,scenario:'multiple',revision:0}};
  const cooldown=original.manual_sync_rate_limit;
  let jobId:string|undefined;
  try{
   must(await admin.from('platform_integrations').update({status:'connected',integration_details:changed}).eq('id',integration.id));
   must(await admin.from('ad_account_sync_state').update({last_visit_sync_check_day:null}).eq('id',state.id));
   const input={businessId:user.businessId,integrationId:integration.id,adAccountId:account.id,source:'app_visit' as const,allowSimulation:true};
   const queued=await enqueueAutomaticAccountSync(input);expect(queued).toMatchObject({status:'queued',reason:'enqueued'});jobId=queued.jobId!;
   const jobs=await Promise.all([
    enqueueAutomaticAccountSync(input),
    enqueueScheduledAccountSyncJobs({businessId:user.businessId,adAccountId:account.id}),
    createOrReuseQueuedSyncJob(admin,{businessId:user.businessId,platformIntegrationId:integration.id,adAccountId:account.id,syncType:'manual_refresh',requestedStartDate:today,requestedEndDate:today}),
   ]);
   expect(jobs[0].jobId).toBe(jobId);expect(jobs[1].results[0].jobId).toBe(jobId);expect(jobs[2].id).toBe(jobId);
   const finished=await processMetaBackfillJobs({targetJobId:jobId});expect(finished).toMatchObject({completedCount:1,failedCount:0});
   expect((await processMetaBackfillJobs({targetJobId:jobId})).processedCount).toBe(0);
   const persisted=must(await admin.from('account_sync_jobs').select('*').eq('id',jobId).single());expect(persisted.status).toBe('completed');expect(persisted.finished_at).toBeTruthy();
   expect(persisted.requested_end_date).toBe(today);expect((Date.parse(today)-Date.parse(persisted.requested_start_date!))/86400000).toBe(6);
   const facts=must(await admin.from('ad_entity_performance_daily').select('day,spend,leads,messages,calls').eq('ad_account_id',account.id).eq('entity_level','adset').gte('day',persisted.requested_start_date!).lt('day',today));
   const spend=facts.reduce((n,r)=>n+(r.spend??0),0),results=facts.reduce((n,r)=>n+(r.leads??0)+(r.messages??0)+(r.calls??0),0);
   const multiplier=account.external_account_id.endsWith('_2')?2:1;expect(spend).toBe(240*multiplier);expect(results).toBe(24*multiplier);
   const after=must(await admin.from('ad_account_sync_state').select('*').eq('id',state.id).single());expect(after.last_successful_sync_job_id).toBe(jobId);
   const details=must(await admin.from('platform_integrations').select('integration_details').eq('id',integration.id).single());expect(asRecord(details.integration_details).manual_sync_rate_limit).toEqual(cooldown);
   expect(await enqueueAutomaticAccountSync(input)).toMatchObject({reason:'checked_today'});
   expect((await enqueueScheduledAccountSyncJobs({businessId:user.businessId,adAccountId:account.id})).results[0].message).toBe('fresh');
   const normal=createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
   const auth=await normal.auth.signInWithPassword({email:user.email,password:user.password});if(auth.error)throw auth.error;
   expect((await normal.rpc('enqueue_automatic_account_sync',{p_business:user.businessId,p_integration:integration.id,p_account:account.id,p_source:'app_visit'})).error?.code).toBe('42501');
   expect(must(await normal.from('account_sync_jobs').select('id').eq('business_id','f6f96cff-bde3-4627-a613-4f16bfdc1d7c'))).toHaveLength(0);await normal.auth.signOut({scope:'local'});
   mkdirSync('docs/beta-readiness/automatic-sync',{recursive:true});
   writeFileSync('docs/beta-readiness/automatic-sync/live.json',JSON.stringify({project,businessId:user.businessId,accountId:account.id,jobId,status:persisted.status,finishedAt:persisted.finished_at,since:persisted.requested_start_date,until:today,spend,results,cooldownUnchanged:true,duplicateClaimsDenied:true,normalClientRpcDenied:true,actualMetaWrites:0},null,2));
  }finally{
   // Preserve the new truthful successful-sync timestamp, IDs and history. Restore only fixture controls.
   const current=must(await admin.from('platform_integrations').select('integration_details').eq('id',integration.id).single());
   must(await admin.from('platform_integrations').update({integration_details:{...asRecord(current.integration_details),[SIMULATION_TAG]:original[SIMULATION_TAG] as Json}}).eq('id',integration.id));
  }
 },120000);
});
