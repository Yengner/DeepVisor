'use client';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { minorToAmount, type FactKey, type FactValues, type HistoryBasis, type ResolvedFact } from '@/lib/shared/agent/facts';

/** Fact values and their source, worded in the viewer's language. */
export function useFactText() {
  const t = useTranslations();
  const format = useFormatter();
  const locale = useLocale();
  const money = (v: { amountMinor: number; currency: string }) =>
    new Intl.NumberFormat(locale === 'es' ? 'es-US' : 'en-US', { style: 'currency', currency: v.currency }).format(minorToAmount(v.amountMinor, v.currency));

  const value = <K extends FactKey>(key: K, raw: FactValues[K]): string => {
    const v = raw as FactValues[FactKey];
    switch (key) {
      case 'daily_budget': return t('facts.value.perDay', { amount: money(v as FactValues['daily_budget']) });
      case 'monthly_ceiling': return t('facts.value.perMonth', { amount: money(v as FactValues['monthly_ceiling']) });
      case 'run_days': return t('facts.value.days', { days: (v as FactValues['run_days']).days });
      case 'whatsapp_greeting': return t('facts.value.quoted', { text: (v as FactValues['whatsapp_greeting']).text });
      case 'client_languages': return (v as FactValues['client_languages']).languages.map(l => t(`languages.${l}`)).join(', ');
      case 'slow_days': {
        const days = (v as FactValues['slow_days']).days;
        return days.length ? days.map(d => t(`days.${d}`)).join(', ') : t('facts.value.noSlowDays');
      }
      default: return '';
    }
  };

  const basis = (b: HistoryBasis) => (b.code === 'typical' ? t('facts.basis.typical', { count: b.count }) : t(`facts.basis.${b.code}`));

  const source = (fact: ResolvedFact): string => {
    if (fact.source === 'owner') {
      const date = format.dateTime(new Date(fact.confirmedAt), { month: 'short', day: 'numeric', year: 'numeric' });
      return t(fact.stale ? 'facts.source.ownerStale' : 'facts.source.owner', { date });
    }
    if (fact.source === 'history') return t('facts.source.history', { basis: basis(fact.basis) });
    return '';
  };

  return { value, source };
}
