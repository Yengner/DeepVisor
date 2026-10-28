import { readFileSync } from 'node:fs';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { Database } from '@/lib/shared/types/supabase';
vi.mock('server-only', () => ({}));
vi.mock('./supabase/server', () => ({ createServerClient: vi.fn(), createSupabaseClient: vi.fn() }));
vi.mock('./supabase/admin', () => ({ createAdminClient: vi.fn() }));
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn, revalidateTag: vi.fn(), revalidatePath: vi.fn() }));
vi.mock('./actions/user/session', () => ({ requireUserId: vi.fn() }));
import { createServerClient, createSupabaseClient } from './supabase/server';
import { createAdminClient } from './supabase/admin';
import { requireUserId } from './actions/user/session';
import { getOrCreateOrganizationBusinessContext } from './actions/business/context';
import { getOnboardingInitial, updateBusinessProfileData, updateOnboardingProgress } from './actions/business/onboarding';
import { loadOverviewDaily, loadOverviewEntities } from './dashboard/overview/load';
import { simulationAccounts, SIMULATION_TAG } from './integrations/simulation/meta';
import { createOAuthState, consumeOAuthState } from './integrations/service';
import { syncSelectedMetaAdAccount } from './integrations/metaSelection';
import { createOrReuseQueuedSyncJob } from './repositories/ad_accounts/syncState';
import { processMetaBackfillJobs } from './sync/meta/processBackfillJobs';

