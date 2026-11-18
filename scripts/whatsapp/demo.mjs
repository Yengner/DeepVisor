// End-to-end lead log check against a LOCAL server and the development project, using the
// marked beta fixture business A (seed it first: scripts/beta-fixtures/run.mjs seed).
// The local server must run with DEEPVISOR_META_WEBHOOKS=true.
//   export DEEPVISOR_FIXTURES=gkdyyjqepzayjdpvqnja
//   node --env-file=.env.local scripts/whatsapp/demo.mjs seed   [--url http://localhost:3000]
//   node --env-file=.env.local scripts/whatsapp/demo.mjs clean
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { businesses, FIXTURE_TAG, PROJECT_REF } from '../beta-fixtures/fixture.ts';

const command = process.argv[2];
assert(['seed', 'clean'].includes(command), 'Use seed or clean');
assert.equal(process.env.DEEPVISOR_FIXTURES, PROJECT_REF, `Set DEEPVISOR_FIXTURES=${PROJECT_REF}`);
assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL, `https://${PROJECT_REF}.supabase.co`);
const urlArg = process.argv.indexOf('--url');
const base = new URL(urlArg > 0 ? process.argv[urlArg + 1] : 'http://localhost:3000');
assert(['localhost', '127.0.0.1', '[::1]'].includes(base.hostname), 'Only posts to a local development server');
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const check = async (promise, what) => { const { data, error } = await promise; if (error) throw new Error(`${what}: ${error.message}`); return data; };

const b = businesses[0];
const PHONE_ID = '990000000000001';
const AD_ID = '990000000000777';
const AD_ENTITY = '00000000-0000-4000-8000-0000000c0777';

// Never touch anything that is not the marked fixture business.
const profile = await check(db.from('business_profiles').select('id, description').eq('id', b.id).maybeSingle(), 'fixture business');
assert(profile?.description?.includes(FIXTURE_TAG), 'Fixture business A is missing or unmarked. Run beta-fixtures seed first.');

if (command === 'clean') {
  await check(db.from('leads').delete().eq('business_id', b.id), 'delete leads');
  await check(db.from('whatsapp_message_receipts').delete().eq('business_id', b.id), 'delete receipts');
  await check(db.from('whatsapp_connections').delete().eq('business_id', b.id), 'delete connection');
  await check(db.from('ad_entity_performance_daily').delete().eq('entity_id', AD_ENTITY), 'delete ad numbers');
  await check(db.from('ad_entities').delete().eq('id', AD_ENTITY), 'delete ad');
  console.log(JSON.stringify({ cleaned: b.id }));
  process.exit(0);
}

