import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile, chmod } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { AS_OF, NOW, FIXTURE_TAG, PROJECT_REF, businesses, uid, media, mediaSvg, generateFixture, totals, dayAt } from './fixture.ts';

const command = process.argv[2];
assert(['seed', 'verify', 'clean'].includes(command), 'Use seed, verify or clean');
assert(process.env.NODE_ENV !== 'production', 'Fixtures are development-only');
assert(process.env.DEEPVISOR_FIXTURES === PROJECT_REF, `Set DEEPVISOR_FIXTURES=${PROJECT_REF} to explicitly target the development project`);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
assert.equal(new URL(url).hostname, `${PROJECT_REF}.supabase.co`, 'Unexpected Supabase project');
assert(process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, 'Supabase admin and anon keys are required in .env.local');
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, options);
const anon = () => createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, options);
const stateFile = new URL('../../.env.beta-fixtures.json', import.meta.url);
const bucket = 'business-media', prefix = `beta-fixtures/${FIXTURE_TAG}`;
const mediaBase = `${url}/storage/v1/object/public/${bucket}/${prefix}`;
const check = async (request, label) => {
  const result = await request;
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
};
async function pages(query) {
  const rows = [];
  for (let from = 0; ; from += 500) {
    const page = await check(query(from, from + 499), 'read page');
    rows.push(...page);
    if (page.length < 500) return rows;
  }
}
async function upsert(table, rows, conflict = 'id') {
  for (let i = 0; i < rows.length; i += 200) await check(admin.from(table).upsert(rows.slice(i, i + 200), { onConflict: conflict }), `write ${table}`);
}
async function listUsers() {
  const users = [];
  for (let page = 1; ; page++) {
    const result = await check(admin.auth.admin.listUsers({ page, perPage: 100 }), 'list Auth users');
    users.push(...result.users);
    if (result.users.length < 100) return users;
  }
}
async function assertOwned(b) {
  const org = await check(admin.from('organizations').select('id,branding').eq('id', b.organizationId).maybeSingle(), 'check fixture ownership');
  if (org) assert.equal(org.branding?.synthetic_fixture, FIXTURE_TAG, 'Refusing to alter unmarked organization');
  const profile = await check(admin.from('business_profiles').select('id,organization_id,business_name').eq('id', b.id).maybeSingle(), 'check business ownership');
  if (profile) { assert.equal(profile.organization_id, b.organizationId); assert.equal(profile.business_name, b.name); }
  const account = await check(admin.from('ad_accounts').select('business_id,external_account_id').eq('id', b.accountId).maybeSingle(), 'check account ownership');
  if (account) { assert.equal(account.business_id, b.id); assert.equal(account.external_account_id, `${FIXTURE_TAG}-${b.key}-account`); }
  const integration = await check(admin.from('platform_integrations').select('business_id,access_token_secret_id,refresh_token_secret_id,integration_details').eq('id', b.integrationId).maybeSingle(), 'check integration ownership');
  if (integration) {
    assert.equal(integration.business_id, b.id); assert.equal(integration.integration_details.synthetic_fixture, FIXTURE_TAG);
    assert.equal(integration.access_token_secret_id, null); assert.equal(integration.refresh_token_secret_id, null);
  }
}
const platform = await check(admin.from('platforms').select('id').eq('key', 'meta').single(), 'find existing Meta platform');
const fixture = generateFixture(platform.id, mediaBase);
const users = await listUsers();
for (const b of businesses) await assertOwned(b);