const enabled = process.env.DEEPVISOR_META_SIMULATION === 'gkdyyjqepzayjdpvqnja';
describe.skipIf(!enabled)('Phase 2 real Supabase lifecycle (explicit opt-in)', () => {
  let admin: SupabaseClient<Database>;
  let users: { id:string; email:string; password:string; key:string; businessId?:string; organizationId?:string }[];
  const clients: SupabaseClient<Database>[] = [];
  beforeAll(async () => {
    expect(process.env.NODE_ENV).toBe('test');
    expect(process.env.NEXT_PUBLIC_SUPABASE_URL).toBe('https://gkdyyjqepzayjdpvqnja.supabase.co');
    users = JSON.parse(readFileSync('.env.beta-phase2.json','utf8')).users;
    admin = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
    vi.mocked(createAdminClient).mockReturnValue(admin);
    for (const user of users) {
      const client = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
      const result = await client.auth.signInWithPassword({email:user.email,password:user.password});
      if (result.error) throw result.error;
      clients.push(client);
    }
  },60000);
  const asUser = (index:number) => { vi.mocked(createServerClient).mockResolvedValue(clients[index]); vi.mocked(createSupabaseClient).mockResolvedValue(clients[index]); vi.mocked(requireUserId).mockResolvedValue(users[index].id); };
  it('rejects incorrect passwords and invalid email; refreshes real sessions', async () => {
    const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
    expect((await client.auth.signInWithPassword({email:users[0].email,password:'incorrect'})).error?.code).toBe('invalid_credentials');
    expect((await client.auth.signUp({email:'invalid',password:'StrongPassword!aA9'})).error).toBeTruthy();
    expect((await clients[0].auth.refreshSession()).error).toBeNull();
  },30000);
  it('concurrent context creation is idempotent and ownership is isolated', async () => {
    for (let i=0;i<users.length;i++) {
      asUser(i);
      const contexts = await Promise.all(Array.from({length:5},()=>getOrCreateOrganizationBusinessContext(users[i].id)));
      expect(new Set(contexts.map(c=>c.businessId)).size).toBe(1);
      users[i].businessId=contexts[0].businessId; users[i].organizationId=contexts[0].organizationId;
      expect(contexts.every(c=>c.role==='owner')).toBe(true);
      const memberships = await clients[i].from('organization_memberships').select('organization_id').eq('user_id',users[i].id);
      expect(memberships.error).toBeNull(); expect(memberships.data).toHaveLength(1);
    }
    expect(users[0].businessId).not.toBe(users[1].businessId);
    expect((await clients[0].from('business_profiles').select('id').eq('id',users[1].businessId!)).data).toEqual([]);
  },60000);
  it('validates progress and persists profile updates through real actions', async () => {
    asUser(1);
    expect((await updateOnboardingProgress({step:-1})).success).toBe(false);
    expect((await updateOnboardingProgress({step:99,completed:true})).success).toBe(false);
    expect((await updateBusinessProfileData({businessName:'Business setup'})).success).toBe(false);
    expect((await updateBusinessProfileData({industry:'invalid'})).success).toBe(false);
    expect((await updateBusinessProfileData({monthlyBudget:'500_1000',industry:'beauty_salon',primaryGoal:'more_leads',metaAdsStatus:'never_run_meta_ads'})).success).toBe(true);
    const initial = await getOnboardingInitial();
    expect(initial.success && initial.data.businessData.monthlyBudget).toBe('500_1000');
  },30000);
  it('consumes OAuth state atomically and rejects replay or a foreign user', async () => {
    const platform=await admin.from('platforms').select('id').eq('key','meta').single();
    if(platform.error)throw platform.error;
    const state=await createOAuthState(clients[0],{userId:users[0].id,businessId:users[0].businessId!,platformId:platform.data.id});
    expect(await consumeOAuthState(admin,{state,userId:users[1].id,platformId:platform.data.id})).toBeNull();
    const results=await Promise.all(Array.from({length:3},()=>consumeOAuthState(admin,{state,userId:users[0].id,platformId:platform.data.id})));
    expect(results.filter(Boolean)).toHaveLength(1);
  },30000);
  it('normal clients cannot select foreign integrations, creatives, facts or change credentials', async () => {
    for (const table of ['ad_accounts','ad_entities','ad_creatives','platform_integrations'] as const) {
      const result=await clients[0].from(table).select('id').eq('business_id',users[1].businessId!);
      expect(result.error).toBeNull();expect(result.data).toEqual([]);
    }
    const integration = await admin.from('platform_integrations').select('id').eq('business_id',users[0].businessId!).single();
    expect((await clients[0].from('platform_integrations').update({access_token_secret_id:'fake'}).eq('id',integration.data!.id)).error).toBeTruthy();
    expect((await clients[0].rpc('claim_account_sync_job',{})).error).toBeTruthy();
    expect((await clients[0].rpc('get_platform_token',{secret_id:'00000000-0000-0000-0000-000000000000'})).error).toBeTruthy();
  },30000);
  it('concurrent duplicate refresh requests reuse one durable job', async () => {
    const integration=await admin.from('platform_integrations').select('id').eq('business_id',users[0].businessId!).single();
    const account=await admin.from('ad_accounts').select('id').eq('business_id',users[0].businessId!).like('external_account_id','%_1').single();
    if(integration.error)throw integration.error;if(account.error)throw account.error;
    const jobs=await Promise.all(Array.from({length:5},()=>createOrReuseQueuedSyncJob(admin,{businessId:users[0].businessId!,platformIntegrationId:integration.data.id,adAccountId:account.data.id,syncType:'manual_refresh',requestedStartDate:'2026-10-01',requestedEndDate:'2026-10-20'})));
    expect(new Set(jobs.map(j=>j.id)).size).toBe(1);
    // The following sync test consumes this same queued job through the actual worker.
  },30000);
  it('repeated real queued sync preserves IDs and totals, then applies an attribution correction', async () => {
    asUser(0);
    const integrationRes = await admin.from('platform_integrations').select('*').eq('business_id',users[0].businessId!).single();
    if(integrationRes.error) throw integrationRes.error;
    const integration=integrationRes.data;
    const simulation = {businessId:users[0].businessId!,scenario:'multiple' as const,revision:0};
    const externalId=simulationAccounts(simulation)[0].externalAccountId;
    const account=await admin.from('ad_accounts').select('id').eq('business_id',users[0].businessId!).eq('external_account_id',externalId).single();
    if(account.error)throw account.error;
    const accountId=account.data.id;
    const before=await admin.from('ad_entities').select('id').eq('ad_account_id',accountId).order('id');
    for (const revision of [0,0,1]) {
      const details={...(integration.integration_details as object),[SIMULATION_TAG]:{...simulation,revision}};
      const changed=await admin.from('platform_integrations').update({integration_details:details}).eq('id',integration.id);
      if(changed.error)throw changed.error;
      await syncSelectedMetaAdAccount({supabase:admin,businessId:users[0].businessId!,integrationId:integration.id,platformId:integration.platform_id,externalAccountId:externalId,name:'[SIMULATED] Salon account 1',trigger:'manual_refresh',backfillDays:30});
      const job=await admin.from('account_sync_jobs').select('id').eq('ad_account_id',accountId).eq('status','queued').single();
      if(job.error)throw job.error;
      const result=await processMetaBackfillJobs({targetJobId:job.data.id});
      expect(result.failedCount,JSON.stringify(result.results)).toBe(0);
      expect(result.completedCount).toBe(1);
      expect((await processMetaBackfillJobs({targetJobId:job.data.id})).processedCount).toBe(0);
      const rows=await admin.from('ad_entity_performance_daily').select('spend,leads').eq('ad_account_id',accountId).eq('entity_level','adset').gte('day','2026-10-13').lte('day','2026-10-19');
      expect(rows.error).toBeNull();
      expect(rows.data?.reduce((s,r)=>s+Number(r.spend),0)).toBe(280+revision*4);
      expect(rows.data?.reduce((s,r)=>s+Number(r.leads),0)).toBe(28+revision);
      expect((await admin.from('ad_entities').select('id').eq('ad_account_id',accountId).order('id')).data).toEqual(before.data);
    }
    const entities=await loadOverviewEntities(users[0].businessId!,accountId);
    expect(entities).toHaveLength(2);
    const daily=await loadOverviewDaily(users[0].businessId!,accountId,'2026-10-20');
    expect(daily.filter(r=>r.day>='2026-10-13'&&r.day<='2026-10-19').reduce((s,r)=>s+Number(r.spend),0)).toBe(284);
    expect(await loadOverviewDaily(users[1].businessId!,accountId,'2026-10-20')).toEqual([]);
  },180000);
  it('persists provider failures and recovers with a new job; stale claims are reclaimable', async () => {
    const found=await admin.from('platform_integrations').select('*').eq('business_id',users[0].businessId!).single();
    if(found.error)throw found.error;
    const integration=found.data;
    const account=await admin.from('ad_accounts').select('id,external_account_id').eq('business_id',users[0].businessId!).like('external_account_id','%_1').single();
    if(account.error)throw account.error;
    for(const scenario of ['expired','rate_limit','timeout','partial','multiple'] as const) {
      const changed=await admin.from('platform_integrations').update({status:'connected',integration_details:{...(integration.integration_details as object),[SIMULATION_TAG]:{businessId:users[0].businessId!,scenario,revision:1}}}).eq('id',integration.id);
      if(changed.error)throw changed.error;
      await syncSelectedMetaAdAccount({supabase:admin,businessId:users[0].businessId!,integrationId:integration.id,platformId:integration.platform_id,externalAccountId:account.data.external_account_id,name:'[SIMULATED] Salon account 1',trigger:'manual_refresh'});
      const job=await admin.from('account_sync_jobs').select('id').eq('ad_account_id',account.data.id).eq('status','queued').single();
      if(job.error)throw job.error;
      if(scenario==='multiple') {
        const stale=await admin.from('account_sync_jobs').update({status:'running',updated_at:new Date(Date.now()-20*60000).toISOString()}).eq('id',job.data.id);
        if(stale.error)throw stale.error;
      }
      const result=await processMetaBackfillJobs({targetJobId:job.data.id});
      expect(result.processedCount).toBe(1);
      expect(result.failedCount,JSON.stringify(result.results)).toBe(scenario==='multiple'?0:1);
      const persisted=await admin.from('account_sync_jobs').select('status,error_message,metadata').eq('id',job.data.id).single();
      expect(persisted.data?.status).toBe(scenario==='multiple'?'completed':'failed');
      if(scenario!=='multiple')expect(persisted.data?.error_message).toBeTruthy();
    }
  },180000);

});
