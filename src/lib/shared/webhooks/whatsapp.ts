/**
 * Pure parsing of WhatsApp Business Platform webhooks (`object: whatsapp_business_account`).
 *
 * - `messages`: customer messages to the business. The first message after a Click-to-WhatsApp
 *   ad carries `referral` with `source_type: "ad"`, `source_id` (the ad id) and usually
 *   `ctwa_clid` (missing for ads shown in WhatsApp Status). Delivery `statuses` are ignored.
 * - `smb_message_echoes`: replies the owner sends from the WhatsApp Business app (coexistence).
 *
 * Only what the lead log needs is kept. Message text and media are never read.
 */
export type WhatsAppDirection = 'in' | 'out';
export interface WhatsAppMessage {
  phoneNumberId: string;
  /** Meta's message id (wamid). Hash it before storing. */
  messageId: string;
  direction: WhatsAppDirection;
  /** The customer's WhatsApp id (their number, digits only). */
  customerWaId: string;
  customerName: string | null;
  sentAt: string;
  /** Present only when Meta's referral says the chat came from an ad. */
  ad: { id: string; clickId: string | null } | null;
}

export const MAX_WHATSAPP_MESSAGES = 200;
/** Not real messages: the customer opened the chat (`request_welcome`), or a system notice. */
const SKIPPED_TYPES = new Set(['request_welcome', 'system', 'unsupported_system']);

const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const digits = (value: unknown, max = 30): string | null => {
  const text = typeof value === 'number' && Number.isSafeInteger(value) ? String(value) : typeof value === 'string' ? value.replace(/^\+/, '') : '';
  return new RegExp(`^\\d{1,${max}}$`).test(text) ? text : null;
};
const messageId = (value: unknown): string | null =>
  typeof value === 'string' && value.length >= 1 && value.length <= 256 && !/[\u0000-\u001f\u007f]/.test(value) ? value : null;
const time = (value: unknown): string | null => {
  const seconds = typeof value === 'string' && /^\d{9,13}$/.test(value) ? Number(value) : typeof value === 'number' && Number.isFinite(value) ? value : null;
  if (seconds === null || seconds <= 0) return null;
  const at = new Date(seconds > 1e12 ? seconds : seconds * 1000);
  return Number.isNaN(at.getTime()) ? null : at.toISOString();
};
/** WhatsApp profile names are shown to the owner: one line, no control characters, bounded. */
export function profileName(value: unknown): string | null {
  const text = typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim() : '';
  return text ? text.slice(0, 80) : null;
}
function adReferral(value: unknown): WhatsAppMessage['ad'] {
  const referral = record(value);
  if (referral.source_type !== 'ad') return null;
  const id = digits(referral.source_id);
  if (!id) return null;
  const click = typeof referral.ctwa_clid === 'string' && referral.ctwa_clid.length <= 512 && !/[\u0000-\u001f\u007f]/.test(referral.ctwa_clid) ? referral.ctwa_clid : null;
  return { id, clickId: click };
}

/** Returns null when the body is not a WhatsApp delivery. Malformed items are skipped, not guessed. */
export function parseWhatsAppWebhook(body: unknown): WhatsAppMessage[] | null {
  const root = record(body);
  if (root.object !== 'whatsapp_business_account' || !Array.isArray(root.entry)) return null;
  const out: WhatsAppMessage[] = [];
  const push = (message: WhatsAppMessage) => { if (out.length < MAX_WHATSAPP_MESSAGES) out.push(message); };
  for (const entry of root.entry) {
    for (const rawChange of list(record(entry).changes)) {
      const change = record(rawChange), value = record(change.value);
      const phoneNumberId = digits(record(value.metadata).phone_number_id);
      if (!phoneNumberId) continue;
      if (change.field === 'messages') {
        const names = new Map<string, string | null>();
        for (const contact of list(value.contacts)) {
          const c = record(contact), wa = digits(c.wa_id, 20);
          if (wa) names.set(wa, profileName(record(c.profile).name));
        }
        for (const rawMessage of list(value.messages)) {
          const m = record(rawMessage);
          const id = messageId(m.id), from = digits(m.from, 20), at = time(m.timestamp);
          if (!id || !from || !at || (typeof m.type === 'string' && SKIPPED_TYPES.has(m.type))) continue;
          push({ phoneNumberId, messageId: id, direction: 'in', customerWaId: from, customerName: names.get(from) ?? null, sentAt: at, ad: adReferral(m.referral) });
        }
      } else if (change.field === 'smb_message_echoes') {
        for (const rawEcho of list(value.message_echoes)) {
          const m = record(rawEcho);
          const id = messageId(m.id), to = digits(m.to, 20), at = time(m.timestamp);
          if (!id || !to || !at || (typeof m.type === 'string' && SKIPPED_TYPES.has(m.type))) continue;
          push({ phoneNumberId, messageId: id, direction: 'out', customerWaId: to, customerName: null, sentAt: at, ad: null });
        }
      }
    }
  }
  return out;
}

/**
 * WhatsApp accounts that stopped sharing with this app: `account_update` with
 * `event: PARTNER_REMOVED` (the owner tapped Disconnect in the WhatsApp Business app, or Meta
 * offboarded them). The account id is the entry id. Other account events are ignored.
 */
export function parseWhatsAppRemovedAccounts(body: unknown): string[] {
  const root = record(body);
  if (root.object !== 'whatsapp_business_account') return [];
  const ids = new Set<string>();
  for (const rawEntry of list(root.entry)) {
    const entry = record(rawEntry);
    for (const rawChange of list(entry.changes)) {
      const change = record(rawChange), value = record(change.value);
      if (change.field !== 'account_update' || value.event !== 'PARTNER_REMOVED') continue;
      const id = digits(entry.id) ?? digits(record(value.waba_info).waba_id);
      if (id) ids.add(id);
    }
  }
  return [...ids].slice(0, 50);
}