if (command === 'seed') {
  let state;
  try { state = JSON.parse(await readFile(stateFile, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; state = { project: PROJECT_REF, users: {} }; }
  assert.equal(state.project, PROJECT_REF);
  for (const b of businesses) {
    let user = users.find(u => u.email === b.email);
    if (user) assert.equal(user.app_metadata.synthetic_fixture, FIXTURE_TAG, 'Refusing to take over existing user');
    let credentials = state.users[b.key];
    if (!credentials) {
      assert(!user, 'Existing fixture user has no local credentials. Recover credentials or clean fixtures first.');
      credentials = { email: b.email, password: randomBytes(30).toString('base64url') + 'aA1!' };
      state.users[b.key] = credentials;
      await writeFile(stateFile, JSON.stringify(state, null, 2), { mode: 0o600 });
      await chmod(stateFile, 0o600);
    }
    if (!user) {
      if (!/[!@#$%^&*]/.test(credentials.password)) credentials.password += 'aA1!';
      await writeFile(stateFile, JSON.stringify(state, null, 2), { mode: 0o600 });
      const result = await check(admin.auth.admin.createUser({ id: uid(`${b.key}:auth-user`), email: b.email, password: credentials.password, email_confirm: true,
        app_metadata: { synthetic_fixture: FIXTURE_TAG }, user_metadata: { first_name: 'Synthetic', last_name: b.key.toUpperCase() } }), 'create supported Auth user');
      user = result.user;
    }
    credentials.id = user.id;
    await writeFile(stateFile, JSON.stringify(state, null, 2), { mode: 0o600 });
    await upsert('organizations', [{ id: b.organizationId, name: b.name, type: 'business', branding: { synthetic_fixture: FIXTURE_TAG } }]);
    await upsert('organization_memberships', [{ id: uid(`${b.key}:membership`), organization_id: b.organizationId, user_id: user.id, role: 'owner' }]);
    await upsert('business_profiles', [{ id: b.id, organization_id: b.organizationId, business_name: b.name, industry: 'Beauty and aesthetics', onboarding_completed: true, onboarding_step: 5, target_cost_per_lead: '10', description: `Synthetic fixture ${FIXTURE_TAG}; fixed clock ${AS_OF}` }]);
    // Selectable imported connection; database guards prohibit credentials and queued sync.
    await upsert('platform_integrations', [{ id: b.integrationId, business_id: b.id, platform_id: platform.id, status: 'connected', connected_by_user_id: user.id,
      integration_details: { synthetic_fixture: FIXTURE_TAG, primary_ad_account_external_id: `${FIXTURE_TAG}-${b.key}-account`, primary_ad_account_name: b.name, account_selection_completed_at: NOW }, last_synced_at: NOW }]);
    await upsert('ad_accounts', [{ id: b.accountId, business_id: b.id, platform_id: platform.id, external_account_id: `${FIXTURE_TAG}-${b.key}-account`, name: b.name, status: 'active', timezone: 'America/New_York', currency_code: 'USD', last_synced: NOW }]);
    await upsert('ad_account_sync_state', [{ id: uid(`${b.key}:sync-state`), ad_account_id: b.accountId, first_activity_date: dayAt(-89), latest_activity_date: dayAt(-1), historical_data_available: true, has_meaningful_history: true, first_full_sync_completed: true, first_full_sync_at: NOW, insights_synced_through: AS_OF, dimensions_synced_at: NOW }]);
    await upsert('account_sync_jobs', [{ id: uid(`${b.key}:sync-job`), business_id: b.id, platform_integration_id: b.integrationId, ad_account_id: b.accountId, sync_type: 'initial_historical', status: 'completed', started_at: NOW, finished_at: NOW, actual_start_date: dayAt(-89), actual_end_date: AS_OF, metadata: { synthetic_fixture: FIXTURE_TAG, source: 'fixture import; no Meta request' } }]);
  }
  for (const m of media) await check(admin.storage.from(bucket).upload(`${prefix}/${m.key}.svg`, mediaSvg(m), { contentType: 'image/svg+xml', upsert: true }), 'upload synthetic media');
  await upsert('ad_creatives', fixture.creatives);
  for (const level of ['campaign', 'adset', 'ad']) await upsert('ad_entities', fixture.entities.filter(e => e.entity_level === level));
  // Remove only facts belonging to these validated fixture accounts, so regeneration
  // also removes obsolete dates/dimensions when the generator changes.
  for (const table of ['ad_entity_performance_daily', 'ad_entity_performance_summary', 'ad_entity_performance_hourly', 'ad_audience_breakdowns_summary']) {
    await check(admin.from(table).delete().in('ad_account_id', businesses.map(b => b.accountId)), `clear fixture ${table}`);
  }
  await upsert('ad_entity_performance_daily', fixture.daily, 'entity_id,day');
  await upsert('ad_entity_performance_summary', fixture.summaries, 'entity_id');
  await upsert('ad_entity_performance_hourly', fixture.hourly, 'entity_id,day,hour_of_day');
  await upsert('ad_audience_breakdowns_summary', fixture.audience, 'entity_id,breakdown_type,dimension_1_key,dimension_1_value,dimension_2_key,dimension_2_value');
  console.log(JSON.stringify({ seeded: FIXTURE_TAG, project: PROJECT_REF, asOf: AS_OF, entities: fixture.entities.length, daily: fixture.daily.length, hourly: fixture.hourly.length, audience: fixture.audience.length, credentialsFile: '.env.beta-fixtures.json (private; never commit)' }));
}
if (command === 'clean') {
  for (const b of businesses) {
    const user = users.find(u => u.email === b.email);
    if (user) assert.equal(user.app_metadata.synthetic_fixture, FIXTURE_TAG);
    for (const table of ['feature_snapshots','decision_runs','action_proposals','executed_actions','action_outcomes','autonomy_policies','shadow_evaluation_jobs','limited_auto_evaluations']) {
      const audit = await check(admin.schema('ai').from(table).select('business_id').eq('business_id', b.id).limit(1), 'check retained audit history');
      assert.equal(audit.length, 0, 'Cleanup refuses businesses with decision/audit history');
    }
    await check(admin.from('account_sync_jobs').delete().eq('business_id', b.id).eq('ad_account_id', b.accountId), 'delete synthetic sync imports');
    // Cascades are the deployed FKs. Audit records deliberately block cleanup if
    // somebody has subsequently evaluated/executed these fixtures; no audit erasure.
    await check(admin.from('organizations').delete().eq('id', b.organizationId), 'delete synthetic organization');
    if (user) await check(admin.auth.admin.deleteUser(user.id), 'delete supported Auth user');
  }
  await check(admin.storage.from(bucket).remove(media.map(m => `${prefix}/${m.key}.svg`)), 'remove fixture media');
  console.log('Synthetic businesses, Auth users and media removed. Private credentials remain available for reseeding.');
}
if (command === 'verify') {
  const state = JSON.parse(await readFile(stateFile, 'utf8'));
  const evidence = [];
  for (const b of businesses) {
    const client = anon(), other = businesses.find(x => x.id !== b.id);
    const credentials = state.users[b.key];
    await check(client.auth.signInWithPassword({ email: credentials.email, password: credentials.password }), 'normal Auth sign in');
    const own = await check(client.from('business_profiles').select('id').eq('id', b.id), 'read own business');
    assert.equal(own.length, 1);
    const hidden = await check(client.from('business_profiles').select('id').eq('id', other.id), 'read other business');
    assert.equal(hidden.length, 0);
    const membership = await check(client.rpc('is_org_member', { p_organization_id: other.organizationId }), 'foreign membership');
    assert.equal(membership, false);
    for (const account of [other.accountId, uid('invalid-account')]) assert.equal(await check(client.rpc('can_access_ad_account', { p_ad_account_id: account }), 'invalid account'), false);
    for (const table of ['ad_accounts', 'ad_entities', 'ad_creatives', 'platform_integrations']) {
      const rows = await pages((from, to) => client.from(table).select('business_id').order('id').range(from, to));
      assert(rows.length > 0, `No own ${table}`); assert(rows.every(r => r.business_id === b.id), `${table} tenant leak`);
    }
    const rows = await pages((from, to) => client.from('ad_entity_performance_daily').select('*').eq('entity_level', 'adset').order('entity_id').order('day').range(from, to));
    assert(rows.every(r => r.ad_account_id === b.accountId), 'Performance tenant leak');
    const expected = fixture.daily.filter(r => r.entity_level === 'adset' && r.ad_account_id === b.accountId);
    assert.equal(rows.length, expected.length);
    assert.deepEqual(totals(rows), totals(expected));
    for (const table of ['ad_entity_performance_hourly', 'ad_entity_performance_summary', 'ad_audience_breakdowns_summary', 'report_entity_daily_v', 'meta_hourly_performance', 'meta_audience_breakdowns_daily']) {
      const visible = await pages((from, to) => client.from(table).select('ad_account_id').order('entity_id').range(from, to));
      assert(visible.length > 0 && visible.every(r => r.ad_account_id === b.accountId), `${table} tenant leak or empty`);
    }
    const rpc = { p_ad_account_ids: [b.accountId], p_entity_level: 'adset', p_date_from: dayAt(-7), p_date_to: dayAt(-1) };
    const report = await check(client.rpc('get_report_metric_rows', rpc), 'report RPC');
    const recent = expected.filter(r => r.day >= dayAt(-7) && r.day <= dayAt(-1));
    assert.equal(totals(report).spend, totals(recent).spend);
    assert.equal((await check(client.rpc('get_report_metric_rows', { ...rpc, p_ad_account_ids: [other.accountId] }), 'foreign report RPC')).length, 0);
    assert.equal((await check(client.rpc('get_report_metric_rows', { ...rpc, p_date_from: '2020-01-01', p_date_to: '2020-01-07' }), 'missing data RPC')).length, 0);
    const job = await admin.from('account_sync_jobs').insert({ id: uid(`${b.key}:forbidden-job`), business_id: b.id, platform_integration_id: b.integrationId, ad_account_id: b.accountId, sync_type: 'manual_refresh', status: 'queued' });
    assert.equal(job.error?.code, '23514', 'Synthetic jobs must be rejected even for service role');
    const badCreative = await admin.from('ad_creatives').insert({ id: uid(`${b.key}:forbidden-creative`), business_id: b.id, ad_account_id: other.accountId, platform_creative_id: `${FIXTURE_TAG}-forbidden` });
    assert.equal(badCreative.error?.code, '23503', 'Cross-business creative must fail at the FK boundary');
    const badMetric = await admin.from('ad_entity_performance_daily').insert({ entity_id: uid(`${b.key}:adset-0`), ad_account_id: other.accountId, entity_level: 'adset', day: '2020-01-01' });
    assert.equal(badMetric.error?.code, '23503', 'Cross-account metric must fail at the FK boundary');
    const tokenWrite = await admin.from('platform_integrations').update({ access_token_secret_id: uid('synthetic-secret') }).eq('id', b.integrationId);
    assert.equal(tokenWrite.error?.code, '23514', 'Synthetic integration must reject credentials');
    const invalidMembership = await client.from('organization_memberships').insert({ organization_id: other.organizationId, user_id: credentials.id, role: 'owner' });
    assert(invalidMembership.error, 'Foreign membership insertion must fail');
    const integrationMutation = await client.from('platform_integrations').update({ access_token_secret_id: uid('invalid-secret') }).eq('id', b.integrationId);
    assert(integrationMutation.error, 'Browser integration mutation must fail');
    for (const restricted of [client, anon()]) {
      const token = await restricted.rpc('get_platform_token', { secret_id: uid('invalid-secret') });
      assert(token.error && /permission denied/.test(token.error.message), 'Token RPC must reject browser clients');
      const approval = await restricted.rpc('accept_calendar_queue_workflow', { p_queue_item_id: uid('missing-queue-item'), p_user_id: credentials.id });
      assert(approval.error && /permission denied/.test(approval.error.message), 'Approval RPC must reject browser clients');
    }
    assert(rows.filter(r => r.day === AS_OF).every(r => r.spend === 0 && r.impressions === 0));
    evidence.push({ business: b.key, userId: credentials.id, businessId: b.id, accountId: b.accountId, adsetDailyRows: rows.length, totals: totals(rows), recent7: totals(recent), normalClientIsolation: 'passed' });
    await client.auth.signOut();
  }
  const anonymousRows = await check(anon().from('ad_entities').select('id').limit(1), 'anonymous entity read');
  assert.equal(anonymousRows.length, 0);
  const privacy = await check(admin.storage.getBucket('report-archive-pdfs'), 'archive privacy');
  assert.equal(privacy.public, false);
  for (const m of media) {
    const response = await fetch(`${mediaBase}/${m.key}.svg`);
    assert(response.ok && /image\/svg/.test(response.headers.get('content-type')), 'Synthetic media unavailable');
  }
  await mkdir(new URL('../../docs/beta-readiness/', import.meta.url), { recursive: true });
  await writeFile(new URL('../../docs/beta-readiness/fixture-verification.json', import.meta.url), JSON.stringify({ project: PROJECT_REF, asOf: AS_OF, evidence }, null, 2) + '\n');
  console.log(JSON.stringify({ verified: true, evidence }, null, 2));
}
