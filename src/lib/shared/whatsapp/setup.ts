/**
 * WhatsApp number setup: which number a business's ads should send chats to.
 * Finding a number and recording its chats are separate things (see `WhatsAppTracking`).
 */

export type WhatsAppCandidate = {
  /** "+" followed by digits, with country code. */
  number: string;
  /** Ad sets in the selected ad account that send chats to this number. */
  adSets: number;
  activeAdSets: number;
  /** Found on a WhatsApp account in the business portfolio that owns the ad account. */
  inPortfolio: boolean;
  /** Name Meta shows for the portfolio number. */
  name: string | null;
  /** Whether it uses the WhatsApp Business phone app; null when Meta didn't say. */
  onPhoneApp: boolean | null;
};

/** `saved` is the last sync's ad sets, used only when the live read fails. */
export type WhatsAppAdsCheck = 'live' | 'saved' | 'unavailable';

export type WhatsAppTracking =
  | { status: 'on'; phone: string | null }
  | { status: 'available'; appId: string; configId: string }
  | { status: 'unavailable' }
  | { status: 'view_only' };

export type WhatsAppSetupData = {
  candidates: WhatsAppCandidate[];
  adsCheck: WhatsAppAdsCheck;
  accountName: string | null;
  saved: { number: string | null; completed: boolean };
  pagePhone: string | null;
  tracking: WhatsAppTracking;
};

/** Accepts spaces, dashes, dots and brackets; returns "+digits" or null. */
export function normalizeWhatsAppNumber(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const compact = value.trim().replace(/[\s\-().]/g, '');
  return /^\+?[1-9]\d{6,14}$/.test(compact) ? `+${compact.replace(/^\+/, '')}` : null;
}

export function sameWhatsAppNumber(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = normalizeWhatsAppNumber(a);
  return left !== null && left === normalizeWhatsAppNumber(b);
}

export function formatWhatsAppNumber(value: string): string {
  const us = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(value);
  return us ? `+1 (${us[1]}) ${us[2]}-${us[3]}` : value;
}

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

/** Reads `promoted_object.whatsapp_phone_number` from Meta ad set objects. */
export function whatsAppNumbersFromAdSets(adSets: unknown[]): WhatsAppCandidate[] {
  const found = new Map<string, WhatsAppCandidate>();
  for (const adSet of adSets) {
    const { promoted_object: promoted, effective_status: status } = record(adSet);
    const number = normalizeWhatsAppNumber(record(promoted).whatsapp_phone_number);
    if (!number) continue;
    const entry = found.get(number)
      ?? { number, adSets: 0, activeAdSets: 0, inPortfolio: false, name: null, onPhoneApp: null };
    entry.adSets += 1;
    if (status === 'ACTIVE') entry.activeAdSets += 1;
    found.set(number, entry);
  }
  return [...found.values()];
}

export type PortfolioNumber = { number: string; name: string | null; onPhoneApp: boolean | null };

/** Numbers the ads use come first; a portfolio entry only adds detail to them. */
export function mergeWhatsAppCandidates(fromAds: WhatsAppCandidate[], portfolio: PortfolioNumber[]): WhatsAppCandidate[] {
  const merged = new Map(fromAds.map(candidate => [candidate.number, { ...candidate }]));
  for (const item of portfolio) {
    const entry = merged.get(item.number)
      ?? { number: item.number, adSets: 0, activeAdSets: 0, inPortfolio: false, name: null, onPhoneApp: null };
    entry.inPortfolio = true;
    entry.name ??= item.name;
    // Meta can list one number twice; "on the phone app" in either entry wins.
    entry.onPhoneApp = entry.onPhoneApp || item.onPhoneApp;
    merged.set(item.number, entry);
  }
  return [...merged.values()].sort((a, b) =>
    b.activeAdSets - a.activeAdSets || b.adSets - a.adSets || a.number.localeCompare(b.number));
}

/** The saved number is suspect when this account's ads send chats elsewhere, e.g. after switching accounts. */
export function savedNumberMismatch(saved: string | null, candidates: WhatsAppCandidate[]): boolean {
  const used = candidates.filter(candidate => candidate.adSets > 0);
  return Boolean(saved) && used.length > 0 && !used.some(candidate => sameWhatsAppNumber(candidate.number, saved));
}

/** Preselect only when there is one obvious answer. */
export function defaultWhatsAppChoice(saved: string | null, candidates: WhatsAppCandidate[]): string | null {
  const current = candidates.find(candidate => sameWhatsAppNumber(candidate.number, saved));
  if (current && !savedNumberMismatch(saved, candidates)) return current.number;
  const running = candidates.filter(candidate => candidate.activeAdSets > 0);
  if (running.length === 1) return running[0].number;
  const used = candidates.filter(candidate => candidate.adSets > 0);
  if (used.length === 1) return used[0].number;
  return candidates.length === 1 ? candidates[0].number : null;
}
