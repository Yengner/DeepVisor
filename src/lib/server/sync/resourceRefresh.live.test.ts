import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import type { Database, Json } from '@/lib/shared/types/supabase';
vi.mock('server-only',()=>({}));
vi.mock('next/cache',()=>({revalidateTag:vi.fn()}));
vi.mock('@/lib/server/supabase/admin',()=>({createAdminClient:vi.fn()}));
import { createAdminClient } from '@/lib/server/supabase/admin';
import { requestResource } from './resources/coordinator';
import { readAudienceSnapshot } from './resources/snapshots';
import { processMetaBackfillJobs } from './meta/processBackfillJobs';
import { SIMULATION_TAG } from '../integrations/simulation/meta';
import { asRecord } from '@/lib/shared/utils/format';
import { accountToday, shiftReportDay } from '@/lib/shared/reports/dates';
const project='gkdyyjqepzayjdpvqnja';
const must=<T>(r:{data:T;error:unknown})=>{if(r.error)throw new Error(JSON.stringify(r.error));return r.data as NonNullable<T>;};
describe.skipIf(process.env.DEEPVISOR_RESOURCE_TEST!==project)('resource refresh against development Supabase',()=>{
 it('publishes real synthetic metrics, preserves snapshot windows, deduplicates and enforces authenticated RLS',async()=>{
  expect(process.env.NEXT_PUBLIC_SUPABASE_URL).toBe(`https://${project}.supabase.co`);
  expect(process.env.DEEPVISOR_META_EXECUTION_ENABLED).not.toBe('true');
  const users=JSON.parse(readFileSync('.env.beta-phase5.json','utf8')).users;
  const user=users[0];
  const admin=createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
  vi.mocked(createAdminClient).mockReturnValue(admin);
  const integration=must(await admin.from('platform_integrations').select('*').eq('business_id',user.businessId).single());
  const original=asRecord(integration.integration_details),simulation=asRecord(original[SIMULATION_TAG]);
  expect(simulation.businessId).toBe(user.businessId);
  const account=must(await admin.from('ad_accounts').select('*').eq('business_id',user.businessId).eq('external_account_id',String(original.primary_ad_account_external_id)).single());
  expect(must(await admin.from('account_sync_jobs').select('id').eq('ad_account_id',account.id).in('status',['queued','running']))).toHaveLength(0);
  const today=accountToday(account.timezone)!;
  const scope={businessId:user.businessId,integrationId:integration.id,adAccountId:account.id,allowSimulation:true};
  const since=shiftReportDay(today,-1),week=shiftReportDay(today,-6);
  const jobs:string[]=[];const started=Date.now();
  const fetchOriginal=global.fetch;
  vi.stubGlobal('fetch',((input:RequestInfo|URL,init?:RequestInit)=>{
    const url=typeof input==='string'?input:input instanceof URL?input.href:input.url;
    if(new URL(url).hostname==='graph.facebook.com')throw new Error('Real Meta request forbidden in fixture test');
    return fetchOriginal(input,init);
  }) as typeof fetch);
  try {
    // Reset only explicitly designated synthetic freshness controls, retaining sync/audit history.
    must(await admin.from('account_sync_resources').delete().eq('ad_account_id',account.id).eq('business_id',user.businessId));
    must(await admin.from('platform_integrations').update({status:'connected',integration_details:{...original,[SIMULATION_TAG]:{...simulation,anchorDay:today,scenario:'multiple',revision:0}}}).eq('id',integration.id));
    const queued=await Promise.all(Array.from({length:20},()=>requestResource(scope,'performance',{since,until:today,source:'app_visit'})));
    expect(queued.every(r=>r.jobId===queued[0].jobId)).toBe(true);expect(queued[0].jobId).toBeTruthy();
    jobs.push(queued[0].jobId!);
    expect(await processMetaBackfillJobs({targetJobId:jobs[0]})).toMatchObject({completedCount:1,failedCount:0});
    expect(await requestResource(scope,'performance',{since,until:today,source:'app_visit'})).toMatchObject({reason:'fresh',revision:1});
    const second=await requestResource(scope,'performance',{since:week,until:today,source:'scheduled_refresh'});expect(second.jobId).toBeTruthy();jobs.push(second.jobId!);
    expect(await processMetaBackfillJobs({targetJobId:second.jobId})).toMatchObject({completedCount:1,failedCount:0});
    expect((await processMetaBackfillJobs({targetJobId:second.jobId})).processedCount).toBe(0);
    const facts=must(await admin.from('ad_entity_performance_daily').select('entity_id,day,spend,leads').eq('ad_account_id',account.id).eq('entity_level','adset').gte('day',week).lte('day',today));
    expect(new Set(facts.map(r=>`${r.entity_id}:${r.day}`)).size).toBe(facts.length);
    const multiplier=account.external_account_id.endsWith('_2')?2:1;
    expect(facts.reduce((n,r)=>n+(r.spend??0),0)).toBe(240*multiplier);
    expect(facts.reduce((n,r)=>n+(r.leads??0),0)).toBe(24*multiplier);
    expect(facts.filter(r=>r.day===since).reduce((n,r)=>n+(r.spend??0),0)).toBe(40*multiplier);
    for(const days of [6,13]){
      const start=shiftReportDay(today,-days);
      const next=await requestResource(scope,'audience',{since:start,until:today,source:'assistant',breakdown:'age_gender'});jobs.push(next.jobId!);
      expect(await processMetaBackfillJobs({targetJobId:next.jobId})).toMatchObject({completedCount:1,failedCount:0});
      const snapshot=await readAudienceSnapshot(admin,{businessId:user.businessId,accountId:account.id,breakdown:'age_gender',since:start,until:today});
      expect(snapshot?.batch.coverage_start).toBe(start);expect(snapshot?.rows.length).toBeGreaterThan(0);
    }
    const exact=await readAudienceSnapshot(admin,{businessId:user.businessId,accountId:account.id,breakdown:'age_gender',since:week,until:today});
    expect(exact?.batch.coverage_start).toBe(week);
    const details=must(await admin.from('platform_integrations').select('integration_details').eq('id',integration.id).single());
    expect(asRecord(details.integration_details).manual_sync_rate_limit).toEqual(original.manual_sync_rate_limit);
    for(const [index,u] of users.slice(0,2).entries()) {
      const normal=createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
      const auth=await normal.auth.signInWithPassword({email:u.email,password:u.password});if(auth.error)throw auth.error;
      const visible=must(await normal.from('account_sync_resources').select('ad_account_id').eq('ad_account_id',account.id));
      expect(visible.length>0).toBe(index===0);
      const snapshots=must(await normal.from('audience_snapshot_batches').select('id').eq('ad_account_id',account.id));
      expect(snapshots.length>0).toBe(index===0);
      expect((await normal.rpc('request_account_resource',{p_business:user.businessId,p_integration:integration.id,p_account:account.id,p_kind:'performance',p_query:{version:2,since,until:today}})).error?.code).toBe('42501');
      await normal.auth.signOut({scope:'local'});
    }
    mkdirSync('docs/beta-readiness/resource-refresh',{recursive:true});
    writeFileSync('docs/beta-readiness/resource-refresh/live.json',JSON.stringify({project,accountId:account.id,jobs,spend:240*multiplier,leads:24*multiplier,elapsedMs:Date.now()-started,realPersistence:true,provider:'simulated',actualMetaRequests:0,rls:true},null,2));
  } finally {
    vi.unstubAllGlobals();
    const current=must(await admin.from('platform_integrations').select('integration_details').eq('id',integration.id).single());
    must(await admin.from('platform_integrations').update({status:integration.status,integration_details:{...asRecord(current.integration_details),[SIMULATION_TAG]:original[SIMULATION_TAG] as Json}}).eq('id',integration.id));
  }
 },120000);
});
