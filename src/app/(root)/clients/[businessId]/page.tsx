import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import DesignSurface from '@/components/design/DesignSurface';
import OpenBusinessButton from '@/components/clients/OpenBusinessButton';
import { EngagementForm, LinkedAccounts } from '@/components/clients/ClientForms';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import { loadPortfolio } from '@/lib/server/clients/load';
import { adsManagerLink } from '@/lib/shared/insights/health';
import styles from '../Clients.module.css';

export async function generateMetadata() {
  return { title: (await getTranslations('clients'))('details') };
}

/** One client's records: service, fee and which ad accounts are theirs. Also its home while unsynced. */
export default async function ClientPage({ params }: { params: Promise<{ businessId: string }> }) {
  const [{ businessId }, { user, businessId: activeId }] = await Promise.all([params, getRequiredAppContext()]);
  const portfolio = await loadPortfolio(user.id);
  if (!portfolio) redirect('/dashboard');
  const business = portfolio.businesses.find((item) => item.businessId === businessId);
  if (!business?.engagement) notFound();
  const t = await getTranslations('clients');
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
        <p className={styles.note}>{t('syncOff')}</p>
        <section className={styles.card}>
          <h2 className={styles.name}>{t('accounts.title')}</h2>
          <p className={styles.muted}>{t('accounts.hint')}</p>
          <LinkedAccounts businessId={business.businessId} links={business.links.map((link) => ({ ...link, href: adsManagerLink(link.externalAccountId) }))} available={portfolio.unlinked} />
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