// A synthetic ad with a real-looking numeric id, so the referral matches it, plus 7 days of numbers.
const account = await check(db.from('ad_accounts').select('id, platform_id, timezone').eq('id', b.accountId).single(), 'fixture account');
const adset = await check(db.from('ad_entities').select('id, external_id, campaign_id, platform_integration_id').eq('ad_account_id', b.accountId).eq('entity_level', 'adset').limit(1).single(), 'fixture ad set');
await check(db.from('ad_entities').upsert({
  id: AD_ENTITY, business_id: b.id, ad_account_id: b.accountId, platform_id: account.platform_id, platform_integration_id: adset.platform_integration_id,
  entity_level: 'ad', external_id: AD_ID, name: '[SYNTHETIC] WhatsApp weekend promo', status: 'ACTIVE', raw: { synthetic_fixture: FIXTURE_TAG },
  campaign_id: adset.campaign_id, adset_id: adset.id, parent_id: adset.id, parent_external_id: adset.external_id,
}), 'synthetic ad');
const today = new Intl.DateTimeFormat('en-CA', { timeZone: account.timezone }).format(new Date());
const day = (offset) => { const d = new Date(`${today}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - offset); return d.toISOString().slice(0, 10); };
const zero = { impressions: 0, reach: 0, clicks: 0, inline_link_clicks: 0, leads: 0, calls: 0 };
await check(db.from('ad_entity_performance_daily').upsert([0, 1, 2, 3, 4, 5, 6].map(offset => ({
  ...zero, entity_id: AD_ENTITY, ad_account_id: b.accountId, entity_level: 'ad', day: day(offset), spend: 12, messages: offset < 3 ? 1 : 0,
  currency_code: 'USD', source: FIXTURE_TAG,
})), { onConflict: 'entity_id,day' }), 'synthetic ad numbers');
await check(db.from('whatsapp_connections').upsert({
  business_id: b.id, phone_number_id: PHONE_ID, display_phone: '+1 555 0100', is_test: true, status: 'active', disconnected_at: null,
  connected_at: new Date(Date.now() - 2 * 86_400_000).toISOString(),
}, { onConflict: 'phone_number_id' }), 'test connection');

// Signed deliveries shaped like Meta's: three chats from the ad (one answered), one organic, one retry.
const secret = process.env.META_APP_SECRET;
assert(secret, 'META_APP_SECRET is not set');
const ts = (minutesAgo) => String(Math.floor(Date.now() / 1000) - minutesAgo * 60);
const metadata = { display_phone_number: '15550100', phone_number_id: PHONE_ID };
const inbound = (from, name, id, minutesAgo, referral) => ({
  object: 'whatsapp_business_account',
  entry: [{ id: '990000000000002', changes: [{ field: 'messages', value: {
    messaging_product: 'whatsapp', metadata, contacts: [{ profile: { name }, wa_id: from }],
    messages: [{ from, id, timestamp: ts(minutesAgo), type: 'text', text: { body: '[SYNTHETIC] Hi, do you have openings Saturday?' },
      ...(referral ? { referral: { source_type: 'ad', source_id: AD_ID, source_url: 'https://fb.me/synthetic', headline: 'Book now', ctwa_clid: `synthetic-${id}` } } : {}) }],
  } }] }],
});
const echo = (to, id, minutesAgo) => ({
  object: 'whatsapp_business_account',
  entry: [{ id: '990000000000002', changes: [{ field: 'smb_message_echoes', value: {
    messaging_product: 'whatsapp', metadata, message_echoes: [{ from: '15550100', to, id, timestamp: ts(minutesAgo), type: 'text', text: { body: '[SYNTHETIC] Yes! 2pm?' } }],
  } }] }],
});
async function send(payload) {
  const body = JSON.stringify(payload);
  const response = await fetch(new URL('/api/meta/webhooks', base), { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': `sha256=${createHmac('sha256', secret).update(body).digest('hex')}` }, body });
  const text = await response.text();
  assert(response.ok, `Webhook ${response.status}: ${text}`);
  return JSON.parse(text);
}
const deliveries = [
  inbound('15550001111', '[SYNTHETIC] Ana', 'wamid.synthetic.1', 600, true),
  echo('15550001111', 'wamid.synthetic.1r', 588),
  inbound('15550002222', '[SYNTHETIC] Luis', 'wamid.synthetic.2', 300, true),
  inbound('15550003333', '[SYNTHETIC] Maria', 'wamid.synthetic.3', 120, true),
  inbound('15550004444', '[SYNTHETIC] Sam', 'wamid.synthetic.4', 60, false),
  inbound('15550002222', '[SYNTHETIC] Luis', 'wamid.synthetic.2', 300, true),
];
const responses = [];
for (const payload of deliveries) responses.push(await send(payload));
assert.deepEqual(responses.at(-1), { received: 1, recorded: 0, duplicates: 1 }, 'Retried delivery must not count twice');

const leads = await check(db.from('leads').select('source, ad_external_id, contact_last4, messages_in, first_reply_at').eq('business_id', b.id).order('first_message_at'), 'read leads');
assert.equal(leads.length, 4);
assert.deepEqual(leads.map(l => [l.source, l.contact_last4]), [['ad', '1111'], ['ad', '2222'], ['ad', '3333'], ['organic', '4444']]);
assert(leads[0].first_reply_at, 'First reply time recorded');
const stored = JSON.stringify(await check(db.from('leads').select('*').eq('business_id', b.id), 'read raw'));
assert(!stored.includes('15550001111') && !stored.includes('openings'), 'No full numbers or message text stored');
console.log(JSON.stringify({ business: b.id, leads: leads.length, responses }));
