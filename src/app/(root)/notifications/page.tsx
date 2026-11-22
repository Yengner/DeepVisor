import { Suspense } from 'react';
import { getLocale, getTranslations } from 'next-intl/server';
import { Button } from '@mantine/core';
import DesignSurface from '@/components/design/DesignSurface';
import SpiderMascot from '@/components/brand/SpiderMascot';
import AttentionList from '@/components/product/AttentionList';
import { dailyNotificationKeys, formatNotificationPreviewMessage } from '@/lib/shared';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import { getUserNotifications } from '@/lib/server/actions/user/settings';
import { attentionItems } from '@/lib/shared/insights/attention';
import { openUrgentIssues } from '@/lib/server/insights/issues';
import { attentionText } from '@/lib/server/insights/attentionText';
import { loadOverviewContext } from '@/lib/server/dashboard/overview/load';
import { loadExploration } from '@/lib/server/campaigns/exploration/load';
import NotificationAction from './NotificationAction';
import styles from './NotificationsPage.module.css';

export async function generateMetadata() {
  const t = await getTranslations('notificationsPage');
  return { title: t('metaTitle') };
}

/**
 * Live account state pinned above the feed: Meta issues that stop delivery and active ad sets
 * ending within two days. Read on each visit, so it disappears once Meta stops reporting it.
 */
async function PinnedAttention({ label, openOverview }: { label: string; openOverview: string }) {
  const context = await loadOverviewContext().catch(() => null);
  if (!context?.account) return null;
  const [issues, view] = await Promise.all([
    openUrgentIssues(context.businessId, context.account.id).catch(() => []),
    context.platform?.vendor === 'meta' ? loadExploration('7d', 'adset', null, true).catch(() => null) : null,
  ]);
  const items = attentionItems(issues, view?.items ?? [], {
    now: context.now, zone: context.zone, endingAction: { label: openOverview, href: '/dashboard' },
    ...(await attentionText()),
  });
  return <AttentionList items={items} label={label} />;
}

/** "12 hours ago" / "hace 12 horas", rounded to the largest whole unit. */
function relative(value: string, locale: string): string {
  const seconds = (new Date(value).getTime() - Date.now()) / 1000;
  const format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [['day', 86400], ['hour', 3600], ['minute', 60]];
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return format.format(Math.round(seconds / size), unit);
  }
  return format.format(0, 'minute');
}

/**
 * Notifications (`/notifications`), in the Insights popup's language: character + headline + one
 * sentence, then the saved updates as plain cards, newest first, one button each. Nothing under
 * 13px, 48px buttons, --dv-* tokens so dark mode follows.
 */
export default async function NotificationsPage() {
  const t = await getTranslations('notificationsPage');
  const tText = await getTranslations('notificationText');
  const locale = (await getLocale()) === 'es' ? 'es-US' : 'en-US';
  const { user } = await getRequiredAppContext();
  const notifications = await getUserNotifications(user.id, 50);
  const unread = notifications.filter(item => !item.read).length;
  const date = (value: string) => new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value));

  return (
    <DesignSurface label="DeepVisor · Notifications">
      <div className={styles.page}>
        <header className={styles.header}>
          <SpiderMascot state={unread > 0 ? 'idea' : 'idle'} size={64} />
          <div className={styles.headerText}>
            <h1 className={styles.title}>{t('title')}</h1>
            <p className={styles.lead}>{unread > 0 ? t('leadUnread', { count: unread }) : t('lead')}</p>
          </div>
        </header>

        <Suspense fallback={null}>
          <PinnedAttention label={t('attention')} openOverview={t('openOverview')} />
        </Suspense>

        {notifications.length === 0 ? (
          <section className={styles.empty}>
            <h2>{t('emptyTitle')}</h2>
            <p>{t('emptyBody')}</p>
          </section>
        ) : (
          <ul className={styles.list} aria-label={t('listLabel')}>
            {notifications.map(item => {
              // The daily update row is worded here, in the reader's language; other rows show what was saved.
              const daily = dailyNotificationKeys(item);
              const title = daily ? tText(daily.title, { count: daily.count }) : item.title;
              const message = daily ? tText(daily.message) : item.message ? formatNotificationPreviewMessage(item.message) : '';
              return (
              <li key={item.id} className={styles.card} data-unread={item.read ? undefined : ''}>
                <div className={styles.body}>
                  <p className={styles.name}>
                    {!item.read && <span className={styles.dot} aria-hidden="true" />}
                    {!item.read && <span className={styles.srOnly}>{t('unread')} </span>}
                    {title}
                  </p>
                  {message && <p className={styles.message}>{message}</p>}
                  {item.created_at && (
                    <p className={styles.meta}>
                      <time dateTime={item.created_at}>{date(item.created_at)}</time>
                      {' · '}{relative(item.created_at, locale)}
                    </p>
                  )}
                </div>
                <NotificationAction
                  notificationId={item.id}
                  unread={!item.read}
                  href={item.link ?? null}
                  className={styles.action}
                />
              </li>
              );
            })}
          </ul>
        )}

        <p className={styles.footer}>
          {t('settingsHint')}{' '}
          <Button component="a" href="/settings#alerts" variant="subtle" size="md" className={styles.settingsLink}>
            {t('settings')}
          </Button>
        </p>
      </div>
    </DesignSurface>
  );
}
