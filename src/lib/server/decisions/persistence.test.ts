import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const business = '00000000-0000-0000-0000-000000000001';
const otherBusiness = '00000000-0000-0000-0000-000000000002';
const snapshot = '00000000-0000-0000-0000-000000000011';
const run = '00000000-0000-0000-0000-000000000012';
const proposal = '00000000-0000-0000-0000-000000000013';
const execution = '00000000-0000-0000-0000-000000000014';
let db: PGlite;

beforeAll(async () => {
  db = new PGlite();
  // Test-only contracts for pre-existing production objects, never a production baseline.
  await db.exec(`
    create schema ai;
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create table public.business_profiles (id uuid primary key, organization_id uuid);
    create table public.platform_integrations (id uuid primary key, business_id uuid, platform_id uuid);
    create table public.ad_accounts (id uuid primary key, business_id uuid, platform_id uuid);
    create function public.is_org_member(org uuid) returns boolean language sql stable as
      $$ select org::text = current_setting('test.organization_id', true) $$;
    grant select on public.business_profiles, public.platform_integrations, public.ad_accounts to authenticated, service_role;
    insert into public.business_profiles values ('${business}', '${business}'), ('${otherBusiness}', '${otherBusiness}');
    insert into public.platform_integrations values ('${business}', '${business}', '${business}'), ('${otherBusiness}', '${otherBusiness}', '${business}');
    insert into public.ad_accounts values ('${business}', '${business}', '${business}'), ('${otherBusiness}', '${otherBusiness}', '${business}');
  `);
  await db.exec(readFileSync(new URL('../../../../supabase/migrations/20261006000000_add_v2_decision_persistence.sql', import.meta.url), 'utf8'));
  await db.exec(`
    insert into ai.feature_snapshots (id, business_id, platform_integration_id, ad_account_id, entity_type, entity_id, feature_schema_version, feature_json)
      values ('${snapshot}', '${business}', '${business}', '${business}', 'adset', 'meta-adset', 1, '{}');
    insert into ai.decision_runs (id, business_id, feature_snapshot_id, provider) values ('${run}', '${business}', '${snapshot}', 'test');
    insert into ai.action_proposals (id, business_id, decision_run_id, action_type, target_entity_type, target_entity_id)
      values ('${proposal}', '${business}', '${run}', 'budget_change', 'adset', 'meta-adset');
    insert into ai.executed_actions (id, business_id, action_proposal_id) values ('${execution}', '${business}', '${proposal}');
    insert into ai.action_outcomes (business_id, executed_action_id, measurement_horizon_hours, metrics_before_json, metrics_after_json, calculated_change_json)
      values ('${business}', '${execution}', 24, '{}', '{}', '{}');
    insert into ai.autonomy_policies (business_id) values ('${business}');
  `);
}, 20000);

beforeEach(async () => { await db.exec('begin'); });
afterEach(async () => { await db.exec('rollback; reset role'); });
afterAll(async () => { await db?.close(); });

