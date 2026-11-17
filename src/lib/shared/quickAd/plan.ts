/**
 * Quick ad: which saved ad set to reuse and what the draft needs, from the owner's request,
 * their saved answers and their ad history. Pure: no I/O, no model calls.
 *
 * The draft copies the chosen ad set's configuration (targeting, optimization, WhatsApp
 * destination) through the existing reuse flow; only the creative, text, budget and dates are new.
 */
import { resultChannel } from '@/lib/shared/performance/resultChannel';
import { amountToMinor, minorToAmount, type FactKey, type ResolvedFacts } from '@/lib/shared/agent/facts';
import { localMidnightUtc } from '@/lib/shared/time/zone';

export { dayIn, localMidnightUtc } from '@/lib/shared/time/zone';

export type SourceAdSet = {
  adSetId: string;
  campaignId: string;
  name: string;
  destinationType: string | null;
  status: string | null;
  createdTime: string | null;
  /** Saved totals for the last 90 days; null when unknown. */
  spend: number | null;
  results: number | null;
};
export type SourceChoice = SourceAdSet & { reason: 'cheapest' | 'recent' };

const UNUSABLE_STATUS = /deleted|archived/i;
const MIN_RESULTS_FOR_COST = 3;

/**
 * Prefers WhatsApp ad sets, then other messaging ad sets. Among them, the lowest cost per
 * result with enough results to compare; otherwise the most recently created one.
 */
export function chooseSourceAdSet(adSets: SourceAdSet[]): SourceChoice | null {
  const usable = adSets.filter(a => !UNUSABLE_STATUS.test(a.status ?? ''));
  const whatsapp = usable.filter(a => resultChannel(a.destinationType) === 'whatsapp');
  const pool = whatsapp.length ? whatsapp : usable.filter(a => resultChannel(a.destinationType) === 'messaging');
  if (!pool.length) return null;
  const proven = pool
    .filter(a => a.spend !== null && a.results !== null && a.results >= MIN_RESULTS_FOR_COST && a.spend > 0)
    .sort((a, b) => a.spend! / a.results! - b.spend! / b.results! || a.adSetId.localeCompare(b.adSetId));
  if (proven.length) return { ...proven[0], reason: 'cheapest' };
  const time = (a: SourceAdSet) => (a.createdTime ? Date.parse(a.createdTime) : NaN);
  const recent = [...pool].sort((a, b) => (time(b) || 0) - (time(a) || 0) || a.adSetId.localeCompare(b.adSetId))[0];
  return { ...recent, reason: 'recent' };
}

export type QuickAdRequest = {
  /** Owner override for this ad only, in major units of the account currency. */
  dailyBudget?: number | null;
  days?: number | null;
};
export type QuickAdPlan = {
  dailyBudget: { amountMinor: number; currency: string; source: 'request' | 'owner' | 'history' } | null;
  days: { value: number; source: 'request' | 'owner' | 'history' } | null;
  languages: Array<'en' | 'es'> | null;
  greeting: string | null;
  /** Facts the owner must answer before a draft can be made. */
  missing: FactKey[];
  /** Planned spend (daily × days) above the owner's monthly limit; shown, not blocked. */
  overMonthlyLimit: boolean;
};

const factSource = (s: 'owner' | 'history') => s;

export function planQuickAd(input: { facts: ResolvedFacts; request: QuickAdRequest; accountCurrency: string | null; needsGreeting: boolean }): QuickAdPlan {
  const { facts, request, accountCurrency } = input;
  const missing: FactKey[] = [];

  let dailyBudget: QuickAdPlan['dailyBudget'] = null;
  const requested = accountCurrency && request.dailyBudget != null ? amountToMinor(request.dailyBudget, accountCurrency) : null;
  if (requested !== null && accountCurrency) dailyBudget = { amountMinor: requested, currency: accountCurrency, source: 'request' };
  else if (facts.daily_budget.source) dailyBudget = { ...facts.daily_budget.value, source: factSource(facts.daily_budget.source) };
  else missing.push('daily_budget');

  let days: QuickAdPlan['days'] = null;
  if (request.days != null && Number.isInteger(request.days) && request.days >= 1 && request.days <= 90) days = { value: request.days, source: 'request' };
  else if (facts.run_days.source) days = { value: facts.run_days.value.days, source: factSource(facts.run_days.source) };
  else missing.push('run_days');

  const languages = facts.client_languages.source ? facts.client_languages.value.languages : null;
  if (!languages) missing.push('client_languages');

  const greeting = facts.whatsapp_greeting.source ? facts.whatsapp_greeting.value.text : null;
  if (input.needsGreeting && !greeting) missing.push('whatsapp_greeting');

  const ceiling = facts.monthly_ceiling.source ? facts.monthly_ceiling.value : null;
  const overMonthlyLimit = Boolean(dailyBudget && days && ceiling && ceiling.currency === dailyBudget.currency &&
    dailyBudget.amountMinor * Math.min(days.value, 31) > ceiling.amountMinor);

  return { dailyBudget, days, languages, greeting, missing, overMonthlyLimit };
}

const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** Starts at the next local midnight and runs whole local days. */
export function quickAdSchedule(input: { today: string; zone: string; days: number }) {
  const startDay = addDays(input.today, 1);
  return { startAt: localMidnightUtc(startDay, input.zone).toISOString(), endAt: localMidnightUtc(addDays(startDay, input.days), input.zone).toISOString(), startDay };
}

export const budgetMajor = (budget: { amountMinor: number; currency: string }) => minorToAmount(budget.amountMinor, budget.currency);
