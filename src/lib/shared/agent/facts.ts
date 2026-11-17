/**
 * Business advertising facts: what the owner told DeepVisor, what their ad history shows, and
 * which questions are still worth asking. Pure: no I/O. Storage: public.business_ad_facts.
 *
 * Rules:
 * - A fresh owner answer wins. History fills a fact only when the owner has not answered or the
 *   answer is older than that fact's freshness window.
 * - A question is asked only when neither a fresh answer nor history can supply the fact.
 * - Money is integer minor units (Meta's budget convention) plus an ISO currency. An answer in a
 *   different currency from the ad account is not used for that account.
 */
import { z } from 'zod';

export const FACT_KEYS = ['daily_budget', 'run_days', 'monthly_ceiling', 'whatsapp_greeting', 'client_languages', 'slow_days'] as const;
export type FactKey = (typeof FACT_KEYS)[number];

export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export const CLIENT_LANGUAGES = ['en', 'es'] as const;
/** Upper bound for owner-entered budgets in major units; protects against a missing decimal point. */
export const MAX_BUDGET_MAJOR = 100_000;

const currency = z.string().regex(/^[A-Z]{3}$/);
const money = z.object({ amountMinor: z.number().int().positive(), currency }).strict()
  .refine(v => minorToAmount(v.amountMinor, v.currency) <= MAX_BUDGET_MAJOR, { message: 'Amount is too large' });

export const FACT_SCHEMAS = {
  daily_budget: money,
  run_days: z.object({ days: z.number().int().min(1).max(90) }).strict(),
  monthly_ceiling: money,
  // Meta's click-to-WhatsApp greeting is short; keep well under the stored size bound.
  whatsapp_greeting: z.object({ text: z.string().trim().min(1).max(300) }).strict(),
  client_languages: z.object({ languages: z.array(z.enum(CLIENT_LANGUAGES)).min(1).max(CLIENT_LANGUAGES.length) }).strict()
    .refine(v => new Set(v.languages).size === v.languages.length, { message: 'Duplicate language' }),
  // An empty list is a real answer: "no slow days".
  slow_days: z.object({ days: z.array(z.enum(WEEKDAYS)).max(7) }).strict()
    .refine(v => new Set(v.days).size === v.days.length, { message: 'Duplicate day' }),
} satisfies Record<FactKey, z.ZodTypeAny>;
export type FactValue<K extends FactKey> = z.infer<(typeof FACT_SCHEMAS)[K]>;
export type FactValues = { [K in FactKey]: FactValue<K> };

/** Days after which an owner answer is treated as old and may be asked again. */
export const FACT_FRESH_DAYS: Record<FactKey, number> = {
  daily_budget: 90, run_days: 180, monthly_ceiling: 90, whatsapp_greeting: 365, client_languages: 365, slow_days: 120,
};
/** Facts the ad history can supply. Others only come from the owner. */
export const HISTORY_FACTS = ['daily_budget', 'run_days'] as const satisfies readonly FactKey[];

export function isFactKey(value: unknown): value is FactKey {
  return typeof value === 'string' && (FACT_KEYS as readonly string[]).includes(value);
}

export function parseFact<K extends FactKey>(key: K, value: unknown): FactValue<K> | null {
  const parsed = FACT_SCHEMAS[key].safeParse(value);
  return parsed.success ? (parsed.data as FactValue<K>) : null;
}

/** Fraction digits for a currency (2 for USD, 0 for JPY), matching Meta's budget units. */
export function currencyDigits(code: string): number {
  try { return new Intl.NumberFormat('en', { style: 'currency', currency: code }).resolvedOptions().maximumFractionDigits ?? 2; }
  catch { return 2; }
}
export const minorToAmount = (minor: number, code: string) => minor / 10 ** currencyDigits(code);
/** Owner input such as "20" or "20.50" to minor units; null when not a positive, exact amount. */
export function amountToMinor(amount: number, code: string): number | null {
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const minor = Math.round(amount * 10 ** currencyDigits(code));
  return Math.abs(minor / 10 ** currencyDigits(code) - amount) < 1e-9 ? minor : null;
}

export type StoredFact = { key: FactKey; value: unknown; confirmedAt: string };
export type HistoryFact<K extends FactKey = FactKey> = { value: FactValue<K>; basis: string };
export type HistoryFacts = Partial<{ [K in FactKey]: HistoryFact<K> }>;

