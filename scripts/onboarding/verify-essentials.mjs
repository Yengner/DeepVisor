// Disposable development user; exercise the real UI, server actions and authenticated persistence.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { createClient } from '@supabase/supabase-js';
const project='gkdyyjqepzayjdpvqnja';
if(process.env.DEEPVISOR_ONBOARDING_TEST!==project || process.env.NODE_ENV==='production' || process.env.NEXT_PUBLIC_SUPABASE_URL!==`https://${project}.supabase.co`)throw new Error('Explicit development project opt-in required');
const options={auth:{persistSession:false,autoRefreshToken:false}};
const admin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,options);
const client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,options);
const {chromium}=createRequire('/tmp/deepvisor-auto-tools/package.json')('playwright');
const tag='essentials-'+randomBytes(8).toString('hex'),email=tag+'@example.test',password=randomBytes(24).toString('base64url')+'!aA9';
const check=r=>{if(r.error)throw new Error(r.error.message);return r.data;};
let userId,browser;
try{
 const {user}=check(await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{first_name:'Synthetic',last_name:'Essentials'},app_metadata:{onboarding_verification:tag}}));userId=user.id;
 check(await client.auth.signInWithPassword({email,password}));
 const businessId=check(await client.rpc('ensure_onboarding_workspace'));
 browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 const page=await browser.newPage();page.setDefaultTimeout(20000);
 const base=process.env.ONBOARDING_BASE_URL || 'http://localhost:3000';
 await page.goto(base+'/login');await page.getByLabel('Email').fill(email);await page.getByLabel('Password').fill(password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.waitForURL('**/onboarding');
 await page.getByLabel('Business name',{exact:false}).fill('[SYNTHETIC] Profession regression');
 async function select(label,option){await page.getByRole('textbox',{name:label,exact:false}).click();await page.getByRole('option',{name:option,exact:true}).click();}
 await select('Profession','Nail technician');
 await page.getByLabel('Service address').fill('123 Synthetic Street, Tampa, FL');
 await select('Customer radius','Within 5 miles');await select('Preferred contact path','Phone calls');await select('Monthly ad budget','$500 - $1,000');
 await page.getByRole('button',{name:'Save and continue',exact:true}).click();await page.getByRole('button',{name:'Skip for now',exact:true}).waitFor();
 let profile=check(await client.from('business_profiles').select('industry,most_valuable_service,onboarding_step').eq('id',businessId).single());
 assert.equal(profile.industry,'nail_salon');assert.equal(profile.most_valuable_service,null);assert.equal(profile.onboarding_step,1);
 await page.reload();await page.getByRole('button',{name:'Back to business essentials'}).click();
 assert.equal(await page.getByRole('textbox',{name:'Profession',exact:false}).inputValue(),'Nail technician');
 await page.getByRole('button',{name:'Save and continue',exact:true}).click();await page.getByRole('button',{name:'Skip for now',exact:true}).waitFor();
 console.log('PASS: fresh user saves profession, advances without legacy services, and retains selection after reload/back/retry; verified using normal authenticated database reads.');
}finally{
 await browser?.close();
 if(userId){const found=check(await admin.auth.admin.getUserById(userId));if(found.user.app_metadata.onboarding_verification===tag)check(await admin.auth.admin.deleteUser(userId,false));}
}
