// Opt-in preparation of existing synthetic Business A only. No provider calls or execution gates.
import { readFile, writeFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
const project = 'gkdyyjqepzayjdpvqnja';
if (process.env.NODE_ENV === 'production' || process.env.DEEPVISOR_FIXTURES !== project || process.env.NEXT_PUBLIC_SUPABASE_URL !== `https://${project}.supabase.co`) throw new Error('Explicit development fixture guard required');
const action = process.argv[2];
if (!['prepare', 'select', 'restore'].includes(action)) throw new Error('Use prepare, select, or restore');
const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const business = 'f6f96cff-bde3-4627-a613-4f16bfdc1d7c';
const account = 'eeee4445-0000-4000-8000-000000000001';
const check = ({data,error}) => { if (error) throw new Error('Synthetic fixture operation failed'); return data; };
const integration = check(await client.from('platform_integrations').select('id,integration_details').eq('business_id',business).single());
if (!JSON.stringify(integration.integration_details).includes('deepvisor-beta-v1')) throw new Error('Not the designated synthetic integration');
const file = '.env.agency-demo.json';
if (action === 'prepare') {
  const profile = check(await client.from('business_profiles').select('primary_goal,monthly_budget,target_cost_per_lead,industry,lead_type,safety_preference,recommendation_style').eq('id',business).single());
  try { await writeFile(file, JSON.stringify({profile, primary: integration.integration_details.primary_ad_account_external_id, primaryName: integration.integration_details.primary_ad_account_name}), {flag:'wx',mode:0o600}); }
  catch (error) { if(error.code !== 'EEXIST') throw error; }
  check(await client.from('business_profiles').update({primary_goal:'more_booked_appointments',monthly_budget:'1000_2500',target_cost_per_lead:'10_25',industry:'hair_salon',lead_type:'whatsapp_messages',safety_preference:'balanced',recommendation_style:'recommend_actions_for_approval'}).eq('id',business));
} else if (action === 'select') {
  const fixture = check(await client.from('ad_accounts').select('external_account_id,name').eq('business_id',business).eq('id',account).single());
  check(await client.from('platform_integrations').update({integration_details:{...integration.integration_details,primary_ad_account_external_id:fixture.external_account_id,primary_ad_account_name:fixture.name}}).eq('business_id',business).eq('id',integration.id));
} else {
  const saved = JSON.parse(await readFile(file,'utf8'));
  check(await client.from('business_profiles').update(saved.profile).eq('id',business));
  check(await client.from('platform_integrations').update({integration_details:{...integration.integration_details,primary_ad_account_external_id:saved.primary ?? null,primary_ad_account_name:saved.primaryName ?? null}}).eq('business_id',business).eq('id',integration.id));
}
console.log(`Synthetic Agency demo: ${action} complete. No Meta requests or live execution.`);
