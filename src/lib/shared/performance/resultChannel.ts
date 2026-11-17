/**
 * What an ad set's "results" are, from the ad set's Meta `destination_type`.
 *
 * Results stay the sum of leads + messaging conversations + calls everywhere. This module only
 * decides whether that number can honestly be given a narrower name ("WhatsApp conversations")
 * for a set of rows. Pure: no I/O.
 */

export type ResultChannel = 'whatsapp' | 'messaging' | 'instant_form' | 'calls' | 'website' | 'unknown';
export type MessagingApp = 'whatsapp' | 'instagram' | 'messenger';
export type ResultKind = 'whatsapp_conversations' | 'conversations' | 'leads' | 'calls' | 'results';

/** Meta ad-set destination types (Marketing API `destination_type`) mapped to a result channel. */
export function resultChannel(destinationType: string | null | undefined): ResultChannel {
  const value = destinationType?.trim().toUpperCase() ?? '';
  if (value === 'WHATSAPP') return 'whatsapp';
  if (value === 'MESSENGER' || value === 'INSTAGRAM_DIRECT' || value.startsWith('MESSAGING_')) return 'messaging';
  if (value === 'ON_AD') return 'instant_form';
  if (value === 'PHONE_CALL') return 'calls';
  if (value === 'WEBSITE') return 'website';
  return 'unknown';
}

/** Messaging apps a destination can open, in a fixed display order. */
export function messagingApps(destinationType: string | null | undefined): MessagingApp[] {
  const value = destinationType?.trim().toUpperCase() ?? '';
  if (resultChannel(value) !== 'whatsapp' && resultChannel(value) !== 'messaging') return [];
  const apps: MessagingApp[] = [];
  if (value.includes('WHATSAPP')) apps.push('whatsapp');
  if (value.includes('INSTAGRAM_DIRECT')) apps.push('instagram');
  if (value.includes('MESSENGER')) apps.push('messenger');
  return apps;
}

export type ResultRow = {
  destinationType: string | null | undefined;
  spend: number | null;
  leads: number | null;
  messages: number | null;
  calls: number | null;
};
export type ResultDefinition = { kind: ResultKind; apps: MessagingApp[] };

const zero = (value: number | null) => value === 0;

/**
 * A narrower name applies only when every row that spent or reported anything belongs to that
 * channel and the other counts are known zeros. Otherwise cost per result would mix in spend from
 * ad sets that cannot produce that result, so the name stays "Results".
 * Rows that are known to be fully idle (zero spend, zero counts) do not affect the name.
 */
export function resultDefinition(rows: ResultRow[]): ResultDefinition {
  const active = rows.filter(r => !(zero(r.spend) && zero(r.leads) && zero(r.messages) && zero(r.calls)));
  const fallback: ResultDefinition = { kind: 'results', apps: [] };
  if (!active.length) return fallback;
  const channels = new Set(active.map(r => resultChannel(r.destinationType)));
  const only = (...allowed: ResultChannel[]) => [...channels].every(c => allowed.includes(c));
  const apps = (['whatsapp', 'instagram', 'messenger'] as const).filter(app =>
    active.some(r => messagingApps(r.destinationType).includes(app)));

  if (only('whatsapp', 'messaging') && active.every(r => zero(r.leads) && zero(r.calls))) {
    return { kind: only('whatsapp') ? 'whatsapp_conversations' : 'conversations', apps };
  }
  if (only('instant_form') && active.every(r => zero(r.messages) && zero(r.calls))) return { kind: 'leads', apps: [] };
  if (only('calls') && active.every(r => zero(r.leads) && zero(r.messages))) return { kind: 'calls', apps: [] };
  return fallback;
}

type CountRow = { spend: number | null; leads: number | null; messages: number | null; calls: number | null };

/** `resultDefinition` for performance rows whose destination is looked up per row (e.g. by ad-set id). */
export function resultDefinitionFor<R extends CountRow>(rows: R[], destinationOf: (row: R) => string | null | undefined): ResultDefinition {
  return resultDefinition(rows.map(r => ({ destinationType: destinationOf(r), spend: r.spend, leads: r.leads, messages: r.messages, calls: r.calls })));
}

/** Owner-facing wording. English for now; these keys move to the translation catalog later. */
export const RESULT_LABELS: Record<ResultKind, { metric: string; short: string; cost: string; help: string }> = {
  whatsapp_conversations: {
    metric: 'WhatsApp conversations',
    short: 'Conversations',
    cost: 'Cost / conversation',
    help: 'WhatsApp conversations Meta reports as started from your ads. They are not bookings or unique customers.',
  },
  conversations: {
    metric: 'Conversations',
    short: 'Conversations',
    cost: 'Cost / conversation',
    help: 'Messaging conversations Meta reports as started from your ads. They are not bookings or unique customers.',
  },
  leads: {
    metric: 'Leads',
    short: 'Leads',
    cost: 'Cost / lead',
    help: 'Instant-form leads Meta reports from your ads. They are not bookings or unique customers.',
  },
  calls: {
    metric: 'Calls',
    short: 'Calls',
    cost: 'Cost / call',
    help: 'Call actions Meta reports from your ads. They are not completed calls or bookings.',
  },
  results: {
    metric: 'Results',
    short: 'Results',
    cost: 'Cost / result',
    help: 'Reported leads + messaging conversations + call actions. These are not verified bookings or unique customers.',
  },
};

const APP_NAMES: Record<MessagingApp, string> = { whatsapp: 'WhatsApp', instagram: 'Instagram', messenger: 'Messenger' };

/** "WhatsApp · Instagram · Messenger" for mixed conversations; null when the name already says it. */
export function resultAppsNote(definition: ResultDefinition): string | null {
  return definition.kind === 'conversations' && definition.apps.length ? definition.apps.map(a => APP_NAMES[a]).join(' · ') : null;
}
