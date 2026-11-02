import {readFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL,'https://gkdyyjqepzayjdpvqnja.supabase.co');
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const account=await db.from('ad_accounts').select('*').eq('id','7e365a93-b133-4574-aa86-89deb51030bf').single();if(account.error)throw account.error;assert.ok(account.data.name.includes('SYNTHETIC'));
const integration=await db.from('platform_integrations').select('id,integration_details').eq('business_id',account.data.business_id).eq('platform_id',account.data.platform_id).single();if(integration.error)throw integration.error;
const previous=integration.data.integration_details.primary_ad_account_external_id;
const old=await db.from('ad_accounts').select('name').eq('business_id',account.data.business_id).eq('external_account_id',previous).single();if(old.error)throw old.error;assert.ok(old.data.name.includes('SYNTHETIC'));

const {chromium}=createRequire('/tmp/deepvisor-auto-tools/package.json')('playwright');
const credentials=JSON.parse(await readFile('.env.beta-fixtures.json','utf8')).users;
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try{
 const updated=await db.from('platform_integrations').update({integration_details:{...integration.data.integration_details,primary_ad_account_external_id:account.data.external_account_id}}).eq('id',integration.data.id);if(updated.error)throw updated.error;
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:3013/campaigns/organize');await page.waitForURL('**/login**');
 await page.getByLabel('Email').fill(credentials.a.email);await page.getByLabel('Password').fill(credentials.a.password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.waitForURL('**/dashboard');
 await page.context().addCookies([{name:'ad_account_row_id',value:'7e365a93-b133-4574-aa86-89deb51030bf',url:'http://localhost:3013'}]);
 await page.goto('http://localhost:3013/campaigns/organize');
 await page.getByRole('heading',{name:'Organize Account',exact:true}).waitFor();
 assert.ok(await page.getByRole('button',{name:'Inspect account',exact:true}).isDisabled());
 await page.getByLabel('I authorize inspection and preservation of this account’s organization.').check();
 await page.getByRole('button',{name:'Inspect account',exact:true}).click();
 await page.getByRole('heading',{name:'Organization workspace',exact:true}).waitFor();
 const tree=page.getByRole('region',{name:'Account organization'});
 for(let i=0;i<100&&await tree.locator('article > details:not([open]) > summary').count();i++)await tree.locator('article > details:not([open]) > summary').first().click();
 await tree.getByLabel('Proposed name',{exact:true}).first().fill('Salon | Browser-reviewed proposal');
 await tree.getByLabel('Include in proposal (does not authorize Meta changes)').first().check();
 const family=tree.getByLabel('Creative family · your confirmed grouping').first();
 await family.fill('Hair showcase · user-confirmed');
 await page.getByRole('button',{name:'Save new proposal version',exact:true}).click();
 await page.getByText('New proposal version saved. No Meta changes occurred.',{exact:true}).waitFor();
 await page.reload();await page.getByRole('button',{name:'Open saved history',exact:true}).click();await page.getByRole('heading',{name:'Organization workspace'}).waitFor();
 await tree.locator('article > details > summary').first().click();
 assert.equal(await tree.getByLabel('Proposed name',{exact:true}).first().inputValue(),'Salon | Browser-reviewed proposal');
 await page.getByLabel('Creative families',{exact:true}).check();
 assert.ok(await tree.getByText('Hair showcase · user-confirmed',{exact:true}).count());
 await page.getByLabel('Creative families',{exact:true}).uncheck();
 for(let i=0;i<100&&await tree.locator('article > details:not([open]) > summary').count();i++)await tree.locator('article > details:not([open]) > summary').first().click();


 const panel=page.getByRole('region',{name:'Approved naming changes'});
 if(process.argv.includes('--restore-only')){await panel.getByRole('button',{name:'Load operation history',exact:true}).click();await panel.getByRole('heading',{name:'Organization change history'}).waitFor();if(await panel.getByRole('button',{name:'Reconcile by reading current state',exact:true}).count()){await panel.getByRole('button',{name:'Reconcile by reading current state',exact:true}).first().click();await panel.getByText('Request finished. Check each entity’s verified outcome below.',{exact:true}).waitFor();await page.waitForFunction(()=>![...document.querySelectorAll('fieldset')].some(f=>f.disabled));assert.equal(await panel.getByRole('alert').count(),0);}}else{
 await panel.getByRole('button',{name:'Review exact saved changes',exact:true}).click();
 await panel.getByRole('heading',{name:/SIMULATED.*Exact approval preview/}).waitFor();
 const consent=panel.getByLabel('I approve only these exact name changes, and understand that other fields will not be changed.');
 assert.ok(await panel.getByRole('button',{name:'Approve exact names',exact:true}).isDisabled());
 await consent.check();await panel.getByRole('button',{name:'Approve exact names',exact:true}).click();
 await panel.getByRole('button',{name:'Execute simulated renames',exact:true}).click();
 await panel.getByText('Request finished. Check each entity’s verified outcome below.',{exact:true}).waitFor();
 await panel.getByRole('button',{name:'Load operation history',exact:true}).waitFor({state:'visible'});
 await page.waitForFunction(()=>![...document.querySelectorAll('fieldset')].some(f=>f.disabled));
 assert.equal(await panel.getByRole('alert').count(),0);
 assert.match(await panel.locator('article').first().innerText(),/Every approved name was verified/);
 }
 const consent=panel.getByLabel('I approve only these exact name changes, and understand that other fields will not be changed.');
 const oldVersion=await page.getByLabel('Version history (latest 100)').inputValue();
 await panel.getByRole('button',{name:'Preview restoration proposal',exact:true}).first().click();
 await page.waitForFunction(old=>document.querySelector('label select')&&[...document.querySelectorAll('select')].some(s=>s.closest('label')?.textContent?.includes('Version history')&&s.value!==old),oldVersion);
 await page.getByRole('heading',{name:'Organization workspace'}).waitFor();
 await tree.locator('article > details > summary').first().click();
 const selected=tree.getByLabel('Include in proposal (does not authorize Meta changes)').first();
 assert.equal(await selected.isChecked(),false);await selected.check();
 await page.getByRole('button',{name:'Save new proposal version',exact:true}).click();
 await page.getByText('New proposal version saved. No Meta changes occurred.',{exact:true}).waitFor();
 await panel.getByRole('button',{name:'Review exact saved changes',exact:true}).click();
 await panel.getByRole('heading',{name:/SIMULATED.*Exact approval preview/}).waitFor();
 await consent.check();await panel.getByRole('button',{name:'Approve exact names',exact:true}).click();
 await panel.getByRole('button',{name:'Execute simulated renames',exact:true}).click();
 await panel.getByText('Request finished. Check each entity’s verified outcome below.',{exact:true}).waitFor();
 await panel.getByRole('button',{name:'Load operation history',exact:true}).waitFor({state:'visible'});
 await page.waitForFunction(()=>![...document.querySelectorAll('fieldset')].some(f=>f.disabled));
 assert.equal(await panel.getByRole('alert').count(),0);
 assert.match(await panel.locator('article').first().innerText(),/Every approved name was verified/);
 await mkdir('/tmp/deepvisor-organizer-renaming',{recursive:true});
 for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await panel.getByRole('heading',{name:'Organization change history'}).scrollIntoViewIfNeeded();await page.screenshot({path:`/tmp/deepvisor-organizer-renaming/${width}.png`,fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 assert.deepEqual(errors,[]);console.log('PASS authenticated saved plan → exact approval → simulated execution → verified audit → unselected restoration proposal → fresh approval → verified restoration; 1440/390 no overflow.');
}finally{const current=await db.from('platform_integrations').select('integration_details').eq('id',integration.data.id).single();if(current.error)throw current.error;const restored=await db.from('platform_integrations').update({integration_details:{...current.data.integration_details,primary_ad_account_external_id:previous}}).eq('id',integration.data.id);await browser.close();if(restored.error)throw restored.error;}
