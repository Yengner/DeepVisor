// Temporary local watcher (not committed): prints when WhatsApp messages reach the lead log, or the tunnel drops.
import { createClient } from '@supabase/supabase-js';
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const tunnel = process.argv[2];
let receipts = -1, tunnelOk = true;
for (;;) {
  try {
    const { count } = await db.from('whatsapp_message_receipts').select('*', { count: 'exact', head: true });
    if (receipts >= 0 && count > receipts) {
      const { data } = await db.from('leads').select('source, ad_external_id, contact_last4, messages_in, messages_out, first_reply_at').order('last_message_at', { ascending: false }).limit(3);
      console.log(`MESSAGE RECORDED (+${count - receipts}) latest leads: ${JSON.stringify(data)}`);
    }
    receipts = count;
  } catch (e) { console.log(`DB check failed: ${e.message}`); }
  await new Promise(r => setTimeout(r, 10000));
}
