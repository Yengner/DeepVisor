import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from '/tmp/deepvisor-phase2-tools/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
page.setDefaultTimeout(30000);
const errors=[];page.on('pageerror',e=>errors.push(e.name));
const base='http://localhost:3011';
const results=[];
try {
 for(const width of [1440,390]) {
  await page.setViewportSize({width,height:900});
  await page.goto(base,{waitUntil:'networkidle'});
  const branding=page.locator('header img[alt="DeepVisor"]');
  await branding.waitFor();await branding.evaluate(img=>img.decode());
  assert.equal(await branding.evaluate(img=>img.naturalWidth>0),true);
  const icons=await page.locator('link[rel="icon"],link[rel="apple-touch-icon"]').evaluateAll(nodes=>nodes.map(n=>n.href));
  assert.ok(icons.some(url=>url.includes('apple-icon')));assert.ok(icons.some(url=>url.includes('deepvisor-app-icon-dark-128')));
  for(const url of icons)assert.equal((await page.request.get(url)).ok(),true);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  if(process.env.DEEPVISOR_CAPTURE==='1' && width===390)await page.screenshot({path:'/tmp/dv-phase4-mobile-brand.png'});
  results.push({page:'home',width,brandLoaded:true,iconsLoaded:true,overflow:false});
 }
 await page.goto(`${base}/login`,{waitUntil:'networkidle'});
 const credentials=JSON.parse(readFileSync('.env.beta-fixtures.json','utf8')).users.a;
 await page.getByLabel('Email').fill(credentials.email);
 await page.getByLabel('Password').fill(credentials.password);
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await page.waitForURL(/dashboard/, {timeout:60000});
 for(const width of [1440,390]) {
  await page.setViewportSize({width,height:1000});
  await page.goto(`${base}/decisions`,{waitUntil:'networkidle'});
  await page.getByText('Simulated execution',{exact:true}).first().waitFor();
  await page.getByText('Outcome observations',{exact:true}).first().click();
  await page.getByText('1h: Waiting for observations',{exact:true}).waitFor();
  await page.locator('img[src*="brand"]:visible,img[srcset*="brand"]:visible').evaluateAll(images=>Promise.all(images.map(img=>img.decode())));
  const broken=await page.locator('img[src*="brand"]:visible,img[srcset*="brand"]:visible').evaluateAll(images=>images.some(img=>!img.complete||!img.naturalWidth));
  assert.equal(broken,false);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  if(process.env.DEEPVISOR_CAPTURE==='1' && width===1440)await page.screenshot({path:'/tmp/dv-phase4-desktop-decisions.png',fullPage:true});
  results.push({page:'authenticated decisions',width,simulationVisible:true,pendingOutcomesVisible:true,brandLoaded:true,overflow:false});
 }
 assert.deepEqual(errors,[]);
 writeFileSync('docs/beta-readiness/phase4/browser.json',JSON.stringify({results,browserErrors:errors,screenshots:process.env.DEEPVISOR_CAPTURE==='1'?'Temporary captures requested; remove after review':'Disabled'},null,2)+'\n');
 console.log(JSON.stringify({checks:results.length,browserErrors:errors.length}));
} finally {await browser.close();}
