import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const business = '00000000-0000-0000-0000-000000000001';
const other = '00000000-0000-0000-0000-000000000002';
const entity = '00000000-0000-0000-0000-000000000003';
const campaign = '00000000-0000-0000-0000-000000000004';
let db: PGlite;
const enqueue = (version = 'v1', b = business) => db.query<{ count: number }>('select ai.enqueue_meta_shadow($1,$2,$2,$2,$3) as count', [b,business,version]);
const claim = async () => (await db.query<{ job: { id: string; feature_snapshot_id: string; decision_run_id: string } | null }>('select ai.claim_meta_shadow() as job')).rows[0].job;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    set timezone = 'UTC';
    create schema ai; create role anon; create role authenticated; create role service_role bypassrls;
    create table public.business_profiles(id uuid primary key, organization_id uuid);
    create table public.platforms(id uuid primary key, key text);
    create table public.platform_integrations(id uuid primary key, business_id uuid, platform_id uuid);
    create table public.ad_accounts(id uuid primary key, business_id uuid, platform_id uuid, timezone text, currency_code text);
    create table public.account_sync_jobs(id uuid primary key,business_id uuid,platform_integration_id uuid,ad_account_id uuid,status text,finished_at timestamptz);
    create table public.ad_account_sync_state(ad_account_id uuid,insights_synced_through date);
    create table public.ad_entities(id uuid primary key,business_id uuid,ad_account_id uuid,entity_level text,external_id text,campaign_id uuid,status text,raw jsonb);
    create table public.ad_entity_performance_daily(entity_id uuid,ad_account_id uuid,entity_level text,day date,spend numeric,reach numeric,impressions numeric,clicks numeric,inline_link_clicks numeric,leads numeric,messages numeric,calls numeric,updated_at timestamptz);
    create function public.is_org_member(org uuid) returns boolean language sql stable as $$ select org::text = current_setting('test.organization',true) $$;
    grant select on all tables in schema public to authenticated, service_role;
    insert into public.business_profiles values('${business}','${business}'),('${other}','${other}');
    insert into public.platforms values('${business}','meta');
    insert into public.platform_integrations values('${business}','${business}','${business}');
    insert into public.ad_accounts values('${business}','${business}','${business}','UTC','USD');
    insert into public.account_sync_jobs values('${business}','${business}','${business}','${business}','completed',now());
    insert into public.ad_account_sync_state values('${business}',current_date);
    insert into public.ad_entities values('${campaign}','${business}','${business}','campaign','789',null,'ACTIVE','{"daily_budget":"0"}'),
      ('${entity}','${business}','${business}','adset','123','${campaign}','ACTIVE','{"daily_budget":"10000","effective_status":"ACTIVE"}');
    insert into public.ad_entity_performance_daily values('${entity}','${business}','adset',current_date-1,100,1000,2000,100,90,10,1,0,now());
  `);
  for (const file of ['20261006000000_add_v2_decision_persistence.sql','20261008000000_add_shadow_evaluation_jobs.sql']) {
    await db.exec(readFileSync(new URL(`../../../../../supabase/migrations/${file}`, import.meta.url), 'utf8'));
  }
  await db.exec(`insert into ai.autonomy_policies(business_id,mode) values('${business}','observe')`);
}, 20000);
beforeEach(async () => { await db.exec('begin'); });
afterEach(async () => { await db.exec('rollback; reset role'); });
afterAll(async () => { await db?.close(); });

describe('durable shadow jobs', () => {
  it('deduplicates the same normalized source even when refresh timestamps change', async () => {
    expect((await enqueue()).rows[0].count).toBe(1);
    await db.exec("update public.ad_entity_performance_daily set updated_at=now()+interval '1 second'");
    expect((await enqueue()).rows[0].count).toBe(0);
    expect((await db.query('select * from ai.shadow_evaluation_jobs')).rows).toHaveLength(1);
  });
  it('creates a new version when actual facts or evaluation versions change', async () => {
    await enqueue(); await db.exec('update public.ad_entity_performance_daily set leads=20');
    expect((await enqueue()).rows[0].count).toBe(1);
    expect((await enqueue('v2')).rows[0].count).toBe(1);
  });
  it('never evaluates partial current-day rows', async () => {
    await enqueue(); await db.exec(`insert into public.ad_entity_performance_daily values('${entity}','${business}','adset',current_date,999,999,999,999,999,999,999,999,now())`);
    expect((await enqueue()).rows[0].count).toBe(0);
  });
  it.each(['off','approval_required','autonomous'])('does not queue under %s mode', async (mode) => {
    await db.query('update ai.autonomy_policies set mode=$1',[mode]);
    expect((await enqueue()).rows[0].count).toBe(0);
  });
  it('rejects stale, unfinished and foreign-business syncs', async () => {
    expect((await enqueue('v1',other)).rows[0].count).toBe(0);
    await db.exec("update public.account_sync_jobs set finished_at=now()-interval '7 hours'");
    expect((await enqueue()).rows[0].count).toBe(0);
    await db.exec("update public.account_sync_jobs set status='running',finished_at=now()");
    expect((await enqueue()).rows[0].count).toBe(0);
  });
  it('requires coverage through the completed account-local day', async () => {
    await db.exec('update public.ad_account_sync_state set insights_synced_through=current_date-2');
    expect((await enqueue()).rows[0].count).toBe(0);
  });
  it('prevents overlapping versions of the same entity evaluation', async () => {
    await enqueue(); await db.exec('update public.ad_entity_performance_daily set leads=20'); await enqueue();
    expect(await claim()).not.toBeNull(); expect(await claim()).toBeNull();
  });
  it('expires abandoned inference without replaying the same source', async () => {
    await enqueue(); const job = await claim();
    await db.exec("update ai.shadow_evaluation_jobs set started_at=now()-interval '11 minutes'");
    expect(await claim()).toBeNull();
    expect((await db.query('select status,error_code from ai.shadow_evaluation_jobs where id=$1',[job!.id])).rows[0]).toEqual({ status: 'expired',error_code:'WORKER_LOST' });
    expect((await enqueue()).rows[0].count).toBe(0);
  });
  it('commits shadow decisions and proposals together, without executions', async () => {
    await enqueue(); const job = (await claim())!;
    await db.query(`insert into ai.feature_snapshots(id,business_id,platform_integration_id,ad_account_id,entity_type,entity_id,feature_schema_version,feature_json) values($1,$2,$2,$2,'adset','123',1,'{}')`,[job.feature_snapshot_id,business]);
    await db.query(`insert into ai.decision_runs(id,business_id,feature_snapshot_id,provider,status) values($1,$2,$3,'mock','completed')`,[job.decision_run_id,business,job.feature_snapshot_id]);
    await db.query('select ai.finish_meta_shadow($1,$2,$3,null)',[job.id,{ shadowPolicy: {outcome:'SHADOW_ONLY',reason:'SHADOW_MODE'},reviewPolicy:{outcome:'REQUIRE_APPROVAL'} },{ actionType:'REDUCE_BUDGET',currentState:{budgetMinor:10000},proposedState:{targetBudgetMinor:9500},risk:'low' }]);
    expect((await db.query('select status,requires_approval,policy_result_json from ai.action_proposals')).rows[0]).toMatchObject({status:'pending',requires_approval:true,policy_result_json:{shadowOnly:true,outcome:'SHADOW_ONLY'}});
    expect((await db.query('select * from ai.executed_actions')).rows).toHaveLength(0);
    await expect(db.query('select ai.finish_meta_shadow($1,$2,null,null)',[job.id,{shadowPolicy:{outcome:'HOLD'}}])).rejects.toThrow('no longer running');
  });
  it('records failures and does not manufacture proposals', async () => {
    await enqueue(); const job = (await claim())!;
    await db.query('select ai.finish_meta_shadow($1,null,null,$2)',[job.id,'PROVIDER_FAILED']);
    expect((await db.query('select status from ai.shadow_evaluation_jobs')).rows[0]).toEqual({status:'failed'});
    expect((await db.query('select * from ai.action_proposals')).rows).toHaveLength(0);
  });
  it.each(['anon','authenticated'])('denies enqueue and worker RPCs to %s', async (role) => {
    await db.exec(`set local role ${role}`);
    await expect(claim()).rejects.toMatchObject({code:'42501'});
  });
  it('isolates business reads', async () => {
    await enqueue(); await db.exec(`set local role authenticated; set local test.organization='${other}'`);
    expect((await db.query('select * from ai.shadow_evaluation_jobs')).rows).toHaveLength(0);
    await db.exec(`set local test.organization='${business}'`);
    expect((await db.query('select * from ai.shadow_evaluation_jobs')).rows).toHaveLength(1);
  });
});
