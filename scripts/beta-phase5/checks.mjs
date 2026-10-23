import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
import { state, adminClient, tag } from './state.mjs';
const { chromium } = createRequire('/tmp/deepvisor-phase2-tools/package.json')('playwright');
const data=await state(), user=data.users[0], admin=adminClient(), base='http://localhost:3011';
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}}), page=await context.newPage();
const errors=[], evidence=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(base+'/login');await page.getByLabel('Email').fill(user.email);await page.getByLabel('Password').fill(user.password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.waitForURL('**/dashboard');
 const accounts=await admin.from('ad_accounts').select('id').eq('business_id',user.businessId).like('external_account_id','%_2');if(accounts.error)throw accounts.error;
 assert.ok((await page.locator('body').innerText()).includes('[SIMULATED] Salon account 2'));
 // Dashboard sections stream after the route shell; wait for the actual KPI values.
 await page.locator('dd[title="$480.00"]').first().waitFor();
 await page.locator('dd[title="48"]').first().waitFor();
 await page.locator('dd[title="$10.00"]').first().waitFor();
 await page.getByRole('button').filter({hasText:'[SIMULATED] Salon account 2'}).first().waitFor();
 assert.equal(await page.getByRole('button').filter({hasText:'[SIMULATED] Salon account 1'}).count(),0);
 evidence.push('Selected second account: 7D Dashboard $480 spend / 48 results / $10 CPR (six completed days plus today).');
 evidence.push('Header and Dashboard agree on the persisted primary account after login without selection cookies.');
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:1000});
  await page.waitForFunction(()=>[...document.images].some(i=>i.src.includes('brand')&&i.complete&&i.naturalWidth>0));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 }
 assert.ok((await page.title()).includes('DeepVisor'));
 for(const path of ['/favicon.ico','/apple-icon.png','/images/brand/deepvisor-app-icon-light-128.png','/images/brand/deepvisor-app-icon-dark-128.png'])assert.equal((await context.request.get(base+path)).status(),200);
 evidence.push('Desktop/mobile brand assets load; metadata and favicon/Apple/light/dark icons resolve. No screenshots retained.');
 await page.setViewportSize({width:1440,height:1000});await page.goto(base+'/campaigns');
 await page.getByRole('row').filter({hasText:'[SIMULATED] Salon services'}).click();await page.getByRole('tab',{name:/^Ad Sets/i}).click();
 await page.getByRole('row').filter({hasText:'[SIMULATED] Hair color'}).click();await page.getByRole('tab',{name:/^Ads/i}).click();
 await page.getByRole('row').filter({hasText:'[SIMULATED] Ad 1.1'}).waitFor();
 await page.waitForFunction(()=>[...document.querySelectorAll('main img')].some(i=>i.complete&&i.naturalWidth>=160&&decodeURIComponent(i.src).includes('beta-fixtures')));
 evidence.push('Fresh account Campaign → Ad set → individual ads and persisted creative previews work.');
 assert.equal((await context.request.get(base+'/api/reports/pdf?ad_account_id=7e365a93-b133-4574-aa86-89deb51030bf')).status(),403);
 const found=await admin.auth.admin.getUserById(user.id);if(found.error)throw found.error;const designation=found.data.user.app_metadata[tag];
 try{
  const unset=await admin.auth.admin.updateUserById(user.id,{app_metadata:{[tag]:null}});if(unset.error)throw unset.error;
  const response=await context.request.get(base+'/api/integrations/connect/meta?returnTo=/integration',{maxRedirects:0});
  assert.equal(response.status(),307);const location=new URL(response.headers().location);assert.equal(location.hostname,'www.facebook.com');
  assert.ok(location.searchParams.get('client_id'));assert.ok(location.searchParams.get('state'));
  evidence.push(`Real OAuth initiation built successfully; callback ${new URL(location.searchParams.get('redirect_uri')).origin}. No request sent to Meta; provider allowlist/login/consent unverified.`);
 }finally{const restored=await admin.auth.admin.updateUserById(user.id,{app_metadata:{[tag]:designation}});if(restored.error)throw restored.error;}
 assert.deepEqual(errors,[]);
}finally{
 await writeFile(new URL('../../docs/beta-readiness/phase5/checks.json',import.meta.url),JSON.stringify({evidence,errors},null,2));await browser.close();
}
console.log(JSON.stringify({evidence,errors},null,2));
