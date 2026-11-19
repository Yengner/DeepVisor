// Connect (or disconnect) a WhatsApp Business number to one DeepVisor business, until the
// in-app "Connect WhatsApp" (Embedded Signup) exists. Development project only.
//   DEEPVISOR_WHATSAPP_ADMIN=gkdyyjqepzayjdpvqnja node --env-file=.env.local scripts/whatsapp/connect-number.mjs \
//     --business <business uuid> --phone-number-id <Meta phone number id> [--waba <WABA id>] [--display "+1 555 0100"] [--test]
//   ... connect-number.mjs --phone-number-id <id> --disconnect
import { createClient } from '@supabase/supabase-js';

const project = 'gkdyyjqepzayjdpvqnja';
if (process.env.DEEPVISOR_WHATSAPP_ADMIN !== project || process.env.NEXT_PUBLIC_SUPABASE_URL !== `https://${project}.supabase.co`) {
  throw new Error(`Set DEEPVISOR_WHATSAPP_ADMIN=${project} to confirm the target project.`);
}
const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => value.startsWith('--')
  ? [...pairs, [value.slice(2), all[index + 1]?.startsWith('--') || all[index + 1] === undefined ? 'true' : all[index + 1]]] : pairs, []));
const phone = args['phone-number-id'];
if (!/^\d{1,30}$/.test(phone ?? '')) throw new Error('--phone-number-id must be the numeric id from Meta (WhatsApp > API Setup).');
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

if (args.disconnect) {
  const { data, error } = await db.from('whatsapp_connections').update({ status: 'disconnected', disconnected_at: new Date().toISOString() })
    .eq('phone_number_id', phone).eq('status', 'active').select('id');
  if (error) throw error;
  console.log(JSON.stringify({ disconnected: data.length }));
  process.exit(0);
}

if (!/^[0-9a-f-]{36}$/i.test(args.business ?? '')) throw new Error('--business must be the business uuid.');
if (args.waba && !/^\d{1,30}$/.test(args.waba)) throw new Error('--waba must be numeric.');
const { data: business, error: businessError } = await db.from('business_profiles').select('id, business_name').eq('id', args.business).maybeSingle();
if (businessError) throw businessError;
if (!business) throw new Error('Business not found.');
const { data, error } = await db.from('whatsapp_connections').upsert({
  business_id: business.id, phone_number_id: phone, waba_id: args.waba ?? null, display_phone: args.display ?? null,
  is_test: args.test === 'true', status: 'active', disconnected_at: null, connected_at: new Date().toISOString(),
}, { onConflict: 'phone_number_id' }).select('id, business_id').single();
if (error) throw error;
console.log(JSON.stringify({ connected: data.id, business: business.business_name }));
