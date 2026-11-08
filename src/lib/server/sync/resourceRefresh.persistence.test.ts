import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, beforeEach, afterAll, afterEach, expect, it } from 'vitest';
const business='00000000-0000-4000-8000-000000000001',account='00000000-0000-4000-8000-000000000002',integration='00000000-0000-4000-8000-000000000003',platform='00000000-0000-4000-8000-000000000004',entity='00000000-0000-4000-8000-000000000005';
let db:PGlite;
const query={version:2,since:'2026-10-29',until:'2026-10-30',source:'app_visit'};
async function request(q=query,kind='performance',b=business){return (await db.query<{r:Record<string,unknown>}>(`select request_account_resource($1,$2,$3,$4,$5) r`,[b,integration,account,kind,JSON.stringify(q)])).rows[0].r;}
async function claim(id:string){return (await db.query<{id:string;lease_generation:number}>(`select * from claim_account_resource($1)`,[id])).rows[0];}
const row={entity_id:entity,entity_level:'adset',day:'2026-10-30',spend:20,impressions:1000,reach:null,clicks:30,inline_link_clicks:20,leads:2,messages:0,calls:0,currency_code:'USD'};
async function stage(id:string,generation=1,rows:unknown[]=[row]){await db.query(`select stage_account_resource($1,$2,0,$3)`,[id,generation,JSON.stringify(rows)]);}
async function publish(id:string,generation=1){return db.query(`select publish_account_resource($1,$2,1)`,[id,generation]);}
beforeAll(async()=>{
 db=new PGlite(); await db.exec(`create role anon;create role authenticated;create role service_role;
 create table platforms(id uuid primary key,key text);create table business_profiles(id uuid primary key);
 create table ad_accounts(id uuid primary key,business_id uuid,platform_id uuid,external_account_id text,timezone text);
 create table platform_integrations(id uuid primary key,business_id uuid,platform_id uuid,status text,disconnected_at timestamptz,connected_at timestamptz,integration_details jsonb,access_token_secret_id uuid,token_expires_at timestamptz);
 create table business_data_policies(business_id uuid,daily_history_days integer,audience_history_days integer,allowed_breakdowns text[]);
 create table account_sync_jobs(id uuid primary key default gen_random_uuid(),business_id uuid,platform_integration_id uuid,ad_account_id uuid,sync_type text constraint account_sync_jobs_sync_type_check check(sync_type in ('incremental','manual_refresh')),status text,requested_start_date date,requested_end_date date,actual_start_date date,actual_end_date date,metadata jsonb default '{}',created_at timestamptz default now(),updated_at timestamptz default now(),started_at timestamptz,finished_at timestamptz,error_message text,performance_rows_synced integer);
 create function public.claim_account_sync_job(target_job_id uuid default null,allowed_sync_types text[] default null) returns setof public.account_sync_jobs language sql as $$
 update public.account_sync_jobs set status='running',metadata=metadata||jsonb_build_object('claimed_at',now()) where id=target_job_id and status='queued' returning * $$;
 create unique index one_active on account_sync_jobs(ad_account_id) where status in ('queued','running');
 create table ad_account_sync_state(ad_account_id uuid primary key,first_full_sync_completed boolean);
 create table ad_entities(id uuid primary key,business_id uuid,ad_account_id uuid,entity_level text);
 create table ad_entity_performance_daily(entity_id uuid,ad_account_id uuid,entity_level text,day date,spend numeric,impressions bigint,reach bigint,clicks bigint,inline_link_clicks bigint,leads bigint,messages bigint,calls bigint,currency_code text,objective text,status text,source text,updated_at timestamptz,primary key(entity_id,day));
 create table ad_audience_breakdowns_summary(ad_account_id uuid,entity_level text,breakdown_type text,first_day date,last_day date,entity_id uuid,dimension_1_value text,dimension_2_value text);
 create table ad_entity_performance_summary(ad_account_id uuid);create table ad_entity_performance_hourly(ad_account_id uuid);create table ad_creatives(ad_account_id uuid);
 create function can_access_ad_account(uuid) returns boolean language sql as $$select false$$;
 insert into business_profiles values('${business}');insert into platforms values('${platform}','meta');
 insert into ad_accounts values('${account}','${business}','${platform}','act_test','America/New_York');
 insert into platform_integrations values('${integration}','${business}','${platform}','connected',null,now()-interval '1 day','{"primary_ad_account_external_id":"act_test","manual_sync_rate_limit":{"load":2}}',gen_random_uuid(),now()+interval '1 day');
 insert into ad_account_sync_state values('${account}',true);insert into ad_entities values('${entity}','${business}','${account}','adset');`);
 await db.exec(readFileSync('supabase/migrations/20261107032518_resource_aware_meta_refresh.sql','utf8'));
 await db.exec(readFileSync('supabase/migrations/20261107221150_resource_refresh_recovery.sql','utf8'));
 await db.exec(readFileSync('supabase/migrations/20261107221814_sync_worker_fencing.sql','utf8'));
 await db.exec(readFileSync('supabase/migrations/20261108044833_sync_resource_completion_guards.sql','utf8'));
 await db.exec(readFileSync('supabase/migrations/20261108044834_persisted_dashboard_insights.sql','utf8'));
 await db.exec(readFileSync('supabase/migrations/20261108045250_resource_quota_deferral.sql','utf8'));
},30000);
beforeEach(()=>db.exec('begin'));afterEach(()=>db.exec('rollback;reset role'));afterAll(()=>db?.close());
it('coalesces 20 simultaneous demands into one job without consuming manual cooldown',async()=>{
 const results=await Promise.all(Array.from({length:20},()=>request()));
 expect(new Set(results.map(r=>r.jobId)).size).toBe(1);
 expect((await db.query('select count(*)::int n from account_sync_jobs')).rows).toEqual([{n:1}]);
 expect((await db.query(`select integration_details->'manual_sync_rate_limit' value from platform_integrations`)).rows).toEqual([{value:{load:2}}]);
});
it('preserves incompatible demand behind a running job',async()=>{
 const first=await request();await claim(first.jobId as string);
 expect(await request({...query,since:'2026-10-24'})).toMatchObject({reason:'pending_followup'});
 await stage(first.jobId as string);await publish(first.jobId as string);
 const next=(await db.query<{r:Record<string,unknown>}>(`select promote_account_resource('${account}') r`)).rows[0].r;
 expect(next.status).toBe('queued');expect(next.jobId).not.toBe(first.jobId);
});
it('atomically replaces the queried window, preserves history and fences expired workers',async()=>{
 await db.exec(`insert into ad_entity_performance_daily(entity_id,ad_account_id,entity_level,day,spend) values('${entity}','${account}','adset','2026-10-01',9)`);
 const first=await request();const id=first.jobId as string;await claim(id);await stage(id);
 expect((await db.query('select count(*)::int n from ad_entity_performance_daily')).rows[0]).toEqual({n:1});
 await db.exec(`update account_sync_jobs set lease_expires_at=now()-interval '1 minute'`);expect((await claim(id)).lease_generation).toBe(2);
 await db.exec('savepoint stale');await expect(publish(id)).rejects.toThrow('Expired resource lease');await db.exec('rollback to stale');
 await stage(id,2);await publish(id,2);
 expect((await db.query('select sum(spend)::int total from ad_entity_performance_daily')).rows).toEqual([{total:29}]);
 expect(await request()).toMatchObject({reason:'fresh',revision:1});
});
it('rejects forged business scope and entity ownership without publishing data',async()=>{
 await db.exec('savepoint scope');await expect(request(query,'performance',platform)).rejects.toMatchObject({code:'42501'});await db.exec('rollback to scope');
 const id=(await request()).jobId as string;await claim(id);await stage(id,1,[{...row,entity_id:platform}]);
 await db.exec('savepoint entity');await expect(publish(id)).rejects.toMatchObject({code:'42501'});await db.exec('rollback to entity');
 expect((await db.query('select count(*)::int n from ad_entity_performance_daily')).rows).toEqual([{n:0}]);
});
it('does not publish an incomplete chunk set',async()=>{
 const id=(await request()).jobId as string;await claim(id);
 await expect(publish(id)).rejects.toThrow('Incomplete staged resource');
});
it('publishes separate immutable audience batches and never overwrites a different window',async()=>{
 const q={...query,breakdown:'age_gender'};
 for(const since of ['2026-10-29','2026-10-24']){
  const id=(await request({...q,since},'audience')).jobId as string;await claim(id);await stage(id);await publish(id);
 }
 expect((await db.query('select count(*)::int n from audience_snapshot_batches')).rows).toEqual([{n:2}]);
});
it('backs off errors and stops retrying inaccessible accounts',async()=>{
 const id=(await request()).jobId as string;await claim(id);
 await db.query(`select fail_account_resource($1,1,'reauthentication_required',60)`,[id]);
 expect(await request()).toMatchObject({reason:'retry_limit'});
});
it('shares quota and provider cooldown between processes',async()=>{
 const leases=await Promise.all(Array.from({length:4},()=>db.query<{id:string|null}>(`select admit_meta_read('${account}') id`)));
 expect(leases.filter(r=>r.rows[0].id)).toHaveLength(3);
 await db.query(`select finish_meta_read($1,$2,85,null,0)`,[leases[0].rows[0].id,account]);
 expect((await db.query(`select admit_meta_read('${account}') id`)).rows).toEqual([{id:null}]);
});
it.each(['anon','authenticated'])('denies internal resource RPCs and staging access to %s',async role=>{
 await db.exec(`set local role ${role}`);await expect(request()).rejects.toMatchObject({code:'42501'});
});

