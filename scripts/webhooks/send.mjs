// Send a signed synthetic Meta `ad_account` webhook to a local DeepVisor server.
// Development only: it signs with META_APP_SECRET from the environment and refuses non-local hosts.
//   node --env-file=.env.local scripts/webhooks/send.mjs --account 1234567890 --field effective_status --object 555 --level ad
//   node --env-file=.env.local scripts/webhooks/send.mjs --account 1234567890 --field creative_fatigue --object 555
//   node --env-file=.env.local scripts/webhooks/send.mjs --verify            (handshake check)
import { createHmac } from 'node:crypto';

const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => value.startsWith('--') ? [...pairs, [value.slice(2), all[index + 1]?.startsWith('--') || all[index + 1] === undefined ? 'true' : all[index + 1]]] : pairs, []));
const base = new URL(args.url ?? 'http://localhost:3000');
if (!['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)) throw new Error('This script only posts to a local development server.');
const endpoint = new URL('/api/meta/webhooks', base);

if (args.verify) {
  const token = process.env.META_WEBHOOK_VERIFY_TOKEN;
  if (!token) throw new Error('META_WEBHOOK_VERIFY_TOKEN is not set.');
  endpoint.search = new URLSearchParams({ 'hub.mode': 'subscribe', 'hub.challenge': 'local-check', 'hub.verify_token': token }).toString();
  const response = await fetch(endpoint);
  console.log(response.status, await response.text());
  process.exit(response.ok ? 0 : 1);
}

const secret = process.env.META_APP_SECRET;
if (!secret) throw new Error('META_APP_SECRET is not set.');
if (!/^\d{1,20}$/.test(args.account ?? '')) throw new Error('--account must be the numeric Meta ad account id.');
const field = args.field ?? 'effective_status', object = args.object ?? '1', level = args.level ?? 'ad';
const values = {
  effective_status: { object_id: object, object_type: level, changed_fields: ['effective_status'] },
  with_issues_ad_objects: { id: object, level: level.toUpperCase(), error_code: 1815869, error_summary: args.summary ?? '[SYNTHETIC] Delivery issue reported', error_message: '[SYNTHETIC] Local test delivery' },
  in_process_ad_objects: { id: object, level: level.toUpperCase(), status_name: 'ACTIVE' },
  creative_fatigue: { ad_account_id: args.account, adgroup_id: object, creative_fatigue_level: 'HIGH', creative_fatigue_message: args.summary ?? '[SYNTHETIC] Cost per result is rising' },
};
const body = JSON.stringify({ object: 'ad_account', entry: [{ id: args.account, time: Math.floor(Date.now() / 1000), changes: [{ field, value: values[field] ?? {} }] }] });
const signature = args.unsigned ? 'sha256=' + '0'.repeat(64) : `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': signature }, body });
console.log(response.status, await response.text());
process.exit(response.ok ? 0 : 1);
