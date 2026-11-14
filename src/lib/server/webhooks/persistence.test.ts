import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, beforeEach, afterAll, afterEach, expect, it } from 'vitest';
const business='00000000-0000-4000-8000-000000000001',account='00000000-0000-4000-8000-000000000002',integration='00000000-0000-4000-8000-000000000003',platform='00000000-0000-4000-8000-000000000004',entity='00000000-0000-4000-8000-000000000005';
let db:PGlite;
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
 await db.exec(`create table ad_lifecycle_events(id uuid primary key default gen_random_uuid(),ad_account_id uuid);create table insight_issues(id uuid primary key default gen_random_uuid(),ad_account_id uuid,revision integer default 1,resolved_at timestamptz);`);
 await db.exec(readFileSync('supabase/migrations/20261114002047_meta_webhook_events.sql','utf8'));
},30000);
beforeEach(()=>db.exec('begin'));afterEach(()=>db.exec('rollback;reset role'));afterAll(()=>db?.close());
const q=(objects?:Array<{id:string;level:string}>)=>({version:2,since:'2026-10-30',until:'2026-10-30',source:'webhook',...(objects?{objects}:{})});
async function request(query:unknown,kind='events'){return (await db.query<{r:Record<string,unknown>}>(`select request_account_resource($1,$2,$3,$4,$5) r`,[business,integration,account,kind,JSON.stringify(query)])).rows[0].r;}
async function claim(id:string){return (await db.query<{id:string;lease_generation:number}>(`select * from claim_account_resource($1)`,[id])).rows[0];}
const objects=async(id:string)=>(await db.query<{o:unknown}>(`select metadata#>'{query,objects}' o from account_sync_jobs where id=$1`,[id])).rows[0].o;
it('turns a burst of webhook demand into one queued job that carries every affected object',async()=>{
 const results=[];for(let n=0;n<50;n++)results.push(await request(q([{id:String(n%3),level:'ad'}])));
 expect(new Set(results.map(r=>r.jobId)).size).toBe(1);
 expect((await db.query('select count(*)::int n from account_sync_jobs')).rows).toEqual([{n:1}]);
 expect((await objects(results[0].jobId as string) as unknown[]).length).toBe(3);
});
it('widens to a full hierarchy read when the scope is unknown or too large',async()=>{
 const first=await request(q([{id:'1',level:'ad'}]));await request(q());
 expect(await objects(first.jobId as string)).toBeNull();
 expect((await db.query<{m:unknown}>(`select merge_event_objects($1,$2) m`,[JSON.stringify(Array.from({length:30},(_,n)=>({id:`a${n}`}))),JSON.stringify(Array.from({length:30},(_,n)=>({id:`b${n}`})))])).rows[0].m).toBeNull();
});
it('never treats an event as fresh, and keeps demand behind a running read',async()=>{
 const first=await request(q([{id:'1',level:'ad'}]));const lease=await claim(first.jobId as string);
 expect(await request(q([{id:'2',level:'ad'}]))).toMatchObject({reason:'pending_followup'});
 expect(await request(q([{id:'3',level:'ad'}]))).toMatchObject({reason:'pending_followup'});
 await db.query('select complete_account_events($1,$2)',[first.jobId,lease.lease_generation]);
 expect((await db.query(`select status,performance_rows_synced n from account_sync_jobs where id=$1`,[first.jobId])).rows).toEqual([{status:'completed',n:0}]);
 const next=(await db.query<{r:Record<string,unknown>}>(`select promote_account_resource('${account}') r`)).rows[0].r;
 expect(next.status).toBe('queued');expect(next.jobId).not.toBe(first.jobId);
 expect((await objects(next.jobId as string) as Array<{id:string}>).map(o=>o.id).sort()).toEqual(['2','3']);
 const lease2=await claim(next.jobId as string);await db.query('select complete_account_events($1,$2)',[next.jobId,lease2.lease_generation]);
 // Completed moments ago, yet a new event still queues a read.
 expect(await request(q([{id:'4',level:'ad'}]))).toMatchObject({status:'queued',reason:'enqueued'});
});
it('waits behind other work for the same account and leaves performance facts untouched',async()=>{
 await db.exec(`insert into ad_entity_performance_daily(entity_id,ad_account_id,entity_level,day,spend) values('${entity}','${account}','adset','2026-10-01',9)`);
 const performance=await request({version:2,since:'2026-10-29',until:'2026-10-30',source:'app_visit'},'performance');
 expect(performance).toMatchObject({status:'queued'});
 expect(await request(q([{id:'1',level:'campaign'}]))).toMatchObject({reason:'pending_followup'});
 expect((await db.query('select count(*)::int n from account_sync_jobs')).rows).toEqual([{n:1}]);
 expect((await db.query('select sum(spend)::int total from ad_entity_performance_daily')).rows).toEqual([{total:9}]);
});
it('fences a completion from an expired worker',async()=>{
 const first=await request(q());const lease=await claim(first.jobId as string);
 await db.exec(`update account_sync_jobs set lease_expires_at=now()-interval '1 minute'`);
 await db.exec('savepoint stale');await expect(db.query('select complete_account_events($1,$2)',[first.jobId,lease.lease_generation])).rejects.toThrow('Expired resource lease');await db.exec('rollback to stale');
});
it('defers a noisy account after twenty event reads in an hour without dropping the demand',async()=>{
 await db.exec(`insert into account_sync_jobs(business_id,platform_integration_id,ad_account_id,sync_type,status,metadata) select '${business}','${integration}','${account}','resource_refresh','completed','{"resourceKey":"events:v2"}' from generate_series(1,20)`);
 expect(await request(q([{id:'1',level:'ad'}]))).toMatchObject({status:'skipped',reason:'event_budget'});
 expect((await db.query(`select pending,not_before>now() later,query ? 'objects' scoped from account_sync_resources where resource_key='events:v2'`)).rows).toEqual([{pending:true,later:true,scoped:false}]);
});
it('records a delivery once, validates it and rejects browser roles',async()=>{
 const key='a'.repeat(64),record=(k=key,acct='123')=>db.query<{id:string|null}>(`select record_meta_webhook_event($1,$2,'effective_status','555','ad','{}',now()) id`,[k,acct]);
 expect((await record()).rows[0].id).toBeTruthy();
 expect((await record()).rows[0].id).toBeNull();
 await db.exec('savepoint bad');await expect(record('b'.repeat(64),'act_123')).rejects.toThrow('Invalid webhook event');await db.exec('rollback to bad');
 await db.exec('set role authenticated');
 await db.exec('savepoint denied');await expect(db.query('select * from meta_webhook_events')).rejects.toThrow(/permission denied/);await db.exec('rollback to denied');
 await db.exec('savepoint denied2');await expect(record('c'.repeat(64))).rejects.toThrow(/permission denied/);await db.exec('rollback to denied2');
});
it('signals lifecycle and issue changes without failing when Realtime is absent',async()=>{
 await db.exec(`insert into ad_lifecycle_events(ad_account_id) values('${account}');insert into insight_issues(ad_account_id) values('${account}');update insight_issues set revision=2;`);
 expect((await db.query('select count(*)::int n from insight_issues')).rows).toEqual([{n:1}]);
});