it('preserves a full manual request behind a narrow automatic job',async()=>{
 const id=(await request()).jobId as string;await claim(id);
 await db.query(`select request_resource_followup($1,$2,$3,$4,$5,$6)`,[id,business,integration,account,'2026-10-01','2026-10-30']);
 await stage(id);await publish(id);
 const jobs=(await db.query<{id:string;sync_type:string;status:string;metadata:Record<string,string>}>(`select * from account_sync_jobs order by created_at,id`)).rows;
 const original=jobs.find(j=>j.id===id)!,manual=jobs.find(j=>j.id!==id)!;
 expect(manual).toMatchObject({sync_type:'manual_refresh',status:'queued'});expect(original.metadata.followupJobId).toBe(manual.id);
});
it('stops crashed worker retries after three claims',async()=>{
 const id=(await request()).jobId as string;await claim(id);
 await db.exec(`update account_sync_jobs set lease_generation=3,lease_expires_at=now()-interval '1 second'`);
 expect(await claim(id)).toBeUndefined();expect(await request()).toMatchObject({reason:'retry_limit'});
});
it('recovers the circuit only after a new connection',async()=>{
 const id=(await request()).jobId as string;await claim(id);
 await db.query(`select fail_account_resource($1,1,'reauthentication_required',60)`,[id]);
 await db.exec(`update platform_integrations set connected_at=now()+interval '1 second'`);
 expect(await request()).toMatchObject({status:'queued'});
});
it('queues maintenance through the existing incremental worker',async()=>{
 const id=(await request(query,'maintenance')).jobId as string;
 expect((await db.query(`select sync_type,metadata->>'queuedFrom' source from account_sync_jobs where id=$1`,[id])).rows[0]).toEqual({sync_type:'incremental',source:'resource_maintenance'});
});
it('enforces audience policy limits before queueing',async()=>{
 await db.query(`insert into business_data_policies values($1,30,14,array['country'])`,[business]);
 expect(await request({...query,breakdown:'age_gender'} as typeof query,'audience')).toMatchObject({reason:'policy_limit'});
});