export type ResolvedFact<K extends FactKey = FactKey> =
  | { key: K; source: 'owner'; value: FactValue<K>; confirmedAt: string; stale: false }
  | { key: K; source: 'history'; value: FactValue<K>; basis: string; owner: { value: FactValue<K>; confirmedAt: string } | null }
  | { key: K; source: 'owner'; value: FactValue<K>; confirmedAt: string; stale: true }
  | { key: K; source: null };
export type ResolvedFacts = { [K in FactKey]: ResolvedFact<K> };

const DAY_MS = 86_400_000;

/**
 * Combines stored owner answers and history for one ad account. Invalid stored values (schema
 * drift, manual edits) and money in another currency are ignored rather than trusted.
 */
export function resolveFacts(input: { stored: StoredFact[]; history: HistoryFacts; accountCurrency: string | null; now: string }): ResolvedFacts {
  const now = Date.parse(input.now);
  const resolve = <K extends FactKey>(key: K): ResolvedFact<K> => {
    const row = input.stored.find(s => s.key === key);
    let owner = row ? parseFact(key, row.value) : null;
    if (owner && 'currency' in owner && owner.currency !== input.accountCurrency) owner = null;
    const confirmed = row ? Date.parse(row.confirmedAt) : NaN;
    const fresh = owner !== null && Number.isFinite(confirmed) && now - confirmed <= FACT_FRESH_DAYS[key] * DAY_MS;
    const history = input.history[key] as HistoryFact<K> | undefined;
    if (owner && fresh) return { key, source: 'owner', value: owner, confirmedAt: row!.confirmedAt, stale: false };
    if (history) return { key, source: 'history', value: history.value, basis: history.basis, owner: owner ? { value: owner, confirmedAt: row!.confirmedAt } : null };
    if (owner) return { key, source: 'owner', value: owner, confirmedAt: row!.confirmedAt, stale: true };
    return { key, source: null };
  };
  return Object.fromEntries(FACT_KEYS.map(key => [key, resolve(key)])) as ResolvedFacts;
}

/** Facts to ask about, in the order an owner would answer them. Old answers are asked again. */
export function factsToAsk(resolved: ResolvedFacts, keys: readonly FactKey[] = FACT_KEYS): FactKey[] {
  return keys.filter(key => resolved[key].source === null || (resolved[key].source === 'owner' && resolved[key].stale));
}

type AdSetHistory = {
  createdTime: string | null;
  startTime: string | null;
  endTime: string | null;
  /** Ad-set budget, else its campaign's daily budget (campaign budget optimization), minor units. */
  dailyBudgetMinor: number | null;
};

/** Meta budget strings ("2000", "0", null) to positive integer minor units. */
export function budgetMinor(value: unknown): number | null {
  const n = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : typeof value === 'number' ? value : NaN;
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/**
 * What the account's ad sets show: the most recent daily budget and the typical run length.
 * Uses saved Meta configuration only; ad sets without the needed fields are skipped.
 */
export function historyFacts(adSets: AdSetHistory[], accountCurrency: string | null): HistoryFacts {
  const facts: HistoryFacts = {};
  const time = (v: string | null) => (v ? Date.parse(v) : NaN);
  if (accountCurrency && /^[A-Z]{3}$/.test(accountCurrency)) {
    const latest = adSets
      .filter(a => a.dailyBudgetMinor !== null && Number.isFinite(time(a.createdTime)))
      .sort((a, b) => time(b.createdTime) - time(a.createdTime))[0];
    const value = latest ? parseFact('daily_budget', { amountMinor: latest.dailyBudgetMinor, currency: accountCurrency }) : null;
    if (value) facts.daily_budget = { value, basis: 'Your most recent ad set' };
  }
  const lengths = adSets
    .map(a => (time(a.endTime) - time(a.startTime)) / DAY_MS)
    .filter(d => Number.isFinite(d) && d > 0)
    .map(d => Math.max(1, Math.round(d)))
    .sort((a, b) => a - b);
  if (lengths.length) {
    const mid = Math.floor(lengths.length / 2);
    const median = lengths.length % 2 ? lengths[mid] : Math.round((lengths[mid - 1] + lengths[mid]) / 2);
    const value = parseFact('run_days', { days: Math.min(90, median) });
    if (value) facts.run_days = { value, basis: lengths.length === 1 ? 'Your one scheduled ad set' : `Typical of ${lengths.length} scheduled ad sets` };
  }
  return facts;
}
