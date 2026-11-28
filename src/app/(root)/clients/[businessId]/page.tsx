import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import DesignSurface from '@/components/design/DesignSurface';
import OpenBusinessButton from '@/components/clients/OpenBusinessButton';
import { EngagementForm, LinkedAccounts } from '@/components/clients/ClientForms';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import { loadPortfolio } from '@/lib/server/clients/load';
import { adsManagerLink } from '@/lib/shared/insights/health';
import { accountNumber } from '@/lib/shared/clients/model';
import styles from '../Clients.module.css';

export async function generateMetadata() {
  return { title: (await getTranslations('clients'))('details') };
}

/** Linking or "Sync now" starts the first sync, which runs after the response. */
export const maxDuration = 300;

/** One client's records: service, fee and which ad accounts are theirs. Also its home while unsynced. */
export default async function ClientPage({ params }: { params: Promise<{ businessId: string }> }) {
  const [{ businessId }, { user, businessId: activeId }] = await Promise.all([params, getRequiredAppContext()]);
  const portfolio = await loadPortfolio(user.id);
  if (!portfolio) redirect('/dashboard');
  const business = portfolio.businesses.find((item) => item.businessId === businessId);
  if (!business?.engagement) notFound();
  const [t, locale] = await Promise.all([getTranslations('clients'), getLocale()]);
  const synced = business.synced;
  const sync = synced ? {
    accountNumber: accountNumber(synced.externalAccountId) ?? '',
    lastSynced: synced.lastSynced
      ? new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: synced.timezone }).format(new Date(synced.lastSynced))
      : null,
    needsReconnect: synced.needsReconnect,
  } : null;
  return (
    <DesignSurface label="DeepVisor · Business details">
      <div className={`${styles.page} ${styles.narrow}`}>
        <Link href="/clients">← {t('title')}</Link>
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>{business.name}</h1>
            {business.location && <p className={styles.muted}>{business.location}</p>}
          </div>
          {activeId !== business.businessId && <OpenBusinessButton businessId={business.businessId} path={`/clients/${business.businessId}`}>{t('open')}</OpenBusinessButton>}
        </header>
        {!synced && <p className={styles.note}>{t('syncOff')}</p>}
        <section className={styles.card}>
          <h2 className={styles.name}>{t('accounts.title')}</h2>
          <p className={styles.muted}>{t('accounts.hint')}</p>
          <LinkedAccounts businessId={business.businessId} links={business.links.map((link) => ({ ...link, href: adsManagerLink(link.externalAccountId) }))} available={portfolio.unlinked} sync={sync} />
        </section>
        <section className={styles.card}>
          <h2 className={styles.name}>{t('feeTitle')}</h2>
          <p className={styles.muted}>{t('feeHint')}</p>
          <EngagementForm businessId={business.businessId} engagement={business.engagement} />
        </section>
      </div>
    </DesignSurface>
  );
}