it('fences legacy database writes after a worker is reclaimed',async()=>{
 const id=(await request(query,'maintenance')).jobId as string;
 await db.query(`update account_sync_jobs set status='running',metadata=metadata||'{"claimed_at":"first"}' where id=$1`,[id]);
 await db.query(`select set_config('request.headers',$1,true)`,[JSON.stringify({'x-deepvisor-sync-job':id,'x-deepvisor-sync-generation':'1'})]);
 await db.exec(`update ad_entities set entity_level='adset' where id='${entity}'`);
 await db.exec(`select set_config('request.headers','{}',true)`);
 await db.query(`update account_sync_jobs set metadata=metadata||'{"claimed_at":"second"}' where id=$1`,[id]);
 await db.query(`select set_config('request.headers',$1,true)`,[JSON.stringify({'x-deepvisor-sync-job':id,'x-deepvisor-sync-generation':'1'})]);
 await expect(db.exec(`update ad_entities set entity_level='adset' where id='${entity}'`)).rejects.toMatchObject({code:'40001'});
});

it('rejects null publication leases instead of treating a missing payload as empty',async()=>{
 const id=(await request()).jobId as string;await claim(id);
 await expect(db.query('select publish_account_resource($1,null,null)',[id])).rejects.toMatchObject({code:'40001'});
});
it('a full success satisfies covered pending demands without redundant work',async()=>{
 const id=(await request(query,'maintenance')).jobId as string;
 expect(await request()).toMatchObject({reason:'pending_followup'});
 await db.query(`update account_sync_jobs set status='completed',finished_at=now() where id=$1`,[id]);
 expect((await db.query(`select count(*)::int n from account_sync_resources where pending`)).rows).toEqual([{n:0}]);
 expect(await request()).toMatchObject({reason:'fresh'});
});

