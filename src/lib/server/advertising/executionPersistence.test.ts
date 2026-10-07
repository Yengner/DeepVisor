import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const business = '00000000-0000-0000-0000-000000000001';
const other = '00000000-0000-0000-0000-000000000002';
const proposal = '00000000-0000-0000-0000-000000000003';
const secondProposal = '00000000-0000-0000-0000-000000000004';
const execution = '00000000-0000-0000-0000-000000000005';
const secondExecution = '00000000-0000-0000-0000-000000000006';
let db: PGlite;
const claim = (p = proposal, e = execution, b = business) => db.query('select ai.claim_review_execution($1, $2, $3)', [b, p, e]);
const checkpoint = () => db.query("select ai.checkpoint_review_execution($1, $2, '{\"exact\":\"before\"}', '{\"field\":\"status\"}')", [business, execution]);
const finish = (success: boolean) => db.query("select ai.finish_review_execution($1, $2, $3, '{\"exact\":\"after\"}', null)", [business, execution, success]);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create schema ai;
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create table public.business_profiles (id uuid primary key, organization_id uuid);
    create table public.platform_integrations (id uuid primary key, business_id uuid, platform_id uuid);
    create table public.ad_accounts (id uuid primary key, business_id uuid, platform_id uuid);
    create function public.is_org_member(uuid) returns boolean language sql stable as $$ select false $$;
    grant select on public.business_profiles, public.platform_integrations, public.ad_accounts to authenticated, service_role;
    insert into public.business_profiles values ('${business}', '${business}'), ('${other}', '${other}');
    insert into public.platform_integrations values ('${business}', '${business}', '${business}');
    insert into public.ad_accounts values ('${business}', '${business}', '${business}');
  `);
  for (const file of ['20261006000000_add_v2_decision_persistence.sql', '20261007000000_add_review_execution_claims.sql', '20261010000000_add_limited_auto_execution.sql']) {
    await db.exec(readFileSync(new URL(`../../../../supabase/migrations/${file}`, import.meta.url), 'utf8'));
  }
  await db.exec(`
    insert into ai.feature_snapshots(id,business_id,platform_integration_id,ad_account_id,entity_type,entity_id,feature_schema_version,feature_json)
      values('${business}','${business}','${business}','${business}','adset','123',1,'{}');
    insert into ai.decision_runs(id,business_id,feature_snapshot_id,provider,status)
      values('${business}','${business}','${business}','mock','completed');
    insert into ai.autonomy_policies(business_id, mode, allowed_action_classes,budget_boundaries_json)
      values('${business}','approval_required',array['PAUSE_DELIVERY_UNIT'],'{"executionEnabled":true}');
    insert into ai.action_proposals(id,business_id,decision_run_id,action_type,target_entity_type,target_entity_id,status,policy_result_json)
      select id,'${business}','${business}','PAUSE_DELIVERY_UNIT','adset','123','approved',
        '{"outcome":"REQUIRE_APPROVAL","reason":"REVIEW_MODE","review":{"choice":"approve","fingerprint":"test"}}'::jsonb
      from unnest(array['${proposal}'::uuid,'${secondProposal}'::uuid]) id;
  `);
}, 20000);
beforeEach(async () => { await db.exec('begin; set local role service_role'); });
afterEach(async () => { await db.exec('rollback; reset role'); });
afterAll(async () => { await db?.close(); });

describe('review execution migration', () => {
  it('creates an audit record and returns the persisted decision lineage', async () => {
    const result = await claim();
    expect(result.rows[0]).toMatchObject({ claim_review_execution: { proposal: { id: proposal }, run: { status: 'completed' }, history: [] } });
    expect((await db.query('select status, state_before_json from ai.executed_actions')).rows[0]).toEqual({ status: 'pending', state_before_json: null });
  });
  it('rejects duplicate attempts before they can write to Meta', async () => {
    await claim();
    await expect(claim()).rejects.toThrow('already attempted');
  });
  it('serializes different proposals across the entire business', async () => {
    await claim();
    await expect(claim(secondProposal, secondExecution)).rejects.toThrow('locked');
  });
  it('persists exact before and after states and releases a successful business lock', async () => {
    await claim(); await checkpoint(); await finish(true);
    expect((await db.query('select status,state_before_json,state_after_json from ai.executed_actions')).rows[0]).toEqual({ status: 'succeeded', state_before_json: { exact: 'before' }, state_after_json: { exact: 'after' } });
    expect((await db.query('select active from ai.review_execution_claims')).rows[0]).toEqual({ active: false });
    const result = await claim(secondProposal, secondExecution);
    expect(result.rows[0]).toMatchObject({ claim_review_execution: { history: [expect.objectContaining({ id: execution, status: 'succeeded', entityId: '123' })] } });
  });
  it('never replays a previously completed proposal', async () => {
    await claim(); await checkpoint(); await finish(true);
    await expect(claim(proposal, secondExecution)).rejects.toThrow('already attempted');
  });
  it('retains the business lock on every uncertain post-checkpoint failure', async () => {
    await claim(); await checkpoint(); await finish(false);
    expect((await db.query('select active from ai.review_execution_claims')).rows[0]).toEqual({ active: true });
    await expect(claim(secondProposal, secondExecution)).rejects.toThrow('locked');
  });
  it('releases the business lock for a known pre-write failure, but never reuses the proposal', async () => {
    await claim(); await finish(false);
    expect((await db.query('select active from ai.review_execution_claims')).rows[0]).toEqual({ active: false });
    await expect(claim(proposal, secondExecution)).rejects.toThrow('already attempted');
  });
  it('checks current policy and proposal again at the write boundary', async () => {
    await claim(); await db.query("update ai.autonomy_policies set mode = 'off'");
    await expect(checkpoint()).rejects.toThrow('changed');
  });
  it('rejects modified proposal values after claiming', async () => {
    await claim(); await db.query("update ai.action_proposals set proposed_state_json = '{\"targetBudgetMinor\":1}' where id = $1", [proposal]);
    await expect(checkpoint()).rejects.toThrow('changed');
  });
  it('does not checkpoint twice', async () => {
    await claim(); await checkpoint(); await expect(checkpoint()).rejects.toThrow('already started');
  });
  it('cannot finish successfully without a checkpoint', async () => {
    await claim(); await expect(finish(true)).rejects.toThrow('after-state');
  });
  it.each(['off', 'observe', 'autonomous'])('rejects non-REVIEW mode %s', async (mode) => {
    await db.query('update ai.autonomy_policies set mode = $1', [mode]);
    await expect(claim()).rejects.toThrow('not authorized');
  });
  it('rejects cross-business requests', async () => {
    await expect(claim(proposal, execution, other)).rejects.toThrow('not authorized');
  });
  it.each(['anon', 'authenticated'])('denies execution RPCs to %s', async (role) => {
    await db.exec(`reset role; set local role ${role}`);
    await expect(claim()).rejects.toMatchObject({ code: '42501' });
  });
});

const autoClaim = (p=proposal,e=execution) => db.query('select ai.claim_limited_auto_execution($1,$2,$3)',[business,p,e]);
const autoAuthorize = () => db.query('select ai.authorize_limited_auto_execution($1,$2)',[business,execution]);
const autoCheckpoint = () => db.query(`select ai.checkpoint_limited_auto_execution($1,$2,'{"exact":"before"}','{"executionMode":"LIMITED_AUTO"}')`,[business,execution]);
async function enableAuto() {
  await db.exec(`update ai.execution_controls set limited_auto_enabled=true;
    update ai.autonomy_policies set mode='autonomous',budget_boundaries_json='{"executionEnabled":true,"exclusiveWriterConfirmed":true,"limitedAuto":{"enabled":true,"killSwitch":false,"adAccountId":"${business}"}}';
    update ai.action_proposals set status='pending',requires_approval=false,risk_level='low',policy_result_json='{"outcome":"ALLOW_EXECUTION","reason":"POLICY_PASSED","automaticAuthorization":{"fingerprint":"test"}}';
  `);
  await db.query('select ai.claim_limited_auto_evaluation($1,$2)',[business,business]);
  await db.query("select ai.finish_limited_auto_evaluation($1,$2,'running','POLICY_PASSED',$3,$4)",[business,business,business,proposal]);
}

describe('limited auto durable authorization',()=>{
  it('defaults globally off without changing existing business modes',async()=>{
    expect((await db.query('select limited_auto_enabled from ai.execution_controls')).rows[0]).toEqual({limited_auto_enabled:false});
    expect((await db.query('select mode from ai.autonomy_policies')).rows[0]).toEqual({mode:'approval_required'});
    await expect(db.query('select ai.claim_limited_auto_evaluation($1,$2)',[business,business])).rejects.toThrow('disabled');
  });
  it('uses exact durable audit and the existing lock lifecycle',async()=>{
    await enableAuto(); await autoClaim(); await autoCheckpoint(); await autoAuthorize(); await finish(true);
    expect((await db.query('select status,state_before_json,state_after_json from ai.executed_actions')).rows[0]).toMatchObject({status:'succeeded',state_before_json:{exact:'before'},state_after_json:{exact:'after'}});
    expect((await db.query('select active from ai.review_execution_claims')).rows[0]).toEqual({active:false});
  });
  it('blocks repeated execution attempts',async()=>{
    await enableAuto(); await autoClaim(); await autoCheckpoint(); await finish(true);
    await expect(autoClaim(proposal,secondExecution)).rejects.toThrow('already attempted');
  });
  it('blocks replay of identical evidence, including cloned snapshots',async()=>{
    await enableAuto();
    await db.exec(`insert into ai.feature_snapshots(id,business_id,platform_integration_id,ad_account_id,entity_type,entity_id,feature_schema_version,feature_json)
      select '${other}',business_id,platform_integration_id,ad_account_id,entity_type,entity_id,feature_schema_version,feature_json from ai.feature_snapshots where id='${business}'`);
    await expect(db.query('select ai.claim_limited_auto_evaluation($1,$2)',[business,other])).rejects.toMatchObject({code:'23505'});
  });
  it('cannot run concurrently with a review claim',async()=>{
    await claim(secondProposal,secondExecution); await enableAuto();
    await expect(autoClaim()).rejects.toThrow('locked');
  });
  it('retains the business lock after any post-checkpoint uncertainty',async()=>{
    await enableAuto(); await autoClaim(); await autoCheckpoint(); await finish(false);
    expect((await db.query('select active from ai.review_execution_claims')).rows[0]).toEqual({active:true});
    expect((await db.query('select error_json from ai.executed_actions')).rows[0]).toMatchObject({error_json:{reconciliationRequired:true}});
  });
  it.each(['claim','checkpoint','authorize'])('honors the global kill switch at %s',async stage=>{
    await enableAuto(); if(stage!=='claim') await autoClaim(); if(stage==='authorize') await autoCheckpoint();
    await db.exec('update ai.execution_controls set limited_auto_enabled=false');
    await expect(stage==='claim'?autoClaim():stage==='checkpoint'?autoCheckpoint():autoAuthorize()).rejects.toThrow();
  });
  it.each(['claim','checkpoint','authorize'])('honors business revocation at %s',async stage=>{
    await enableAuto(); if(stage!=='claim') await autoClaim(); if(stage==='authorize') await autoCheckpoint();
    await db.exec(`update ai.autonomy_policies set budget_boundaries_json=jsonb_set(budget_boundaries_json,'{limitedAuto,killSwitch}','true')`);
    await expect(stage==='claim'?autoClaim():stage==='checkpoint'?autoCheckpoint():autoAuthorize()).rejects.toThrow();
  });
  it('rejects old decisions',async()=>{
    await enableAuto(); await db.exec("reset role; alter table ai.decision_runs disable trigger touch_v2_updated_at; update ai.decision_runs set updated_at=now()-interval '3 minutes'; set local role service_role");
    await expect(autoClaim()).rejects.toThrow('not authorized');
  });
  it('rejects source policy changes during provider inference',async()=>{
    await enableAuto(); await db.exec('update ai.autonomy_policies set max_budget_change_percent=3');
    await expect(autoClaim()).rejects.toThrow('not authorized');
  });
  it('rejects changed evidence at the final write gate',async()=>{
    await enableAuto(); await autoClaim(); await autoCheckpoint();
    await db.exec(`update ai.feature_snapshots set feature_json='{"changed":true}'`);
    await expect(autoAuthorize()).rejects.toThrow('changed');
  });
  it.each(['pending','failed'])('cannot execute a %s provider run',async status=>{
    await enableAuto(); await db.query('update ai.decision_runs set status=$1',[status]);
    await expect(autoClaim()).rejects.toThrow('not authorized');
  });
  it.each(['medium','high'])('cannot execute %s risk',async risk=>{
    await enableAuto(); await db.query('update ai.action_proposals set risk_level=$1',[risk]);
    await expect(autoClaim()).rejects.toThrow('not authorized');
  });
  it.each(['anon','authenticated'])('denies auto RPCs and switches to %s',async role=>{
    await db.exec(`reset role; set local role ${role}`);
    await expect(autoClaim()).rejects.toMatchObject({code:'42501'});
  });
});
