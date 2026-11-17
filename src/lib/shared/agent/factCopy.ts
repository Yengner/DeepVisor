/**
 * Owner-facing wording for advertising facts. Shared by Settings and the draft flow so a question
 * reads the same everywhere. English for now; these keys move to the translation catalog later.
 */
import { minorToAmount, type FactKey, type FactValues, type ResolvedFact } from './facts';

export const FACT_COPY: Record<FactKey, { label: string; question: string; help: string }> = {
  daily_budget: {
    label: 'Usual daily budget',
    question: 'How much do you usually spend per day on an ad?',
    help: 'Used as the starting budget for new drafts. You can change it on each draft.',
  },
  run_days: {
    label: 'Usual run length',
    question: 'How many days do your ads usually run?',
    help: 'Used to set the end date on new drafts.',
  },
  monthly_ceiling: {
    label: 'Monthly limit',
    question: 'What is the most you want to spend on ads in a month?',
    help: 'Drafts that would go over this are flagged before you publish.',
  },
  whatsapp_greeting: {
    label: 'WhatsApp greeting',
    question: 'What message should clients send you when they tap your ad?',
    help: 'Pre-filled in WhatsApp so clients do not have to type the first message.',
  },
  client_languages: {
    label: 'Client languages',
    question: 'Which languages do your clients speak?',
    help: 'Drafts include ad text in each language.',
  },
  slow_days: {
    label: 'Slow days',
    question: 'Which days do you most want to fill?',
    help: 'Drafts can focus on these days.',
  },
};

const DAY_NAMES = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' } as const;
const LANGUAGE_NAMES = { en: 'English', es: 'Spanish' } as const;
export const DAY_LABELS = DAY_NAMES;
export const LANGUAGE_LABELS = LANGUAGE_NAMES;

function money(value: { amountMinor: number; currency: string }) {
  return new Intl.NumberFormat('en', { style: 'currency', currency: value.currency }).format(minorToAmount(value.amountMinor, value.currency));
}

/** A fact's value as a short phrase, e.g. "$20.00 a day" or "Mon, Tue". */
export function formatFactValue<K extends FactKey>(key: K, value: FactValues[K]): string {
  const v = value as FactValues[FactKey];
  switch (key) {
    case 'daily_budget': return `${money(v as FactValues['daily_budget'])} a day`;
    case 'monthly_ceiling': return `${money(v as FactValues['monthly_ceiling'])} a month`;
    case 'run_days': { const days = (v as FactValues['run_days']).days; return `${days} day${days === 1 ? '' : 's'}`; }
    case 'whatsapp_greeting': return `“${(v as FactValues['whatsapp_greeting']).text}”`;
    case 'client_languages': return (v as FactValues['client_languages']).languages.map(l => LANGUAGE_NAMES[l]).join(', ');
    case 'slow_days': { const days = (v as FactValues['slow_days']).days; return days.length ? days.map(d => DAY_NAMES[d]).join(', ') : 'No slow days'; }
    default: return '';
  }
}

const shortDate = (at: string) => new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(at));

/** Where a fact came from, e.g. "You told us · Nov 16, 2026" or "From your ads · Your most recent ad set". */
export function factSource(fact: ResolvedFact): string {
  if (fact.source === 'owner') return fact.stale ? `You told us · ${shortDate(fact.confirmedAt)} · may be out of date` : `You told us · ${shortDate(fact.confirmedAt)}`;
  if (fact.source === 'history') return `From your ads · ${fact.basis}`;
  return 'Not answered yet';
}
