'use client';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@mantine/core';
import { Eye } from 'lucide-react';
import type { Welcome } from '@/lib/shared/insights/model';
import styles from './WelcomeCard.module.css';

/**
 * The one-time greeting on a person's first popup for an ad account. The popup headline already
 * names the situation, so this is a short lead sentence; the cards below carry the details (7-day
 * recap, the "run your best ad again" suggestion, or account issues). An account that never
 * advertised gets the three Quick ad steps and the button. `hasSuggestion` avoids offering a
 * Quick ad twice.
 */
export default function WelcomeCard({ welcome, hasSuggestion, interactive = true }: { welcome: Welcome; hasSuggestion: boolean; interactive?: boolean }) {
  const t = useTranslations('welcome');
  const locale = useLocale();
  const date = welcome.kind === 'off'
    ? new Intl.DateTimeFormat(locale === 'es' ? 'es-US' : 'en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${welcome.lastSpendDay}T12:00:00Z`))
    : '';
  const quickAd = welcome.kind === 'new' || (welcome.kind === 'off' && !hasSuggestion);
  const lead = welcome.kind === 'running' ? t('runningBody') : welcome.kind === 'off' ? (hasSuggestion ? t('offBody', { date }) : t('offBodyNoSuggestion', { date })) : t('newBody');
  const button = interactive
    ? <Button size="md" component={Link} href="/campaigns/quick">{t('quickAd')}</Button>
    : <Button size="md" aria-disabled>{t('quickAd')}</Button>;

  if (!quickAd) return <p className={styles.lead}>{lead}</p>;
  return (
    <section className={styles.start} aria-label={t('quickAd')}>
      <p className={styles.lead}>{lead}</p>
      {welcome.kind === 'new' && (
        <ol className={styles.steps}>
          <li><span aria-hidden="true">1</span>{t('stepMedia')}</li>
          <li><span aria-hidden="true">2</span>{t('stepMessage')}</li>
          <li><span aria-hidden="true">3</span>{t('stepBudget')}</li>
        </ol>
      )}
      <div className={styles.actions}>{button}</div>
      <p className={styles.reassure}><Eye size={16} aria-hidden="true" />{t('review')}</p>
    </section>
  );
}
