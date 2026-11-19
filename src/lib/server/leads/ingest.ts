import 'server-only';
import { createHash, createHmac } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/shared/types/supabase';
import type { WhatsAppMessage } from '@/lib/shared/webhooks/whatsapp';

/**
 * Turns verified WhatsApp webhook messages into lead log rows via record_whatsapp_message.
 * The customer's number is never stored: only a keyed hash (to recognize repeat customers)
 * and its last 4 digits. Message ids are hashed too. No message text reaches this module.
 */
export type WhatsAppIngestResult = { received: number; recorded: number; newLeads: number; duplicates: number; ignored: number; unknownNumbers: number };

/**
 * Keyed with the Meta app secret (already required to verify the webhook). Rotating that secret
 * only means returning customers are recognized as new; nothing else depends on the key.
 */
export function contactKey(secret: string, phoneNumberId: string, customerWaId: string): string {
  return createHmac('sha256', secret).update(`wa-contact:${phoneNumberId}:${customerWaId}`).digest('hex');
}
export function messageKey(phoneNumberId: string, messageId: string): string {
  return createHash('sha256').update(`${phoneNumberId}:${messageId}`).digest('hex');
}

export async function ingestWhatsAppMessages(
  client: SupabaseClient<Database>,
  messages: WhatsAppMessage[],
  secret: string | undefined,
): Promise<WhatsAppIngestResult> {
  if (!secret) throw new Error('META_APP_SECRET is required');
  const result: WhatsAppIngestResult = { received: messages.length, recorded: 0, newLeads: 0, duplicates: 0, ignored: 0, unknownNumbers: 0 };
  // Oldest first, so a lead opens on the customer's first message even within one delivery.
  const ordered = [...messages].sort((a, b) => a.sentAt.localeCompare(b.sentAt) || (a.direction === 'in' ? -1 : 1));
  for (const m of ordered) {
    const { data, error } = await client.rpc('record_whatsapp_message', {
      p_phone_number_id: m.phoneNumberId,
      p_message_key: messageKey(m.phoneNumberId, m.messageId),
      p_direction: m.direction,
      p_contact_key: contactKey(secret, m.phoneNumberId, m.customerWaId),
      p_contact_name: m.customerName,
      p_contact_last4: m.direction === 'in' ? m.customerWaId.slice(-4) : null,
      p_at: m.sentAt,
      p_ad_external_id: m.ad?.id ?? null,
      p_ctwa_clid: m.ad?.clickId ?? null,
    });
    if (error) throw error;
    const status = (data as { status?: string; created?: boolean } | null)?.status;
    if (status === 'recorded') {
      result.recorded++;
      if ((data as { created?: boolean }).created) result.newLeads++;
    } else if (status === 'duplicate') result.duplicates++;
    else if (status === 'ignored') result.ignored++;
    else if (status === 'unknown_number') result.unknownNumbers++;
    else throw new Error('Unexpected lead log response');
  }
  return result;
}
