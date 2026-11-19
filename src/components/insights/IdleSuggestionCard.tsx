'use client';
import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Alert, Button } from '@mantine/core';
import type { IdleSuggestion } from '@/lib/shared/suggestions/idle';
import { prepareRestartDraftAction } from '@/lib/server/actions/suggestions/restart';
import styles from './IdleSuggestionCard.module.css';

/**
 * "Your ads are off" card in the Insights popup: run the best ad again (paused draft for review)
 * or open Quick ad with the same budget prefilled. An ad account problem Meta reports comes first.
 * In preview/history (`interactive = false`) the buttons are shown but do nothing.
 */
export default function IdleSuggestionCard({ suggestion, currency, interactive = true }: { suggestion: IdleSuggestion; currency: string | null; interactive?: boolean }) {
  const t = useTranslations('suggestion');
  const locale = useLocale();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const intlLocale = locale === 'es' ? 'es-US' : 'en-US';
  const date = new Intl.DateTimeFormat(intlLocale, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${suggestion.lastSpendDay}T12:00:00Z`));
  // Budgets read as whole amounts when they are; costs always show cents so a range reads evenly.
  const money = (v: number, cents = !Number.isInteger(v)) => currency
    ? new Intl.NumberFormat(intlLocale, { style: 'currency', currency, minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 }).format(v)
    : v.toFixed(2);

  if (suggestion.kind === 'account') {
    return (
      <section className={styles.card} aria-labelledby="idle-suggestion">
        <p className={styles.eyebrow}>{t('offSince', { date })}</p>
        <h3 id="idle-suggestion">{t('accountTitle')}</h3>
        <p>{suggestion.issue ? t('accountBody', { issue: suggestion.issue }) : t('accountBodyGeneric')}</p>
        <div className={styles.actions}>
          <Button component="a" href="https://adsmanager.facebook.com/" target="_blank" rel="noreferrer" variant="light">{t('openAdsManager')}</Button>
        </div>
      </section>
    );
  }

  const prepare = () => start(async () => {
    setError(null);
    const result = await prepareRestartDraftAction(suggestion.adSetId);
    if (!result.success) { setError(result.error?.userMessage ?? t('error.failed')); return; }
    if (result.data) router.push(result.data.href);
  });
  const quickHref = `/campaigns/quick?days=${suggestion.days}${suggestion.dailyBudget !== null ? `&budget=${suggestion.dailyBudget}` : ''}`;
  const { forecast } = suggestion;

  return (
    <section className={styles.card} aria-labelledby="idle-suggestion">
      <p className={styles.eyebrow}>{t('offSince', { date })}</p>
      <h3 id="idle-suggestion">{t('restartTitle')}</h3>
      <p>
        <strong>{suggestion.adSetName}</strong>{' '}
        {suggestion.reason === 'cheapest' && suggestion.costPerResult !== null
          ? t('bestCost', { cost: money(suggestion.costPerResult, true) }) : t('mostRecent')}
      </p>
      {suggestion.dailyBudget !== null && <p>{t('plan', { budget: money(suggestion.dailyBudget), days: suggestion.days })}</p>}
      {forecast ? (
        <p className={styles.forecast}>
          {t('forecast', { low: forecast.low, high: forecast.high, costLow: money(forecast.costLow, true), costHigh: money(forecast.costHigh, true) })}{' '}
          <span className={styles.muted}>{t('forecastNote', { weeks: forecast.weeks })}</span>
        </p>
      ) : <p className={styles.muted}>{t('noForecast')}</p>}
      <div className={styles.actions}>
        {suggestion.dailyBudget !== null && (
          <Button onClick={interactive ? prepare : undefined} loading={pending} disabled={!interactive}>{t('prepare')}</Button>
        )}
        {interactive
          ? <Button component={Link} href={quickHref} variant="default">{t('newAd')}</Button>
          : <Button variant="default" disabled>{t('newAd')}</Button>}
      </div>
      <p className={styles.muted}>{t('review')}</p>
      {error && <Alert color="red" variant="light" role="alert">{error}</Alert>}
    </section>
  );
}
