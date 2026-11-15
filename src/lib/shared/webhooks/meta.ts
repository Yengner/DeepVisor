/**
 * Pure parsing of Meta `ad_account` webhook deliveries (Marketing API › Ads Webhooks).
 * A delivery only says that something changed. Nothing here is treated as a fact about the
 * account: the worker re-reads Meta before any event or issue is shown.
 */
export type WebhookLevel = 'campaign' | 'adset' | 'ad' | 'creative';
export type WebhookDetail = Record<string, string>;
export interface MetaWebhookEvent {
  /** Numeric ad account id (no `act_` prefix). */
  externalAccountId: string;
  field: string;
  objectId: string | null;
  level: WebhookLevel | null;
  /** Meta's own short notice fields, trimmed. Never advertising metrics. */
  detail: WebhookDetail;
  sentAt: string | null;
  /** Whether this field is a reason to re-read the account's hierarchy. */
  refresh: boolean;
  /** Stable text for de-duplicating retried deliveries (hash it before storing). */
  identity: string;
}

/** Fields whose arrival means an object's delivery or review state may have changed. */
export const REFRESH_FIELDS = ['effective_status', 'field_changed', 'with_issues_ad_objects', 'in_process_ad_objects', 'creative_fatigue'] as const;
/** Fields the Meta app dashboard offers for `ad_account` (v27). `effective_status` is not offered to this app; it stays parsed if Meta ever sends it. */
export const SUBSCRIBED_FIELDS = ['with_issues_ad_objects', 'in_process_ad_objects', 'creative_fatigue'] as const;
export const MAX_WEBHOOK_CHANGES = 200;

const DETAIL_KEYS = ['error_code', 'error_summary', 'error_message', 'status_name', 'creative_fatigue_level', 'creative_fatigue_message', 'recommendation_type', 'changed_fields', 'type'] as const;
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const id = (value: unknown): string | null => {
  const text = typeof value === 'number' && Number.isSafeInteger(value) ? String(value) : typeof value === 'string' ? value.replace(/^act_/, '') : '';
  return /^\d{1,20}$/.test(text) ? text : null;
};
/** Provider text is shown to owners, so keep it short, single-line and free of control characters. */
export function noticeText(value: unknown, max = 240): string | null {
  const raw = Array.isArray(value) ? value.filter(v => typeof v === 'string').join(', ') : typeof value === 'number' ? String(value) : typeof value === 'string' ? value : '';
  const text = raw.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
  return text ? (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text) : null;
}
export function webhookLevel(value: unknown): WebhookLevel | null {
  const key = typeof value === 'string' ? value.toLowerCase().replace(/[^a-z]/g, '') : '';
  return key === 'campaign' ? 'campaign' : key === 'adset' ? 'adset' : key === 'ad' || key === 'adgroup' ? 'ad' : key === 'creative' || key === 'adcreative' ? 'creative' : null;
}

/** Returns null when the body is not an `ad_account` delivery. Malformed entries are skipped, not guessed. */
export function parseMetaWebhook(body: unknown): MetaWebhookEvent[] | null {
  const root = record(body);
  if (root.object !== 'ad_account' || !Array.isArray(root.entry)) return null;
  const events: MetaWebhookEvent[] = [];
  for (const rawEntry of root.entry) {
    const entry = record(rawEntry), account = id(entry.id);
    if (!account || !Array.isArray(entry.changes)) continue;
    const seconds = typeof entry.time === 'number' && Number.isFinite(entry.time) ? entry.time : null;
    const sentAt = seconds === null ? null : new Date(seconds > 1e12 ? seconds : seconds * 1000).toISOString();
    for (const rawChange of entry.changes) {
      if (events.length >= MAX_WEBHOOK_CHANGES) return events;
      const change = record(rawChange), value = record(change.value);
      const field = typeof change.field === 'string' && /^[a-z_]{1,64}$/.test(change.field) ? change.field : null;
      if (!field) continue;
      const objectId = id(value.object_id ?? value.adgroup_id ?? value.id);
      const level = field === 'creative_fatigue' ? 'ad' : webhookLevel(value.object_type ?? value.level);
      const detail: WebhookDetail = {};
      for (const key of DETAIL_KEYS) { const text = noticeText(value[key]); if (text) detail[key] = text; }
      events.push({
        externalAccountId: account, field, objectId, level: objectId ? level : null, detail, sentAt,
        refresh: (REFRESH_FIELDS as readonly string[]).includes(field),
        identity: JSON.stringify([account, seconds, field, objectId, level, detail]),
      });
    }
  }
  return events;
}

/** Objects a targeted read can use; null means the whole hierarchy must be read. */
export function affectedObjects(events: MetaWebhookEvent[]): Array<{ id: string; level: WebhookLevel }> | null {
  const seen = new Map<string, { id: string; level: WebhookLevel }>();
  for (const event of events) {
    if (!event.refresh) continue;
    if (!event.objectId || !event.level) return null;
    seen.set(`${event.level}:${event.objectId}`, { id: event.objectId, level: event.level });
  }
  return seen.size && seen.size <= 50 ? [...seen.values()] : null;
}
