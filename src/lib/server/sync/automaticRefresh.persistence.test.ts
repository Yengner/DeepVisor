import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, beforeEach, afterEach, afterAll, expect, it } from 'vitest';
const a='00000000-0000-4000-8000-000000000001',i='00000000-0000-4000-8000-000000000002',b='00000000-0000-4000-8000-000000000003',p='00000000-0000-4000-8000-000000000004',success='00000000-0000-4000-8000-000000000005';
let db:PGlite;
const run=(source='scheduled_refresh')=>db.query<{r:Record<string,unknown>}>(`select public.enqueue_automatic_account_sync('${b}','${i}','${a}',$1) r`,[source]).then(x=>x.rows[0].r);
beforeAll(async()=>{
 db=new PGlite();await db.exec(`
 create role anon;create role authenticated;create role service_role;
 create table public.platforms(id uuid primary key,key text);
 create table public.ad_accounts(id uuid primary key,business_id uuid,platform_id uuid,external_account_id text,timezone text);
 create table public.platform_integrations(id uuid primary key,business_id uuid,platform_id uuid,status text,disconnected_at timestamptz,connected_at timestamptz,integration_details jsonb,access_token_secret_id uuid,token_expires_at timestamptz);
 create table public.account_sync_jobs(id uuid primary key default gen_random_uuid(),business_id uuid,platform_integration_id uuid,ad_account_id uuid,sync_type text,status text,requested_start_date date,requested_end_date date,metadata jsonb default '{}',created_at timestamptz default now(),updated_at timestamptz default now(),finished_at timestamptz,error_message text);
 create unique index account_sync_jobs_one_active_type on public.account_sync_jobs(ad_account_id,sync_type) where status in ('queued','running');
 create table public.ad_account_sync_state(id uuid primary key default gen_random_uuid(),ad_account_id uuid unique,first_full_sync_completed boolean,last_successful_sync_job_id uuid);
 create function public.claim_account_sync_job(target_job_id uuid default null,allowed_sync_types text[] default null) returns setof public.account_sync_jobs language plpgsql as $$
 declare dummy integer;
 begin
  select 1 into dummy;
  return query select * from public.account_sync_jobs where status='queued' or (status='running' and updated_at<now()-interval '15 minutes');
 end $$;
 insert into public.platforms values('${p}','meta');
 insert into public.ad_accounts values('${a}','${b}','${p}','act_123','America/New_York');
 insert into public.platform_integrations values('${i}','${b}','${p}','connected',null,now()-interval '10 days','{"primary_ad_account_external_id":"act_123","manual_sync_rate_limit":{"load":2}}',gen_random_uuid(),now()+interval '1 day');
 insert into public.account_sync_jobs(id,business_id,platform_integration_id,ad_account_id,sync_type,status,created_at,finished_at) values('${success}','${b}','${i}','${a}','incremental','completed',now()-interval '4 hours',now()-interval '2 hours');
 insert into public.ad_account_sync_state(ad_account_id,first_full_sync_completed,last_successful_sync_job_id) values('${a}',true,'${success}');
 `);
 await db.exec(readFileSync('supabase/migrations/20261027022659_automatic_meta_refresh.sql','utf8'));
},20000);
beforeEach(()=>db.exec('begin'));
afterEach(()=>db.exec('rollback;reset role'));
afterAll(()=>db?.close());
it('queues at the two-hour boundary with 90-minute freshness and a bounded local attribution window',async()=>{
 expect(await run()).toMatchObject({status:'queued',reason:'enqueued'});
 expect((await db.query(`select requested_start_date=(now() at time zone 'America/New_York')::date-6 as bounded,requested_end_date=(now() at time zone 'America/New_York')::date as local from public.account_sync_jobs where status='queued'`)).rows).toEqual([{bounded:true,local:true}]);
 expect((await db.query(`select integration_details->'manual_sync_rate_limit' as cooldown from public.platform_integrations`)).rows[0]).toEqual({cooldown:{load:2}});
});
it('a recent scheduled success prevents another login refresh and the check persists for the local day',async()=>{
 await db.exec(`update public.account_sync_jobs set finished_at=now()-interval '89 minutes'`);
 expect(await run('app_visit')).toMatchObject({status:'skipped',reason:'fresh'});
 await db.exec(`update public.account_sync_jobs set finished_at=now()-interval '3 hours'`);
 expect(await run('app_visit')).toMatchObject({reason:'checked_today'});
 await db.exec(`update public.ad_account_sync_state set last_visit_sync_check_day=(now() at time zone 'America/New_York')::date-1`);
 expect(await run('app_visit')).toMatchObject({status:'queued'});
});
it('shares active work across manual, login and schedule; unique index rejects a second type',async()=>{
 const first=await run('app_visit');expect(await run()).toMatchObject({jobId:first.jobId,reason:'existing_job'});
 await expect(db.exec(`insert into public.account_sync_jobs(ad_account_id,sync_type,status) values('${a}','manual_refresh','queued')`)).rejects.toMatchObject({code:'23505'});
});
it.each(['disconnected','needs_reauth'])('does not retry %s integrations',async status=>{
 await db.query('update public.platform_integrations set status=$1',[status]);expect(await run()).toMatchObject({status:'skipped'});
});
it('skips expired tokens, incomplete first syncs and shared synthetic accounts',async()=>{
 await db.exec(`update public.platform_integrations set token_expires_at=now()-interval '1 minute'`);expect(await run()).toMatchObject({reason:'reauthentication_required'});
 await db.exec(`update public.platform_integrations set token_expires_at=null;update public.ad_account_sync_state set first_full_sync_completed=false`);expect(await run()).toMatchObject({reason:'initial_sync_required'});
 await db.exec(`update public.ad_account_sync_state set first_full_sync_completed=true;update public.platform_integrations set integration_details=integration_details||'{"deepvisor-meta-phase2":{}}'`);expect(await run()).toMatchObject({reason:'simulation_disabled'});
});
it('backs off failures and opens the circuit after three failures until successful recovery',async()=>{
 await db.exec(`insert into public.account_sync_jobs(ad_account_id,status,metadata,created_at,finished_at) values('${a}','partial','{"queuedFrom":"scheduled_refresh"}',now()-interval '1 hour',now()-interval '1 minute')`);
 expect(await run()).toMatchObject({reason:'failure_backoff'});
 await db.exec(`insert into public.account_sync_jobs(ad_account_id,status,metadata,created_at,finished_at) select '${a}','failed','{"queuedFrom":"app_visit"}'::jsonb,now()-interval '1 hour',now()-interval '1 hour' from generate_series(1,2)`);
 expect(await run()).toMatchObject({reason:'retry_limit'});
 await db.exec(`update public.account_sync_jobs set finished_at=now() where id='${success}'`);expect(await run()).toMatchObject({reason:'fresh'});
});
it('expires crashed read jobs after three claims',async()=>{
 await db.exec(`insert into public.account_sync_jobs(ad_account_id,status,sync_type,metadata,updated_at) values('${a}','running','incremental','{"attempt":3}',now()-interval '16 minutes')`);
 expect((await db.query('select * from public.claim_account_sync_job()')).rows).toHaveLength(0);
 expect((await db.query(`select status from public.account_sync_jobs where metadata->>'attempt'='3'`)).rows[0]).toEqual({status:'failed'});
});
it.each(['anon','authenticated'])('denies automatic enqueue to %s',async role=>{
 await db.exec(`set local role ${role}`);await expect(run()).rejects.toMatchObject({code:'42501'});
});
it('rejects mismatched business scope',async()=>{
 await expect(db.query(`select public.enqueue_automatic_account_sync('${p}','${i}','${a}','app_visit')`)).rejects.toMatchObject({code:'42501'});
});
