import assert from 'node:assert/strict';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
const exec = promisify(execFile);
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { state, save, adminClient, tag } from './state.mjs';
const require = createRequire('/tmp/deepvisor-phase2-tools/package.json');
const { chromium } = require('playwright');
const data = await state();
const admin = adminClient();
// Never replay a partially or fully executed audit chain on a resumed run.
if (data.users[0]?.businessId) {
  const audit = await admin.schema('ai').from('executed_actions').select('id').eq('business_id', data.users[0].businessId).limit(1);
  if (audit.error) throw audit.error;
  if (audit.data.length) throw new Error('Existing execution audit preserved. Use checks.mjs, or archive the private manifest for a fresh synthetic journey.');
}
const base = 'http://localhost:3011';
const out = new URL('../../docs/beta-readiness/phase5/', import.meta.url);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
page.setDefaultTimeout(20000);
const errors = [];
page.on('pageerror', e => errors.push(e.message));
const evidence = [];
async function shot() {} // No screenshot files are retained.
async function select(label, option) {
  const field = page.getByRole('textbox',{name:label,exact:false});
  if (await field.inputValue() === option) return;
  await field.click();
  await page.getByRole('option',{name:option,exact:false}).click();
}
try {
  for (const user of data.users) {
    if (!user.id) {
      await page.goto(`${base}/sign-up`);
      await page.getByLabel('First name').fill('Synthetic Phase Five');
      await page.getByLabel('Email').fill(user.email);
      await page.getByLabel('Password').fill(user.password);
      await page.getByRole('button',{name:'Create account',exact:true}).click();
      await page.waitForURL('**/login');
      const {data:listed,error}=await admin.auth.admin.listUsers({perPage:1000});
      if(error)throw error;
      const registered=listed.users.find(u=>u.email===user.email);
      if(!registered)throw new Error('Fresh signup did not create a user');
      user.id=registered.id; await save(data);
      evidence.push(`${user.key}: fresh signup through browser`);
    }
    const {data:current,error:readError}=await admin.auth.admin.getUserById(user.id);
    if(readError)throw readError;
    if(!current.user.email_confirmed_at) {
      await page.goto(`${base}/login`);
      await page.getByLabel('Email').fill(user.email);
      await page.getByLabel('Password').fill(user.password);
      await page.getByRole('button',{name:'Sign in',exact:true}).click();
      await page.getByRole('button',{name:'Resend verification email'}).waitFor();
      evidence.push(`${user.key}: unverified login rejected`);
      const link=await admin.auth.admin.generateLink({type:'signup',email:user.email,password:user.password});
      if(link.error)throw link.error;
      await page.goto(`${base}/api/auth/verification?token_hash=${encodeURIComponent(link.data.properties.hashed_token)}&type=signup`);
      await page.waitForURL('**/onboarding');
      evidence.push(`${user.key}: real verification token consumed by application callback (email transport untested)`);
    } else {
      await page.goto(`${base}/login`);
      await page.getByLabel('Email').fill(user.email);
      await page.getByLabel('Password').fill(user.password);
      await page.getByRole('button',{name:'Sign in',exact:true}).click();
      await page.waitForURL(url=>['/onboarding','/dashboard'].includes(url.pathname));
    }
    const marked=await admin.auth.admin.updateUserById(user.id,{app_metadata:{[tag]:{scenario:'multiple',revision:0,anchorDay:new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}}});
    if(marked.error)throw marked.error;
    if(new URL(page.url()).pathname==='/onboarding') {
      const essentials=page.getByLabel('Business name');
      if(await essentials.isVisible()) {
        await essentials.fill(`[SIMULATED] Phase 5 Salon ${user.key.toUpperCase()}`);
        await select('Main service','Hair color');
        await page.getByLabel('Service address').fill('123 Synthetic Street, Tampa, FL');
        await select('Customer radius','Within 5 miles');
        await select('Preferred contact path','Phone calls');
        await select('Monthly ad budget','$500 - $1,000');
        await page.getByRole('button',{name:'Save and continue'}).click();
        await page.getByRole('button',{name:'Skip for now'}).waitFor();
        await page.reload();
        await page.getByRole('button',{name:'Back to business essentials'}).click();
        await page.getByLabel('Business name').waitFor();
        if(await page.getByLabel('Business name').inputValue()!==`[SIMULATED] Phase 5 Salon ${user.key.toUpperCase()}`)throw new Error('Draft was lost');
        await page.getByRole('button',{name:'Save and continue'}).click();
        await page.getByRole('button',{name:'Skip for now'}).waitFor();
        evidence.push(`${user.key}: onboarding draft, refresh and backward navigation persisted`);
      }
      {
        await page.getByRole('button',{name:'Skip for now'}).click();
        await page.waitForURL('**/dashboard'); await shot('b-disconnected');
        evidence.push('a: skipped Meta and reached disconnected Dashboard');
        await page.goto(`${base}/integration`);
      }
    }
    // The authenticated connect route uses the server-managed designation, one-time state and real downstream discovery.
    const returnTo=new URL(page.url()).pathname==='/onboarding'?'/onboarding':'/integration';
    await page.goto(`${base}/api/integrations/connect/meta?returnTo=${returnTo}`);
    if(user.key==='a') {
      await page.getByRole('textbox',{name:'Primary Meta ad account'}).waitFor();
      await select('Primary Meta ad account','[SIMULATED] Salon account 1');
      const response=page.waitForResponse(r=>r.url().includes('/select-ad-account')&&r.request().method()==='POST',{timeout:180000});
      response.catch(() => {});
      await page.getByRole('button',{name:'Select primary account and start sync'}).click();
      const selected=await response;const body=await selected.json();
      if(!body.success)throw new Error(`Selection failed: ${JSON.stringify(body)}`);
      evidence.push(`a: selected account and sync ${body.data.firstSyncJob?.status ?? 'completed follow-up'}`);
    } else {
      const response=await page.waitForResponse(r=>r.url().includes('/select-ad-account')&&r.request().method()==='POST',{timeout:180000});
      const body=await response.json();if(!body.success)throw new Error(`Auto selection failed: ${JSON.stringify(body)}`);
      evidence.push(`b: single account automatic selection and sync ${body.data.firstSyncJob?.status ?? 'completed follow-up'}`);
    }
    if(returnTo==='/onboarding') {
      await page.getByRole('button',{name:'Finish setup'}).click();
      await page.waitForURL('**/dashboard');
    } else await page.goto(`${base}/dashboard`);
    await page.getByRole('heading',{name:`[SIMULATED] Phase 5 Salon ${user.key.toUpperCase()}`,exact:true}).waitFor();
    await shot(`${user.key}-dashboard`);
    await page.reload();
    await page.getByRole('heading',{name:`[SIMULATED] Phase 5 Salon ${user.key.toUpperCase()}`,exact:true}).waitFor();
    evidence.push(`${user.key}: persisted Dashboard loaded and refreshed`);
    const membership=await admin.from('organization_memberships').select('organization_id').eq('user_id',user.id).single();
    if(membership.error)throw membership.error;
    user.organizationId=membership.data.organization_id;
    const profile=await admin.from('business_profiles').select('id').eq('organization_id',user.organizationId).single();
    if(profile.error)throw profile.error;user.businessId=profile.data.id;await save(data);
    async function stage(name) {
      const result=await exec(process.execPath,['--env-file=.env.local','node_modules/vitest/vitest.mjs','run','src/lib/server/betaPhase5.live.test.ts'],{env:{...process.env,DEEPVISOR_PHASE5:'gkdyyjqepzayjdpvqnja',PHASE5_STAGE:name},timeout:120000,maxBuffer:1024*1024});
      await writeFile(new URL(`intelligence-${name}.log`,out),result.stdout);
    }
    for(const route of ['/campaigns','/reports','/settings']){
      await page.goto(base+route,{waitUntil:'networkidle'});
      assert.ok(!(await page.locator('body').innerText()).includes('Application error'));
      evidence.push(`Authenticated ${route} loaded`);
    }
    await page.getByRole('link',{name:'Send feedback',exact:true}).waitFor();
    assert.ok((await page.getByRole('link',{name:'Send feedback',exact:true}).getAttribute('href')).startsWith('mailto:info@deepvisor.com'));
    const own=(await admin.from('ad_accounts').select('id,external_account_id').eq('business_id',user.businessId).order('external_account_id')).data;
    const params=`ad_account_id=${own[0].id}&date_from=2026-10-01&date_to=2026-10-19`;
    for(const format of ['csv','pdf']){
      const response=await context.request.get(`${base}/api/reports/${format}?${params}`);
      assert.equal(response.status(),200);const body=await response.body();assert.ok(body.length>200);
      await writeFile(new URL(`journey.${format}`,out),body);evidence.push(`Authenticated ${format} export generated`);
    }
    const forbidden=await context.request.get(`${base}/api/reports/csv?ad_account_id=7e365a93-b133-4574-aa86-89deb51030bf`);assert.equal(forbidden.status(),403);
    const executeForbidden=await context.request.post(`${base}/api/decisions/proposals/00000000-0000-4000-8000-000000000000/execute`);assert.equal(executeForbidden.status(),403);
    const stored=JSON.parse(await (await import('node:fs/promises')).readFile(new URL('../../.env.beta-phase5.json',import.meta.url),'utf8'));
    const proposed=stored.proposals?.map(p=>p.id) ?? [];
    const existing=proposed.length===3 ? await admin.schema('ai').from('action_proposals').select('id').in('id',proposed) : null;
    if(existing?.data?.length!==3) await stage('prepare');
    await page.goto(`${base}/decisions`,{waitUntil:'networkidle'});
    const reject=page.locator('article').filter({has:page.getByRole('heading',{name:'Review pausing this ad set',exact:true})}).getByRole('button',{name:'Reject',exact:true});
    if(await reject.count()) await reject.click();
    await page.getByText('Rejected',{exact:true}).first().waitFor();
    const approve=page.locator('article').filter({has:page.getByRole('button',{name:'Approve',exact:true})}).getByRole('button',{name:'Approve',exact:true});
    if(await approve.count()) await approve.click();
    await page.getByText('Approved · Not executed',{exact:true}).waitFor();
    evidence.push('Fresh synced-account proposals rejected and approved through browser server actions');
    await stage('execute');
    await page.reload({waitUntil:'networkidle'});await page.getByText('Simulated execution',{exact:true}).first().waitFor();
    await page.getByText('Outcome observations',{exact:true}).first().click();await page.getByText('1h: Waiting for observations',{exact:true}).waitFor();
    evidence.push('Fake execution persisted exactly once; pending outcome tracking displayed');
    await page.goto(`${base}/integration`);await page.getByRole('button',{name:'Change ad account',exact:true}).first().click();
    const picker=page.getByRole('textbox',{name:/Primary Meta ad account|Discovered Meta ad accounts/});await picker.click();
    await page.getByRole('option',{name:'[SIMULATED] Salon account 2',exact:false}).click();
    const switched=page.waitForResponse(r=>r.url().includes('/select-ad-account')&&r.request().method()==='POST',{timeout:180000});
    await page.getByRole('button',{name:/Select primary account and start sync|Save and sync account/}).click();assert.equal((await (await switched).json()).success,true);
    await page.goto(`${base}/dashboard`,{waitUntil:'networkidle'});await page.reload({waitUntil:'networkidle'});
    await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.setViewportSize({width:1440,height:1000});
    evidence.push('Second account selection persisted; mobile Dashboard has no page overflow');
    await page.getByRole('button',{name:'Log out',exact:true}).focus();
    await page.keyboard.press('Enter');
    await page.waitForURL('**/login');
    await page.goto(`${base}/dashboard`);await page.waitForURL('**/login');
    evidence.push(`${user.key}: logout removes access to protected Dashboard`);
    for(const route of ['/api/reports/csv','/api/reports/pdf','/api/sync/refresh']){
      const response=await context.request.get(base+route,{maxRedirects:0});assert.ok([401,403,307].includes(response.status()));if(response.status()===307)assert.ok(response.headers().location.endsWith('/login'));
    }
    await page.getByLabel('Email').fill(user.email);await page.getByLabel('Password').fill(user.password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.waitForURL('**/dashboard');
    evidence.push('Login after logout restores the authenticated workspace');

  }
  assert.deepEqual(errors,[]);
} catch(error) {
  await shot('failure');
  console.log('Page state',new URL(page.url()).pathname,(await page.locator('body').innerText()).slice(-1800));
  throw error;
} finally {
  await writeFile(new URL('errors.json',out),JSON.stringify(errors,null,2));
  await writeFile(new URL('evidence.json',out),JSON.stringify(evidence,null,2));
  console.log(JSON.stringify({evidence,errors},null,2));
  await browser.close();
}
