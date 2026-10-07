import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const id = '00000000-0000-0000-0000-000000000001';
const other = '00000000-0000-0000-0000-000000000002';
let db: PGlite;
const process = () => db.query('select ai.process_action_outcomes()');
type Window = { complete: boolean; metrics: Record<string, number | null> | null; start: string; end: string };
type Outcome = {
  source_kind: string; executed_action_id: string | null; shadow_decision_run_id: string | null;
  measurement_status: string; measurement_horizon_hours: number;
  metrics_before_json: { window: Window; referenceSnapshot: unknown; decisionRunId: string; actionProposalId: string };
  metrics_after_json: Window;
  calculated_change_json: { interpretation: string; causalEffectEstimated: boolean; reason: string | null; observedChanges: Record<string, { absoluteChange: number | null; relativeChangePercent: number | null; absoluteUnit: string }> };
};
const outcomes = async () => (await db.query<Outcome>('select * from ai.action_outcomes order by source_kind,measurement_horizon_hours')).rows;

beforeAll(async () => {
  db = new PGlite();
  // Minimal existing production-table fixture; the V2 migrations run unmodified.
  await db.exec(`
    set timezone='UTC';
    create schema ai; create role anon; create role authenticated; create role service_role bypassrls;
    create table public.business_profiles(id uuid primary key,organization_id uuid);
    create table public.platforms(id uuid primary key,key text);
    create table public.platform_integrations(id uuid primary key,business_id uuid,platform_id uuid);
    create table public.ad_accounts(id uuid primary key,business_id uuid,platform_id uuid,timezone text,currency_code text);
    create table public.account_sync_jobs(id uuid primary key,business_id uuid,platform_integration_id uuid,ad_account_id uuid,status text,finished_at timestamptz);
    create table public.ad_account_sync_state(ad_account_id uuid,insights_synced_through date);
    create table public.ad_entities(id uuid primary key,business_id uuid,ad_account_id uuid,entity_level text,external_id text,campaign_id uuid,status text,raw jsonb);
    create table public.ad_entity_performance_daily(entity_id uuid,ad_account_id uuid,entity_level text,day date,spend numeric,reach numeric,impressions numeric,clicks numeric,inline_link_clicks numeric,leads numeric,messages numeric,calls numeric,updated_at timestamptz);
    create table public.ad_entity_performance_hourly(entity_id uuid,ad_account_id uuid,entity_level text,day date,hour_of_day integer,currency_code text,spend numeric,impressions bigint,clicks bigint,leads bigint,messages bigint,calls bigint,updated_at timestamptz,primary key(entity_id,day,hour_of_day));
    create function public.is_org_member(org uuid) returns boolean language sql stable as $$ select org::text=current_setting('test.organization',true) $$;
    grant select on all tables in schema public to authenticated,service_role;
    insert into public.business_profiles values('${id}','${id}'),('${other}','${other}');
    insert into public.platforms values('${id}','meta');
    insert into public.platform_integrations values('${id}','${id}','${id}');
    insert into public.ad_accounts values('${id}','${id}','${id}','UTC','USD');
    insert into public.account_sync_jobs values('${id}','${id}','${id}','${id}','completed',now());
    insert into public.ad_entities values('${id}','${id}','${id}','adset','123',null,'ACTIVE','{}');
  `);
  for (const file of ['20261006000000_add_v2_decision_persistence.sql','20261008000000_add_shadow_evaluation_jobs.sql','20261009000000_add_action_outcome_measurements.sql']) {
    await db.exec(readFileSync(new URL(`../../../../../supabase/migrations/${file}`, import.meta.url), 'utf8'));
  }
}, 20000);
beforeEach(async () => {
  await db.exec(`begin;
    insert into ai.feature_snapshots(id,business_id,platform_integration_id,ad_account_id,entity_type,entity_id,feature_schema_version,feature_json)
      values('${id}','${id}','${id}','${id}','adset','123',1,'{"deliveryUnit":{"currency":"USD"},"baselineEvidence":"preserved"}');
    insert into ai.decision_runs(id,business_id,feature_snapshot_id,provider,status) values('${id}','${id}','${id}','mock','completed');
    insert into ai.action_proposals(id,business_id,decision_run_id,action_type,target_entity_type,target_entity_id)
      values('${id}','${id}','${id}','REDUCE_BUDGET','adset','123');
    insert into ai.executed_actions(id,business_id,action_proposal_id,status,state_before_json,started_at,completed_at)
      values('${id}','${id}','${id}','succeeded','{"account":{"timezone_name":"UTC"}}',date_trunc('day',now())-interval '5 days'+interval '12 hours',date_trunc('day',now())-interval '5 days'+interval '12 hours 30 minutes');
    insert into ai.shadow_evaluation_jobs(business_id,platform_integration_id,ad_account_id,entity_id,evaluation_version,source_hash,source_json,source_synced_at,source_sync_job_id,feature_snapshot_id,decision_run_id,action_proposal_id,status,completed_at)
      select '${id}','${id}','${id}','123','v1','hash','{"timeZone":"UTC"}',now(),'${id}','${id}','${id}','${id}','completed',completed_at from ai.executed_actions;
    insert into public.ad_entity_performance_hourly
      select '${id}','${id}','adset',t::date,extract(hour from t),'USD',
        case when t<date_trunc('day',now())-interval '5 days'+interval '12 hours' then 10 else 20 end,
        100,10,1,1,0,now()
      from generate_series(date_trunc('day',now())-interval '8 days',date_trunc('day',now())-interval '1 day',interval '1 hour') t;
  `);
});
afterEach(async () => { await db.exec('rollback; reset role'); });
afterAll(async () => { await db?.close(); });

