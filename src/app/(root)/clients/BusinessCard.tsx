import { getTranslations } from 'next-intl/server';
import { Button } from '@mantine/core';
import OpenBusinessButton from '@/components/clients/OpenBusinessButton';
import type { PortfolioBusiness } from '@/lib/server/clients/load';
import { paymentState, type Attention } from '@/lib/shared/clients/model';
import { adsManagerLink } from '@/lib/shared/insights/health';
import { dailyNotificationKeys, formatNotificationPreviewMessage } from '@/lib/shared';
import { CONTROL_METRICS, metricValue, useMetricLabels } from '../dashboard/components/ControlMetrics';
import type { ControlPerformance } from '@/lib/server/dashboard/overview/controlModel';
import AdRuns from './AdRuns';
import styles from './Clients.module.css';

const TONE: Record<Attention, 'bad' | 'warn' | 'quiet' | 'good'> = {
  urgent: 'bad', neverSynced: 'warn', stale: 'warn', adsOff: 'warn', endingSoon: 'warn', noAccount: 'quiet', notSynced: 'quiet', ok: 'good',
};

function Metrics({ performance }: { performance: ControlPerformance }) {
  const { labels } = useMetricLabels(performance.result);
  return <dl className={styles.metrics}>{CONTROL_METRICS.map((key) => <div key={key}><dt>{labels[key]}</dt><dd>{metricValue(key, performance.metrics[key], performance.currency)}</dd></div>)}</dl>;
}

export default async function BusinessCard({ business, locale, now }: { business: PortfolioBusiness; locale: string; now: string }) {
  const t = await getTranslations('clients');
  const tText = await getTranslations('notificationText');
  const { synced, engagement } = business;
  const when = (value: string, zone?: string) => new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: zone }).format(new Date(value));
  const accounts = synced
    ? [{ externalAccountId: synced.externalAccountId, name: synced.name }]
    : business.links;
  const payment = engagement ? paymentState(engagement.paidThrough, now.slice(0, 10)) : null;
  return (
    <li className={styles.card}>
      <div className={styles.cardHead}>
        <div>
          <h2 className={styles.name}>{business.name}</h2>
          <p className={styles.muted}>
            {[business.location, business.isOwn ? t('yours') : engagement ? t(`service.${engagement.serviceLevel}`) : null].filter(Boolean).join(' · ')}
          </p>
        </div>
        <span className={styles.badge} data-tone={TONE[business.attention]}>{t(`attention.${business.attention}`)}</span>
      </div>

      {business.failed && <p role="alert" className={styles.issue}>{t('loadFailed')}</p>}

      {synced ? (
        <>
          <p className={styles.muted}>
            {synced.name ?? t('unnamedAccount')} · {synced.lastSynced ? t('lastSynced', { when: when(synced.lastSynced, synced.timezone) }) : t('attention.neverSynced')}
          </p>
          {synced.needsReconnect && <p className={styles.issue}>{t('reconnect')}</p>}
          {synced.issues.map((issue, index) => <p key={index} className={styles.issue}>{issue}</p>)}
          {synced.performance && (
            <section className={styles.section} aria-label={t('last7')}>
              <h3>{t('last7')}{synced.performance.partial ? ` · ${t('partial')}` : ''}</h3>
              <Metrics performance={synced.performance} />
            </section>
          )}
          <section className={styles.section}>
            <h3>{t('runs.title')}</h3>
            <AdRuns runs={synced.runs} zone={synced.timezone} locale={locale} />
          </section>
        </>
      ) : !business.failed && (
        <p className={styles.note}>{business.links.length ? t('notSyncedBody', { accounts: business.links.map((link) => link.name ?? `…${link.externalAccountId.slice(-4)}`).join(', ') }) : t('noAccountBody')}</p>
      )}

      <section className={styles.section}>
        <h3>{t('alerts.title')}{business.unread ? ` · ${t('alerts.unread', { count: business.unread })}` : ''}</h3>
        {business.alerts.length === 0 ? <p className={styles.muted}>{t('alerts.none')}</p> : (
          <ul className={styles.alerts}>
            {business.alerts.map((alert) => {
              const daily = dailyNotificationKeys(alert);
              return (
                <li key={alert.id}>
                  <span>
                    <strong>{daily ? tText(daily.title, { count: daily.count }) : alert.title}</strong>{' '}
                    {daily ? tText(daily.message) : formatNotificationPreviewMessage(alert.message)}
                  </span>
                  {alert.createdAt && <time className={styles.muted} dateTime={alert.createdAt}>{when(alert.createdAt)}</time>}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {engagement && (
        <p className={styles.muted}>
          {engagement.monthlyFeeCents === null ? t('fee.none') : t('fee.monthly', { amount: new Intl.NumberFormat(locale, { style: 'currency', currency: engagement.currency }).format(engagement.monthlyFeeCents / 100) })}
          {' · '}
          <span className={payment === 'due' ? styles.issue : undefined}>
            {payment === 'unrecorded' ? t('fee.unrecorded') : t(`fee.${payment!}`, { date: new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${engagement.paidThrough}T00:00:00Z`)) })}
          </span>
          {engagement.contentAddon ? ` · ${t('fee.content')}` : ''}
        </p>
      )}

      <div className={styles.actions}>
        <OpenBusinessButton businessId={business.businessId}>{t('open')}</OpenBusinessButton>
        {synced && <OpenBusinessButton businessId={business.businessId} path="/reports" variant="default">{t('reports')}</OpenBusinessButton>}
        {synced && <OpenBusinessButton businessId={business.businessId} path="/campaigns" variant="default">{t('campaigns')}</OpenBusinessButton>}
        {accounts.map((account) => (
          <Button key={account.externalAccountId} component="a" href={adsManagerLink(account.externalAccountId)} target="_blank" rel="noreferrer" variant="default">
            {accounts.length > 1 ? t('adsManagerFor', { name: account.name ?? `…${account.externalAccountId.slice(-4)}` }) : t('adsManager')}
          </Button>
        ))}
        {engagement && <Button component="a" href={`/clients/${business.businessId}`} variant="subtle">{t('details')}</Button>}
      </div>
    </li>
  );
}
