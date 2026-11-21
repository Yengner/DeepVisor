import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { Button } from '@mantine/core';
import { ArrowLeft, CalendarDays, FilePen } from 'lucide-react';
import DesignSurface from '@/components/design/DesignSurface';
import SpiderMascot from '@/components/brand/SpiderMascot';
import { MediaImage } from '@/components/campaigns/exploration/AdvertisingExplorer';
import { AssistantError, authorizeSelectedMetaAccount } from '@/lib/server/intelligence/assistant/access';
import { loadDrafts } from '@/lib/server/suggestions/drafts';
import { dayIn } from '@/lib/shared/time/zone';
import styles from './Drafts.module.css';

export async function generateMetadata() {
  const t = await getTranslations('drafts');
  return { title: t('metaTitle') };
}

/**
 * Drafts (`/campaigns/drafts`): run-again plans and new-ad drafts saved in DeepVisor, away from the
 * Campaigns table. Same look as the Insights popup: the ad's picture, one plain line of numbers,
 * one button per card. Nothing is sent to Meta.
 */
export default async function DraftsPage() {
  const t = await getTranslations('drafts');
  const tSuggestion = await getTranslations('suggestion');
  const intl = (await getLocale()) === 'es' ? 'es-US' : 'en-US';

  let scope;
  try {
    scope = await authorizeSelectedMetaAccount();
  } catch (error) {
    if (!(error instanceof AssistantError)) throw error;
    return <Shell back={t('back')}><p className={styles.message}>{tSuggestion('error.account')}</p></Shell>;
  }

  const loaded = await loadDrafts(scope).catch(error => {
    console.error('Drafts unavailable', { code: (error as { code?: string })?.code });
    return null;
  });
  const today = scope.account.timezone ? dayIn(scope.account.timezone) : null;
  const money = (value: number, currency: string) => new Intl.NumberFormat(intl, {
    style: 'currency', currency, minimumFractionDigits: Number.isInteger(value) ? 0 : 2, maximumFractionDigits: 2,
  }).format(value);
  const day = (value: string) => new Intl.DateTimeFormat(intl, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`));
  const saved = (value: string) => new Intl.DateTimeFormat(intl, { month: 'short', day: 'numeric' }).format(new Date(value));
  const empty = loaded !== null && loaded.plans.length === 0 && loaded.drafts.length === 0;

  return (
    <Shell back={t('back')}>
      <header className={styles.header}>
        <SpiderMascot state={empty ? 'idle' : 'idea'} size={64} />
        <div className={styles.headerText}>
          <h1 className={styles.title}>{t('title')}</h1>
          <p className={styles.lead}>{t('lead')}</p>
        </div>
      </header>

      {loaded === null ? <p className={styles.message} role="alert">{t('unavailable')}</p> : empty ? (
        <section className={styles.empty}>
          <h2>{t('emptyTitle')}</h2>
          <p>{t('emptyBody')}</p>
          <Button size="md" component="a" href="/campaigns/quick">{t('quickAd')}</Button>
        </section>
      ) : (
        <>
          {loaded.plans.length > 0 && (
            <section className={styles.group} aria-labelledby="drafts-plans">
              <h2 id="drafts-plans" className={styles.groupTitle}><CalendarDays size={18} aria-hidden="true" />{t('plansTitle')}</h2>
              <ul className={styles.list}>
                {loaded.plans.map(plan => {
                  const passed = today !== null && plan.startDay <= today;
                  return (
                    <li key={plan.id} className={styles.card}>
                      <div className={styles.media}>
                        <MediaImage media={plan.media ?? undefined} name={plan.name} labelPosition="top" dashboard />
                      </div>
                      <div className={styles.body}>
                        <h3 className={styles.name}>{plan.name}</h3>
                        <p className={styles.numbers}>{t('plan', { budget: money(plan.dailyBudget, plan.currency), days: plan.days })}</p>
                        <p className={styles.total}>{t('total', { total: money(plan.dailyBudget * plan.days, plan.currency) })}</p>
                        <p className={styles.meta}>
                          {passed ? t('datesPassed') : t('runs', { start: day(plan.startDay), end: day(plan.endDay) })}
                          {' · '}{t('changed', { date: saved(plan.updatedAt) })}
                        </p>
                      </div>
                      <Button size="md" variant="default" component="a" href={`/campaigns/rerun?adSet=${encodeURIComponent(plan.adSetId)}`} className={styles.action}>
                        {t('edit')}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {loaded.drafts.length > 0 && (
            <section className={styles.group} aria-labelledby="drafts-ads">
              <h2 id="drafts-ads" className={styles.groupTitle}><FilePen size={18} aria-hidden="true" />{t('adsTitle')}</h2>
              <ul className={styles.list}>
                {loaded.drafts.map(draft => (
                  <li key={draft.id} className={`${styles.card} ${styles.cardPlain}`}>
                    <div className={styles.body}>
                      <h3 className={styles.name}>{draft.title ?? t('untitled')}</h3>
                      <p className={styles.meta}>{t('changed', { date: saved(draft.updatedAt) })}</p>
                    </div>
                    <Button size="md" variant="default" component="a" href={`/campaigns/create?draft=${encodeURIComponent(draft.id)}`} className={styles.action}>
                      {t('open')}
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

    </Shell>
  );
}

function Shell({ back, children }: { back: string; children: React.ReactNode }) {
  return (
    <DesignSurface label="DeepVisor · Drafts">
      <div className={styles.page}>
        <Link href="/campaigns" className={styles.back}><ArrowLeft size={18} aria-hidden="true" />{back}</Link>
        {children}
      </div>
    </DesignSurface>
  );
}
