'use client';
import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Alert, Button } from '@mantine/core';
import { Eye, Lightbulb, TriangleAlert } from 'lucide-react';
import { STATS_DAYS, type IdleSuggestion } from '@/lib/shared/suggestions/idle';
import { MediaImage } from '@/components/campaigns/exploration/AdvertisingExplorer';
import { prepareRestartDraftAction } from '@/lib/server/actions/suggestions/restart';
import ProjectionChart from './ProjectionChart';
import styles from './IdleSuggestionCard.module.css';

/**
 * "Your ads are off" card in the Insights popup: run the best ad again (paused draft for review)
 * or open Quick ad with the same budget prefilled. An ad account problem Meta reports comes first.
 * In preview/history (`interactive = false`) the buttons are shown but do nothing.
 *
 * Reading order, for owners of every age: the ad's picture and its three plain numbers, then
 * "if you run it again" (cost of the plan and the estimated range, drawn as it opens), then one
 * clear main button. `welcomed` drops the "off since" line when the welcome already said it.
 */
export default function IdleSuggestionCard({ suggestion, currency, interactive = true, welcomed = false }: { suggestion: IdleSuggestion; currency: string | null; interactive?: boolean; welcomed?: boolean }) {
  const t = useTranslations('suggestion');
  const tAll = useTranslations();
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
  const count = (v: number) => new Intl.NumberFormat(intlLocale).format(v);

  if (suggestion.kind === 'account') {
    return (
      <section className={`${styles.card} ${styles.blocked}`} aria-labelledby="idle-suggestion">
        <span className={styles.blockedIcon} aria-hidden="true"><TriangleAlert size={22} /></span>
        <div className={styles.blockedBody}>
          {!welcomed && <p className={styles.since}>{t('offSince', { date })}</p>}
          <h3 id="idle-suggestion">{t('accountTitle')}</h3>
          <p>{suggestion.issue ? t('accountBody', { issue: suggestion.issue }) : t('accountBodyGeneric')}</p>
          <div className={styles.actions}>
            <Button component="a" href="https://adsmanager.facebook.com/" target="_blank" rel="noreferrer" size="md" color="red">{t('openAdsManager')}</Button>
          </div>
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
  const { forecast, stats } = suggestion;
  const kind = suggestion.result?.kind ?? 'results';
  const dash = '—';

  return (
    <section className={styles.card} aria-labelledby="idle-suggestion">
      <header className={styles.header}>
        <span className={styles.ideaIcon} aria-hidden="true"><Lightbulb size={20} /></span>
        <div>
          <h3 id="idle-suggestion">{t('restartTitle')}</h3>
          {!welcomed && <p className={styles.since}>{t('offSince', { date })}</p>}
        </div>
      </header>

      {/* The ad itself: owners recognise it by its picture, then its own numbers. */}
      <article className={styles.ad} aria-label={suggestion.adSetName}>
        <div className={styles.media}>
          <MediaImage media={suggestion.media ?? undefined} name={suggestion.adSetName} labelPosition="top" dashboard />
        </div>
        <div className={styles.adBody}>
          <p className={styles.adName}>{suggestion.adSetName}</p>
          <p className={styles.reason}>{suggestion.reason === 'cheapest' ? t('whyCheapest') : t('whyRecent')}</p>
          <p className={styles.period}>{t('statsPeriod', { days: STATS_DAYS })}</p>
          {stats && (
            <dl className={styles.stats}>
              <div className={styles.lead}>
                <dt>{tAll(`results.${kind}.short`)}</dt>
                <dd>{stats.results === null ? dash : count(stats.results)}</dd>
              </div>
              <div>
                <dt>{t('spent')}</dt>
                <dd>{stats.spend === null ? dash : money(stats.spend)}</dd>
              </div>
              <div>
                <dt>{tAll(`results.${kind}.cost`)}</dt>
                <dd>{stats.costPerResult === null ? dash : money(stats.costPerResult, true)}</dd>
              </div>
            </dl>
          )}
        </div>
      </article>

      {suggestion.dailyBudget !== null && (
        <div className={styles.plan}>
          <h4>{t('ifAgain')}</h4>
          <p className={styles.planLine}>
            {t('planShort', { budget: money(suggestion.dailyBudget), days: suggestion.days })}
            <span className={styles.planTotal}>{t('planTotal', { total: money(suggestion.dailyBudget * suggestion.days) })}</span>
          </p>
          {forecast ? (
            <>
              <ProjectionChart
                low={forecast.low}
                high={forecast.high}
                days={suggestion.days}
                dayLabel={day => t('day', { day })}
                rangeLabel={`${count(forecast.low)}–${count(forecast.high)}`}
                ariaLabel={t('forecastAria', { low: forecast.low, high: forecast.high, days: suggestion.days })}
              />
              <p className={styles.estimate}>
                <strong>{t('estimate', { low: count(forecast.low), high: count(forecast.high) })}</strong>{' '}
                {t('estimateBasis', { costLow: money(forecast.costLow, true), costHigh: money(forecast.costHigh, true), weeks: forecast.weeks })}
              </p>
            </>
          ) : <p className={styles.estimate}>{t('noForecast')}</p>}
        </div>
      )}

      <div className={styles.actions}>
        {/* Preview and history keep the real button look (main vs. second choice); they do nothing there. */}
        {suggestion.dailyBudget !== null && (
          <Button size="md" onClick={interactive ? prepare : undefined} loading={pending} aria-disabled={!interactive || undefined}>{t('prepare')}</Button>
        )}
        {interactive
          ? <Button size="md" component={Link} href={quickHref} variant="default">{t('newAd')}</Button>
          : <Button size="md" variant="default" aria-disabled>{t('newAd')}</Button>}
      </div>
      <p className={styles.reassure}><Eye size={16} aria-hidden="true" />{t('review')}</p>
      {error && <Alert color="red" variant="light" role="alert">{error}</Alert>}
    </section>
  );
}