describe('observational outcome measurements', () => {
  it('measures four horizons for distinct executed and shadow sources, preserving references', async () => {
    await process();
    const rows = await outcomes();
    expect(rows).toHaveLength(8);
    for (const row of rows) {
      const hours = row.measurement_horizon_hours;
      expect([1,6,24,72]).toContain(hours);
      expect(row.measurement_status).toBe('complete');
      expect(row.executed_action_id).toBe(row.source_kind === 'executed' ? id : null);
      expect(row.shadow_decision_run_id).toBe(row.source_kind === 'shadow' ? id : null);
      expect(row.metrics_before_json).toMatchObject({ decisionRunId:id, actionProposalId:id, referenceSnapshot:{baselineEvidence:'preserved'} });
      expect(row.metrics_before_json.window.metrics).toMatchObject({spend:10*hours,results:2*hours,costPerResult:5,ctr:10,cpc:1,cpm:100,activeHours:hours,deliveryImpressionsPerHour:100});
      expect(row.metrics_after_json.metrics).toMatchObject({spend:20*hours,costPerResult:10,cpc:2,cpm:200});
      expect(row.calculated_change_json).toMatchObject({interpretation:'observational_correlation',causalEffectEstimated:false,observedChanges:{spend:{absoluteChange:10*hours,relativeChangePercent:100},ctr:{absoluteChange:0,absoluteUnit:'percentage_points'}}});
      expect(new Date(row.metrics_after_json.start).getUTCHours()).toBe(13);
      expect(new Date(row.metrics_before_json.window.end).getUTCHours()).toBe(12);
    }
  });
  it('is idempotent and never revises completed baselines or results', async () => {
    await process(); const initial = await outcomes();
    await db.exec('update public.ad_entity_performance_hourly set spend=999');
    await process(); expect(await outcomes()).toEqual(initial);
  });
  it('computes ratios from totals and preserves fractional delivery rates', async () => {
    await db.exec(`update public.ad_entity_performance_hourly set impressions=101,clicks=20
      where day=(select completed_at::date from ai.executed_actions) and hour_of_day=13`);
    await process(); const row = (await outcomes()).find(r=>r.measurement_horizon_hours===6)!;
    expect(row.metrics_after_json.metrics?.ctr).toBeCloseTo(70*100/601);
    expect(row.metrics_after_json.metrics?.cpc).toBeCloseTo(120/70);
    expect(row.metrics_after_json.metrics?.cpm).toBeCloseTo(120000/601);
    expect(row.metrics_after_json.metrics?.deliveryImpressionsPerHour).toBeCloseTo(601/6);
    expect(row.calculated_change_json.observedChanges.ctr.absoluteChange).toBeCloseTo(70*100/601-10);
  });
  it('keeps absent baseline data pending and can fill it on a later sync', async () => {
    await db.exec("update public.ad_entity_performance_hourly set updated_at=now()-interval '20 days'");
    await process(); expect((await outcomes())[0].metrics_before_json.window.complete).toBe(false);
    await db.exec('update public.ad_entity_performance_hourly set updated_at=now(); update ai.action_outcomes set next_attempt_at=now()');
    await process(); expect((await outcomes())[0].measurement_status).toBe('complete');
  });
  it('keeps zero delivery but uses null for undefined ratios and relative change', async () => {
    await db.exec('update public.ad_entity_performance_hourly set spend=0,impressions=0,clicks=0,leads=0,messages=0,calls=0');
    await process(); const row = (await outcomes())[0];
    expect(row.measurement_status).toBe('complete');
    expect(row.metrics_after_json.metrics).toMatchObject({spend:0,results:0,costPerResult:null,ctr:null,cpc:null,cpm:null,activeHours:0,deliveryImpressionsPerHour:0});
    expect(row.calculated_change_json.observedChanges.spend.relativeChangePercent).toBeNull();
    expect(row.calculated_change_json.observedChanges.cpc.absoluteChange).toBeNull();
  });
  it('does not invent zero performance for missing hours; retries and freezes the baseline', async () => {
    await db.exec("update public.ad_entity_performance_hourly set updated_at=now()-interval '10 days' where day>=(select completed_at::date from ai.executed_actions) and hour_of_day>=13");
    await process();
    const first = (await outcomes())[0];
    expect(first.measurement_status).toBe('pending');
    expect(first.metrics_after_json.metrics).toBeNull();
    await db.exec("update public.ad_entity_performance_hourly set spend=40,updated_at=now(); update ai.action_outcomes set next_attempt_at=now()");
    await process(); const retried = (await outcomes())[0];
    expect(retried.measurement_status).toBe('complete');
    expect(retried.metrics_before_json).toEqual(first.metrics_before_json);
    expect(retried.metrics_after_json.metrics?.spend).toBe(40);
  });
  it.each(["currency_code=null","currency_code='EUR'","spend=-1","clicks=null"])
    ('rejects mixed valid/invalid hourly data: %s', async (change) => {
      await db.exec(`update public.ad_entity_performance_hourly set ${change} where hour_of_day=14`);
      await process(); expect((await outcomes()).find(r=>r.measurement_horizon_hours===6)?.measurement_status).toBe('pending');
    });
  it('terminates old missing measurements explicitly as insufficient data', async () => {
    await db.exec("update ai.executed_actions set started_at=now()-interval '13 days',completed_at=now()-interval '12 days'; delete from public.ad_entity_performance_hourly");
    await process();
    expect((await outcomes()).filter(r=>r.source_kind==='executed').every(r=>r.measurement_status==='insufficient_data')).toBe(true);
  });
  it('does not measure horizons before they elapse', async () => {
    await db.exec('update ai.executed_actions set completed_at=now()');
    await process();
    expect((await outcomes()).filter(r=>r.source_kind==='executed').every(r=>r.measurement_status==='pending' && Object.keys(r.metrics_after_json).length===0)).toBe(true);
  });
  it('does not seed failed executions or failed shadow evaluations', async () => {
    await db.exec("update ai.executed_actions set status='failed'; update ai.shadow_evaluation_jobs set status='failed'");
    await process(); expect(await outcomes()).toHaveLength(0);
  });
  it('allows shadow HOLD history with no action proposal', async () => {
    await db.exec(`delete from ai.executed_actions; delete from ai.action_proposals`);
    await process(); expect(await outcomes()).toHaveLength(4);
    expect((await outcomes())[0].metrics_before_json.actionProposalId).toBeNull();
  });
  it('marks missing timezone unavailable instead of guessing', async () => {
    await db.exec("update ai.executed_actions set state_before_json='{}'");
    await process(); expect((await outcomes())[0]).toMatchObject({measurement_status:'unavailable',calculated_change_json:{reason:'missing_or_invalid_time_zone'}});
  });
  it('declines ambiguous DST windows', async () => {
    await db.exec(`update ai.executed_actions set state_before_json='{"account":{"timezone_name":"America/New_York"}}',started_at='2025-11-02 06:00:00Z',completed_at='2025-11-02 06:30:00Z'`);
    await process(); expect((await outcomes())[0]).toMatchObject({measurement_status:'unavailable',calculated_change_json:{reason:'daylight_saving_transition'}});
  });
  it('aligns non-whole-hour timezones using advertiser-local hours', async () => {
    await db.exec(`update ai.executed_actions set state_before_json='{"account":{"timezone_name":"Asia/Kolkata"}}'`);
    await process(); const row = (await outcomes())[0];
    expect(new Date(row.metrics_after_json.start).getUTCMinutes()).toBe(30);
    expect(new Date(row.metrics_after_json.end).getTime()-new Date(row.metrics_after_json.start).getTime()).toBe(3600000);
  });
  it('limits each tick and rejects invalid limits', async () => {
    await db.query('select ai.process_action_outcomes(1)'); expect(await outcomes()).toHaveLength(1);
    await expect(db.query('select ai.process_action_outcomes(0)')).rejects.toThrow('Invalid outcome batch limit');
  });
  it.each(['anon','authenticated'])('denies measurement RPC to %s', async (role) => {
    await db.exec(`set local role ${role}`); await expect(process()).rejects.toMatchObject({code:'42501'});
  });
  it('allows the service role to process outcomes', async () => {
    await db.exec('set local role service_role'); await process(); expect(await outcomes()).toHaveLength(8);
  });
  it('enforces business-scoped source references', async () => {
    await expect(db.exec(`insert into ai.action_outcomes(business_id,source_kind,shadow_decision_run_id,measurement_horizon_hours,metrics_before_json,metrics_after_json,calculated_change_json) values('${other}','shadow','${id}',1,'{}','{}','{}')`)).rejects.toMatchObject({code:'23503'});
  });
  it('isolates outcome reads by business', async () => {
    await process();
    await db.exec(`set local role authenticated; set local test.organization='${other}'`);
    expect(await outcomes()).toHaveLength(0);
    await db.exec(`set local test.organization='${id}'`);
    expect(await outcomes()).toHaveLength(8);
  });
  it.each(['executed','shadow'])('enforces unique %s horizon keys', async (kind) => {
    await process();
    await expect(db.query(`insert into ai.action_outcomes(business_id,source_kind,executed_action_id,shadow_decision_run_id,measurement_horizon_hours,metrics_before_json,metrics_after_json,calculated_change_json)
      select business_id,source_kind,executed_action_id,shadow_decision_run_id,measurement_horizon_hours,metrics_before_json,metrics_after_json,calculated_change_json
      from ai.action_outcomes where source_kind=$1 limit 1`,[kind])).rejects.toMatchObject({code:'23505'});
  });
  it('rejects mixed executed/shadow source identities', async () => {
    await expect(db.exec(`insert into ai.action_outcomes(business_id,executed_action_id,source_kind,shadow_decision_run_id,measurement_horizon_hours,metrics_before_json,metrics_after_json,calculated_change_json) values('${id}','${id}','shadow','${id}',1,'{}','{}','{}')`)).rejects.toMatchObject({code:'23514'});
  });
  it('preserves legacy outcome inserts and measured data', async () => {
    await db.exec(`insert into ai.action_outcomes(business_id,executed_action_id,measurement_horizon_hours,metrics_before_json,metrics_after_json,calculated_change_json) values('${id}','${id}',1,'{"legacy":true}','{}','{}')`);
    await process(); expect((await outcomes())[0].metrics_before_json).toEqual({legacy:true});
  });
});
