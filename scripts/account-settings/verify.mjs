// Explicit, disposable development users only. No existing fixture user is changed.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { createClient } from '@supabase/supabase-js';

const project = 'gkdyyjqepzayjdpvqnja';
if (process.env.DEEPVISOR_ACCOUNT_SETTINGS_TEST !== project || process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_SUPABASE_URL !== `https://${project}.supabase.co`) throw new Error('Explicit development-project opt-in required');
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, options);
const ordinary = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, options);
const tag = `account-settings-${randomBytes(6).toString('hex')}`;
const users = [], evidence = [];
let browser;
function check(response) { if (response.error) throw new Error(response.error.message); return response.data; }
try {
  for (const key of ['a','b']) {
    const email = `${tag}-${key}@example.test`, password = randomBytes(24).toString('base64url') + '!aA9';
    const { user } = check(await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { first_name: 'Synthetic', last_name: 'Settings' }, app_metadata: { settings_verification: tag } }));
    users.push({ id:user.id, email, password, client:ordinary(), deleted:false });
    const current = users.at(-1);
    check(await current.client.auth.signInWithPassword({ email, password }));
    current.businessId = check(await current.client.rpc('ensure_onboarding_workspace'));
    const business = check(await admin.from('business_profiles').update({ business_name: `[SYNTHETIC] ${tag}-${key}`, onboarding_completed:true, onboarding_step:6 }).eq('id',current.businessId).select('organization_id').single());
    current.orgId = business.organization_id;
  }
  const [a,b] = users;
  check(await a.client.from('users').update({ first_name:'Database',last_name:'Verified',phone_number:'+1 202 555 0100' }).eq('id',a.id));
  assert.deepEqual(check(await a.client.from('users').select('first_name,phone_number').eq('id',a.id).single()), { first_name:'Database',phone_number:'+1 202 555 0100' });
  assert.deepEqual(check(await a.client.from('users').update({ first_name:'Forbidden' }).eq('id',b.id).select('id')), []);
  assert.deepEqual(check(await a.client.from('users').select('id').eq('id',b.id)), []);
  for (const patch of [{ status:'admin' },{ email:'forged@example.test' }]) assert.equal((await a.client.from('users').update(patch).eq('id',a.id)).error?.code,'42501');
  assert.equal((await a.client.rpc('assert_account_deletable',{ p_user:b.id })).error?.code,'42501');
  evidence.push('Ordinary authenticated RLS: own edits persist; foreign reads/edits are empty; status/email mutation and privileged RPC are denied.');

  const sharedOrg = check(await admin.from('organizations').insert({ name:`[SYNTHETIC] ${tag}-shared`,type:'business' }).select('id').single());
  check(await admin.from('organization_memberships').insert([{ organization_id:sharedOrg.id,user_id:a.id,role:'owner' },{ organization_id:sharedOrg.id,user_id:b.id,role:'member' }]));
  const sharedBusiness = check(await admin.from('business_profiles').insert({ organization_id:sharedOrg.id,business_name:`[SYNTHETIC] ${tag}-shared`,onboarding_completed:true }).select('id').single());
  assert.equal((await admin.rpc('assert_account_deletable',{ p_user:a.id })).error?.message,'ACCOUNT_DELETE_LAST_OWNER');
  const deniedDelete = await admin.auth.admin.deleteUser(a.id,false);
  assert.ok(deniedDelete.error); assert.ok(check(await admin.auth.admin.getUserById(a.id)).user);
  evidence.push('Real Auth Admin deletion cannot bypass the shared-last-owner guard; failed deletion leaves the account intact.');

  const { chromium } = createRequire('/tmp/deepvisor-auto-tools/package.json')('playwright');
  browser = await chromium.launch({ executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true });
  const context = await browser.newContext({ viewport:{ width:1440,height:1000 } });
  const page = await context.newPage(); const errors = [];
  page.on('pageerror',error => errors.push(error.message));
  const base = process.env.ACCOUNT_SETTINGS_BASE_URL || 'http://localhost:3000';
  await page.goto(base+'/login'); await page.getByLabel('Email').fill(a.email); await page.getByLabel('Password').fill(a.password);
  await page.getByRole('button',{ name:'Sign in',exact:true }).click(); await page.waitForURL('**/dashboard');
  await page.goto(base+'/settings');
  await page.getByLabel('First name').fill('Browser'); await page.getByLabel('Last name').fill('Verified'); await page.getByLabel('Phone number').fill('+1 202 555 0199');
  await page.getByRole('button',{ name:'Save profile',exact:true }).click(); await page.getByRole('status').filter({ hasText:'Profile saved.' }).waitFor();
  assert.equal(check(await a.client.from('users').select('first_name').eq('id',a.id).single()).first_name,'Browser');
  await page.reload(); assert.equal(await page.getByLabel('First name').inputValue(),'Browser');
  for (const width of [1440,390]) {
    await page.setViewportSize({ width,height:1000 });
    await page.getByLabel('First name').scrollIntoViewIfNeeded();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.ok(await page.getByRole('button',{ name:'Save profile',exact:true }).isVisible());
  }
  await page.goto(base+'/settings/profile'); assert.equal(await page.getByLabel('First name').inputValue(),'Browser');
  evidence.push('Desktop/mobile authenticated Settings and Profile show persisted edits, survive reload, and have no horizontal overflow.');
  await page.goto(base+'/settings'); await page.getByRole('button',{ name:'Delete my account',exact:true }).click();
  assert.ok(await page.getByRole('button',{ name:'Permanently delete account',exact:true }).isDisabled());
  await page.getByLabel('Type DELETE to confirm').fill('DELETE'); await page.getByRole('button',{ name:'Permanently delete account',exact:true }).click();
  await page.getByRole('alert').filter({ hasText:'Transfer ownership' }).waitFor();
  check(await admin.from('organization_memberships').update({ role:'owner' }).eq('organization_id',sharedOrg.id).eq('user_id',b.id));
  await page.getByRole('button',{ name:'Permanently delete account',exact:true }).click(); await page.waitForURL('**/login?account_deleted=1'); a.deleted = true;
  assert.ok((await admin.auth.admin.getUserById(a.id)).error);
  assert.deepEqual(check(await admin.from('users').select('id').eq('id',a.id)),[]);
  assert.deepEqual(check(await admin.from('organizations').select('id').eq('id',a.orgId)),[]);
  assert.deepEqual(check(await admin.from('business_profiles').select('id').eq('id',a.businessId)),[]);
  assert.equal(check(await b.client.from('business_profiles').select('id').eq('id',sharedBusiness.id).single()).id,sharedBusiness.id);
  assert.equal(check(await b.client.from('business_profiles').select('id').eq('id',b.businessId).single()).id,b.businessId);
  await page.goto(base+'/settings'); await page.waitForURL('**/login**');
  assert.deepEqual(errors,[]);
  evidence.push('Browser deletion requires exact confirmation, reports last-owner restriction, then deletes via Auth after ownership transfer. Solo data disappears; shared and other-business data survive; protected pages redirect.');

  const confirmedEmail = `${tag}-confirmed@example.test`;
  check(await admin.auth.admin.updateUserById(b.id,{ email:confirmedEmail,email_confirm:true }));
  assert.equal(check(await admin.from('users').select('email').eq('id',b.id).single()).email,confirmedEmail);
  evidence.push('Official Auth Admin confirmed email update synchronizes public.users; real email delivery/link confirmation was not exercised.');
  console.log(JSON.stringify({ evidence, screenshots:'None retained', externalMetaCalls:0 },null,2));
} finally {
  await browser?.close();
  for (const user of users) {
    if (user.deleted) continue;
    const found = await admin.auth.admin.getUserById(user.id);
    if (found.data.user?.app_metadata.settings_verification !== tag) continue;
    // On early failure, grant the other disposable member ownership so cleanup
    // remains possible without changing any existing workspace or real user.
    for (const other of users.filter(other => other.id !== user.id && !other.deleted)) {
      const memberships = check(await admin.from('organization_memberships').select('organization_id').eq('user_id',user.id));
      for (const m of memberships) check(await admin.from('organization_memberships').update({ role:'owner' }).eq('organization_id',m.organization_id).eq('user_id',other.id));
    }
    check(await admin.auth.admin.deleteUser(user.id,false)); user.deleted = true;
  }
}
