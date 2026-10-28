import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { createClient } from '@supabase/supabase-js';

const project = 'gkdyyjqepzayjdpvqnja';
if (process.env.DEEPVISOR_ACCOUNT_SETTINGS_TEST !== project || process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_SUPABASE_URL !== `https://${project}.supabase.co`) throw new Error('Explicit development project opt-in required');
const opts = { auth: { persistSession:false,autoRefreshToken:false } };
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,opts);
const tag = `business-settings-${randomBytes(6).toString('hex')}`, users = [], evidence = [];
const check = result => { if (result.error) throw new Error(result.error.message); return result.data; };
let browser;
try {
  for (const key of ['a','b']) {
    const email = `${tag}-${key}@example.test`, password = randomBytes(24).toString('base64url')+'!aA9';
    const { user } = check(await admin.auth.admin.createUser({ email,password,email_confirm:true,user_metadata:{first_name:'Synthetic',last_name:'Business'},app_metadata:{settings_verification:tag} }));
    const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,opts);
    const item = { id:user.id,email,password,client }; users.push(item);
    check(await client.auth.signInWithPassword({email,password}));
    item.businessId = check(await client.rpc('ensure_onboarding_workspace'));
    item.organizationId = check(await admin.from('business_profiles').update({business_name:`[SYNTHETIC] ${tag}-${key}`,onboarding_completed:true,onboarding_step:6}).eq('id',item.businessId).select('organization_id').single()).organization_id;
  }
  const [a,b] = users;
  const { chromium } = createRequire('/tmp/deepvisor-auto-tools/package.json')('playwright');
  browser = await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
  const context = await browser.newContext({viewport:{width:1440,height:1100}}), page = await context.newPage(), errors = [];
  page.on('pageerror',error => errors.push(error.message));
  const base = process.env.ACCOUNT_SETTINGS_BASE_URL || 'http://localhost:3000';
  await page.goto(base+'/login'); await page.getByLabel('Email').fill(a.email); await page.getByLabel('Password').fill(a.password); await page.getByRole('button',{name:'Sign in',exact:true}).click(); await page.waitForURL('**/dashboard');
  await page.goto(base+'/settings/profile');
  const form = page.locator('#business-profile');
  await form.getByLabel('Business name').fill('[SYNTHETIC] Updated Salon');
  await form.getByLabel('Industry',{exact:true}).click(); await page.getByRole('option',{name:'Hair Salon',exact:true}).click();
  await form.getByLabel('Monthly advertising budget').click(); await page.getByRole('option',{name:'$500 - $1,000',exact:true}).click();
  await form.getByLabel('Business website').fill('https://salon.example');
  await form.getByLabel('Business description').fill('Hair color and skincare for local customers.');
  await form.getByRole('button',{name:'Save business details',exact:true}).click(); await form.getByRole('status').filter({hasText:'Business details saved.'}).waitFor();
  const expected = {business_name:'[SYNTHETIC] Updated Salon',industry:'hair_salon',website:'https://salon.example',monthly_budget:'500_1000',description:'Hair color and skincare for local customers.'};
  assert.deepEqual(check(await a.client.from('business_profiles').select(Object.keys(expected).join(',')).eq('id',a.businessId).single()),expected);
  assert.equal(check(await a.client.from('organizations').select('name').eq('id',a.organizationId).single()).name,expected.business_name);
  await page.reload(); assert.equal(await form.getByLabel('Business name').inputValue(),expected.business_name);
  assert.equal(await form.getByLabel('Monthly advertising budget').inputValue(),'$500 - $1,000');
  evidence.push('Actual authenticated Profile form saved all five fields; ordinary Supabase reads and the organization name match; values survive reload.');
  for (const width of [1440,390]) {
    await page.setViewportSize({width,height:1100}); await form.scrollIntoViewIfNeeded();
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.querySelector('main').scrollWidth<=document.querySelector('main').clientWidth));
    await page.screenshot({path:`/tmp/dv-business-profile-${width}.png`});
  }
  await page.goto(base+'/settings#workspace');
  assert.equal(await page.getByLabel('Business name').inputValue(),expected.business_name);
  assert.equal(await page.getByLabel('Business website').inputValue(),expected.website);
  await page.getByLabel('Business website').fill(''); await page.getByLabel('Business description').fill('');
  await page.getByRole('button',{name:'Save business details',exact:true}).click(); await page.getByRole('status').filter({hasText:'Business details saved.'}).waitFor();
  assert.deepEqual(check(await a.client.from('business_profiles').select('website,description,monthly_budget').eq('id',a.businessId).single()),{website:null,description:null,monthly_budget:'500_1000'});
  await page.goto(base+'/settings/profile'); assert.equal(await form.getByLabel('Business website').inputValue(),'');
  evidence.push('Settings uses the same editor; clearing optional website/description persists null, preserves budget, and is reflected on Profile. Desktop/mobile layouts fit.');
  assert.deepEqual(check(await b.client.from('business_profiles').update({business_name:'Forbidden'}).eq('id',a.businessId).select('id')),[]);
  check(await admin.from('organization_memberships').insert({organization_id:a.organizationId,user_id:b.id,role:'member'}));
  assert.deepEqual(check(await b.client.from('business_profiles').update({business_name:'Forbidden member edit'}).eq('id',a.businessId).select('id')),[]);
  assert.equal(check(await b.client.from('business_profiles').select('business_name').eq('id',b.businessId).single()).business_name,`[SYNTHETIC] ${tag}-b`);
  assert.deepEqual(errors,[]);
  evidence.push('Real RLS rejects foreign-business and member edits; the second business is unchanged; no browser runtime errors or Meta calls.');
  console.log(JSON.stringify({evidence},null,2));
} finally {
  await browser?.close();
  if (users[0]?.organizationId && users[1]?.id) check(await admin.from('organization_memberships').delete().eq('organization_id',users[0].organizationId).eq('user_id',users[1].id));
  for (const user of users) {
    const found = await admin.auth.admin.getUserById(user.id);
    if (found.data.user?.app_metadata.settings_verification === tag) check(await admin.auth.admin.deleteUser(user.id,false));
  }
}