it('the shared selector prioritizes manual work without starving aged background jobs',async()=>{
 await request();
 await db.query(`insert into account_sync_jobs(business_id,platform_integration_id,ad_account_id,sync_type,status) values($1,$2,$3,'manual_refresh','queued')`,[business,integration,platform]);
 expect((await db.query<{sync_type:string}>('select * from claim_next_account_sync()')).rows[0].sync_type).toBe('manual_refresh');
});
it('caps merged old pending demand to a bounded window',async()=>{
 const first=await request();await claim(first.jobId as string);
 await db.exec(`update account_sync_resources set pending=true,query=query||'{"since":"2020-01-01"}'`);
 await request({...query,since:'2026-10-24'});
 expect((await db.query<{days:number}>(`select (query->>'until')::date-(query->>'since')::date days from account_sync_resources`)).rows[0].days).toBe(30);
});

it('publishes optional insights only from the current worker lease and scopes authenticated reads',async()=>{
 const id=(await request()).jobId as string;await claim(id);
 await db.query(`select publish_account_insights($1,1,'daily',$2,'2026-10-29','2026-10-30')`,[id,JSON.stringify([{day:'2026-10-30',spend:20}])]);
 expect((await db.query(`select business_id,ad_account_id from account_insight_snapshots`)).rows).toEqual([{business_id:business,ad_account_id:account}]);
 await db.exec('savepoint staleinsights');
 await expect(db.query(`select publish_account_insights($1,2,'daily','[]','2026-10-29','2026-10-30')`,[id])).rejects.toThrow('Expired resource lease');
 await db.exec('rollback to staleinsights');
 await db.exec('set local role authenticated');
 expect((await db.query('select * from account_insight_snapshots')).rows).toHaveLength(0);
 await expect(db.query(`select publish_account_insights($1,1,'daily','[]','2026-10-29','2026-10-30')`,[id])).rejects.toMatchObject({code:'42501'});
});

it('defers shared quota contention without permanently blocking a healthy account',async()=>{
 for(let i=0;i<4;i++){
  const id=(await request()).jobId as string;await claim(id);
  await db.query(`select fail_account_resource($1,1,'provider_cooldown',300)`,[id]);
  expect((await db.query(`select failures,pending,availability from account_sync_resources`)).rows).toEqual([{failures:0,pending:true,availability:'error'}]);
  expect(await request()).toMatchObject({reason:'failure_backoff'});
  await db.exec(`update account_sync_resources set not_before=now()`);
 }
});
