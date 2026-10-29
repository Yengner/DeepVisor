import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { state, save, adminClient, tag } from './state.mjs';
const require = createRequire('/tmp/deepvisor-phase2-tools/package.json');
const { chromium } = require('playwright');
const data = await state();
const admin = adminClient();
const base = 'http://localhost:3011';
const out = new URL('../../docs/beta-readiness/phase2-browser/', import.meta.url);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
page.setDefaultTimeout(20000);
const errors = [];
page.on('pageerror', e => errors.push(e.message));
const evidence = [];
async function shot(name) { await page.screenshot({path:new URL(`${name}.png`,out).pathname,fullPage:true}); }
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
      await page.getByLabel('First name').fill('Synthetic Phase Two');
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
    const marked=await admin.auth.admin.updateUserById(user.id,{app_metadata:{[tag]:{scenario:user.key==='a'?'multiple':'single',revision:0}}});
    if(marked.error)throw marked.error;
    if(new URL(page.url()).pathname==='/onboarding') {
      const essentials=page.getByLabel('Business name');
      if(await essentials.isVisible()) {
        await essentials.fill(`[SIMULATED] Phase 2 Salon ${user.key.toUpperCase()}`);
        await select('Profession','Hair stylist');
        await page.getByLabel('Service address').fill('123 Synthetic Street, Tampa, FL');
        await select('Customer radius','Within 5 miles');
        await select('Preferred contact path','Phone calls');
        await select('Monthly ad budget','$500 - $1,000');
        await page.getByRole('button',{name:'Save and continue'}).click();
        await page.getByRole('button',{name:'Skip for now'}).waitFor();
        await page.reload();
        await page.getByRole('button',{name:'Back to business essentials'}).click();
        await page.getByLabel('Business name').waitFor();
        if(await page.getByLabel('Business name').inputValue()!==`[SIMULATED] Phase 2 Salon ${user.key.toUpperCase()}`)throw new Error('Draft was lost');
        await page.getByRole('button',{name:'Save and continue'}).click();
        await page.getByRole('button',{name:'Skip for now'}).waitFor();
        evidence.push(`${user.key}: onboarding draft, refresh and backward navigation persisted`);
      }
      if(user.key==='b') {
        await page.getByRole('button',{name:'Skip for now'}).click();
        await page.waitForURL('**/dashboard'); await shot('b-disconnected');
        evidence.push('b: skipped Meta and reached disconnected Dashboard');
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
    await page.getByRole('heading',{name:`[SIMULATED] Phase 2 Salon ${user.key.toUpperCase()}`,exact:true}).waitFor();
    await shot(`${user.key}-dashboard`);
    await page.reload();
    await page.getByRole('heading',{name:`[SIMULATED] Phase 2 Salon ${user.key.toUpperCase()}`,exact:true}).waitFor();
    evidence.push(`${user.key}: persisted Dashboard loaded and refreshed`);
    const membership=await admin.from('organization_memberships').select('organization_id').eq('user_id',user.id).single();
    if(membership.error)throw membership.error;
    user.organizationId=membership.data.organization_id;
    const profile=await admin.from('business_profiles').select('id').eq('organization_id',user.organizationId).single();
    if(profile.error)throw profile.error;user.businessId=profile.data.id;await save(data);
    await page.getByRole('button',{name:'Log out',exact:true}).focus();
    await page.keyboard.press('Enter');
    await page.waitForURL('**/login');
    await page.goto(`${base}/dashboard`);await page.waitForURL('**/login');
    evidence.push(`${user.key}: logout removes access to protected Dashboard`);
  }
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
