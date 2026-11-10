import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=createRequire('/tmp/deepvisor-auto-tools/package.json')('playwright');
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1100},reducedMotion:'no-preference'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/sync/**',route=>route.fulfill({status:409,contentType:'application/json',body:'{"error":"Read-only visual verification"}'}));
 await page.route('**/api/insights',route=>route.request().method()==='POST'?route.fulfill({status:200,contentType:'application/json',body:'{"presentation":null}'}):route.continue());
 const user=JSON.parse(await readFile('.env.beta-phase5.json','utf8')).users[0];
 await page.goto('http://localhost:3000/login');await page.getByLabel('Email').fill(user.email);await page.getByLabel('Password').fill(user.password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.waitForURL('**/dashboard',{timeout:60000});
 await page.goto('http://localhost:3000/mascot-preview');await page.getByRole('heading',{name:'A calmer, more consistent spider.'}).waitFor();
 const candidate=page.locator('[aria-label^="Refined DeepVisor spider"]').first().locator('span');
 assert.equal(await candidate.evaluate(el=>el.getAnimations()[0]?.effect.getTiming().duration),16040);
 await page.getByRole('button',{name:'Pause blinking',exact:true}).click();assert.equal(await candidate.evaluate(el=>el.getAnimations().length),0);
 await page.getByRole('button',{name:'Resume blinking',exact:true}).click();
 await page.getByRole('button',{name:'Replay one blink',exact:true}).click();
 for(const width of [1440,390]){await page.setViewportSize({width,height:1100});await page.screenshot({path:`/tmp/dv-spider-v2-${width}.png`,fullPage:width===1440});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 await page.getByRole('region',{name:'dark background review'}).scrollIntoViewIfNeeded();await page.screenshot({path:'/tmp/dv-spider-v2-390-dark.png'});
 for(const state of ['working','scanning','success','attention','sleep']){
  const card=page.locator(`[data-mascot-state="${state}"]`);await card.scrollIntoViewIfNeeded();
  assert.equal(await card.getByRole('img').count(),5);
  await page.screenshot({path:`/tmp/dv-spider-v2-390-${state}.png`});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 }
 await page.emulateMedia({reducedMotion:'reduce'});
 assert.equal(await candidate.evaluate(el=>parseFloat(getComputedStyle(el).backgroundPositionX)),0);
 for(const [state,frame] of [['working',0],['scanning',2],['success',4],['attention',5],['sleep',6]]){
  const sprite=page.locator(`[data-mascot-state="${state}"] [role="img"]`).first().locator('span');
  assert.ok(Math.abs(await sprite.evaluate(el=>parseFloat(getComputedStyle(el).backgroundPositionX))-frame*100/6)<0.001);
 }
 assert.deepEqual(errors,[]);console.log('Passed: desktop/mobile, 16.04s idle cycle, pause/resume, replay, reduced motion, no overflow or runtime errors.');
}finally{await browser.close();}