describe('V2 migration', () => {
  it('defaults to no autonomy, mandatory approval and pending execution', async () => {
    const policy = await db.query('select mode, allowed_action_classes, max_budget_change_percent from ai.autonomy_policies');
    expect(policy.rows[0]).toMatchObject({ mode: 'off', allowed_action_classes: [], max_budget_change_percent: '0' });
    const action = await db.query('select requires_approval, risk_level from ai.action_proposals');
    expect(action.rows[0]).toEqual({ requires_approval: true, risk_level: 'unknown' });
    const result = await db.query('select status from ai.executed_actions');
    expect(result.rows[0]).toEqual({ status: 'pending' });
  });

  it.each(['ad_account_id', 'platform_integration_id'])('rejects snapshots with cross-business %s', async (column) => {
    await expect(db.query(`update ai.feature_snapshots set ${column} = $1 where id = $2`, [otherBusiness, snapshot])).rejects.toMatchObject({ code: '23514' });
  });

  it('rejects an integration for a different platform in the same business', async () => {
    await db.query('update public.platform_integrations set platform_id = $1 where id = $2', [otherBusiness, business]);
    await expect(db.query('update ai.feature_snapshots set entity_id = entity_id where id = $1', [snapshot])).rejects.toMatchObject({ code: '23514' });
  });

  it.each(['decision_runs', 'action_proposals', 'executed_actions', 'action_outcomes'])('rejects cross-tenant lineage in %s', async (table) => {
    await expect(db.query(`update ai.${table} set business_id = $1`, [otherBusiness])).rejects.toMatchObject({ code: '23503' });
  });

  it('preserves referenced audit records', async () => {
    await expect(db.query('delete from ai.feature_snapshots where id = $1', [snapshot])).rejects.toMatchObject({ code: '23503' });
  });

  it.each([-0.1, 1.1, NaN, Infinity])('rejects invalid confidence %s', async (confidence) => {
    await expect(db.query('update ai.decision_runs set confidence = $1', [confidence])).rejects.toMatchObject({ code: '23514' });
  });

  it.each([-1, 101])('rejects unsafe budget percentage %s', async (percentage) => {
    await expect(db.query('update ai.autonomy_policies set max_budget_change_percent = $1', [percentage])).rejects.toMatchObject({ code: '23514' });
  });

  it('rejects duplicate outcome horizons', async () => {
    await expect(db.query(`insert into ai.action_outcomes
      (business_id, executed_action_id, measurement_horizon_hours, metrics_before_json, metrics_after_json, calculated_change_json)
      values ($1, $2, 24, '{}', '{}', '{}')`, [business, execution])).rejects.toMatchObject({ code: '23505' });
  });

  it.each([0, -24])('rejects invalid measurement horizons: %s', async (horizon) => {
    await expect(db.query('update ai.action_outcomes set measurement_horizon_hours = $1', [horizon])).rejects.toMatchObject({ code: '23514' });
  });

  it('updates mutable timestamps on writes', async () => {
    const before = await db.query<{ updated_at: Date }>('select updated_at from ai.decision_runs');
    await db.exec("update ai.decision_runs set status = 'completed'");
    const after = await db.query<{ updated_at: Date }>('select updated_at from ai.decision_runs');
    expect(new Date(after.rows[0].updated_at).getTime()).toBeGreaterThanOrEqual(new Date(before.rows[0].updated_at).getTime());
  });

  it.each(['feature_snapshots', 'decision_runs', 'action_proposals', 'executed_actions', 'action_outcomes', 'autonomy_policies'])('isolates authenticated reads for %s', async (table) => {
    await db.exec(`set local role authenticated; set local test.organization_id = '${otherBusiness}'`);
    expect((await db.query(`select * from ai.${table}`)).rows).toEqual([]);
    await db.exec(`set local test.organization_id = '${business}'`);
    expect((await db.query(`select * from ai.${table}`)).rows).toHaveLength(1);
  });

  it.each(['decision_runs', 'action_proposals', 'executed_actions', 'autonomy_policies'])('prevents browser updates to %s', async (table) => {
    await db.exec(`set local role authenticated; set local test.organization_id = '${business}'`);
    await expect(db.query(`update ai.${table} set business_id = business_id`)).rejects.toMatchObject({ code: '42501' });
  });

  it('permits scoped server writes without granting anonymous access', async () => {
    await db.exec('set local role service_role');
    await db.query(`insert into ai.decision_runs (business_id, feature_snapshot_id, provider) values ($1, $2, 'test')`, [business, snapshot]);
    expect((await db.query('select * from ai.decision_runs')).rows).toHaveLength(2);
    await db.exec('reset role; set local role anon');
    await expect(db.query('select * from ai.feature_snapshots')).rejects.toMatchObject({ code: '42501' });
  });
});
