/**
 * Rules for the "All businesses" page: where each ad set is in its schedule, and which business
 * to look at first. Pure; delivery state comes from the saved delivery chain, never from spend.
 */
export type TimelineState = 'running' | 'scheduled' | 'ended' | 'off' | 'unknown';

export type AdTimeline = {
  state: TimelineState;
  start: string | null;
  end: string | null;
  /** 0..1 through the schedule; null without both dates. Never estimated. */
  progress: number | null;
  /** Whole days until the end, rounded up; null unless running or scheduled with an end date. */
  daysLeft: number | null;
};

const DAY = 86_400_000;
/** Ended ad sets stay on the page this long, so a just-finished run is still visible. */
export const RECENTLY_ENDED_DAYS = 30;
export const ENDING_SOON_DAYS = 2;
export const STALE_HOURS = 24;

const time = (value: string | null | undefined) => {
  const parsed = value ? Date.parse(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
};

/** The first end that applies: an ad set stops at its own end or its campaign's, whichever is earlier. */
export function earliestEnd(...ends: Array<string | null | undefined>): string | null {
  return ends.filter((end): end is string => time(end) !== null).sort((a, b) => time(a)! - time(b)!)[0] ?? null;
}

/** `delivery` is a `deliveryStatuses` value for the ad set (ACTIVE, SCHEDULED, COMPLETED, …). */
export function adTimeline(input: { delivery: string | null; start: string | null; end: string | null; now: string }): AdTimeline {
  const now = time(input.now)!;
  const start = time(input.start), end = time(input.end);
  const state: TimelineState = input.delivery === 'ACTIVE' ? 'running'
    : input.delivery === 'SCHEDULED' ? 'scheduled'
    : input.delivery === 'COMPLETED' ? 'ended'
    : !input.delivery || input.delivery === 'UNKNOWN' ? 'unknown' : 'off';
  const progress = start !== null && end !== null && end > start && state !== 'off' && state !== 'unknown'
    ? Math.min(1, Math.max(0, (now - start) / (end - start))) : null;
  const daysLeft = end !== null && end > now && (state === 'running' || state === 'scheduled') ? Math.ceil((end - now) / DAY) : null;
  return { state, start: start === null ? null : input.start, end: end === null ? null : input.end, progress, daysLeft };
}

export function showOnPortfolio(timeline: AdTimeline, now: string): boolean {
  if (timeline.state === 'running' || timeline.state === 'scheduled') return true;
  const end = time(timeline.end);
  return timeline.state === 'ended' && end !== null && time(now)! - end <= RECENTLY_ENDED_DAYS * DAY;
}

/** Listed in the order a business should be looked at; `ok` means no issue DeepVisor knows of. */
export const ATTENTION_ORDER = ['urgent', 'neverSynced', 'stale', 'adsOff', 'endingSoon', 'noAccount', 'notSynced', 'ok'] as const;
export type Attention = (typeof ATTENTION_ORDER)[number];

export type AttentionInput = {
  /** False for a client business DeepVisor doesn't sync. Nothing about its ads is known. */
  synced: boolean;
  linkedAccounts: number;
  /** An open urgent Meta issue, or a connection that must be reconnected. */
  urgent: boolean;
  lastSynced: string | null;
  /** Ads on a complete active delivery chain; null when unknown. */
  runningAds: number | null;
  endingSoon: number;
  now: string;
};

export function isStale(lastSynced: string | null, now: string): boolean {
  const synced = time(lastSynced);
  return synced === null || time(now)! - synced > STALE_HOURS * 3_600_000;
}

export function attentionFor(input: AttentionInput): Attention {
  if (!input.synced) return input.linkedAccounts > 0 ? 'notSynced' : 'noAccount';
  if (input.urgent) return 'urgent';
  if (time(input.lastSynced) === null) return 'neverSynced';
  if (isStale(input.lastSynced, input.now)) return 'stale';
  if (input.runningAds === 0) return 'adsOff';
  // Unknown delivery is never reported as healthy.
  if (input.runningAds === null) return 'stale';
  return input.endingSoon > 0 ? 'endingSoon' : 'ok';
}

export function compareByAttention<T extends { attention: Attention; name: string }>(a: T, b: T): number {
  return ATTENTION_ORDER.indexOf(a.attention) - ATTENTION_ORDER.indexOf(b.attention) || a.name.localeCompare(b.name);
}

/** The account number without `act_`, or null when it isn't one. */
export function accountNumber(externalAccountId: string | null | undefined): string | null {
  const id = externalAccountId?.trim().replace(/^act_/, '') ?? '';
  return /^\d{1,20}$/.test(id) ? id : null;
}

export const SERVICE_LEVELS = ['managed', 'assisted', 'premium', 'self_serve'] as const;
export type ServiceLevel = (typeof SERVICE_LEVELS)[number];

/** A money amount typed by a person, in cents. Empty means no fee recorded; null means invalid. */
export function feeCents(value: string): number | '' | null {
  const text = value.trim().replace(/[$,\s]/g, '');
  if (!text) return '';
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(text)) return null;
  return Math.round(Number(text) * 100);
}

/** Paid-through is a date; `today` is YYYY-MM-DD. No date means nothing was recorded, not unpaid. */
export function paymentState(paidThrough: string | null, today: string): 'unrecorded' | 'paid' | 'due' {
  if (!paidThrough) return 'unrecorded';
  return paidThrough >= today ? 'paid' : 'due';
}

/** Where to go after switching business: an in-app path only. */
export function safeAppPath(path: string | null | undefined): string {
  return path && /^\/(?![/\\])[^\s\\]*$/.test(path) ? path : '/dashboard';
}
