import { redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { Button } from '@mantine/core';
import DesignSurface from '@/components/design/DesignSurface';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import { loadPortfolio } from '@/lib/server/clients/load';
import BusinessCard from './BusinessCard';
import styles from './Clients.module.css';
import LoginStatus from './LoginStatus';

/** Every business the operator manages, the ones to look at first on top. Saved data only. */
export default async function ClientsPage() {
  const { user } = await getRequiredAppContext();
  const portfolio = await loadPortfolio(user.id);
  if (!portfolio) redirect('/dashboard');
  const t = await getTranslations('clients');
  const locale = (await getLocale()) === 'es' ? 'es-US' : 'en-US';
  return (
    <DesignSurface label="DeepVisor · All businesses">
      <div className={styles.page}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>{t('title')}</h1>
            <p className={styles.muted}>{t('lead', { count: portfolio.businesses.length })}</p>
          </div>
          <Button component="a" href="/clients/new" size="md">{t('add')}</Button>
        </header>
        {portfolio.login && <LoginStatus login={portfolio.login} locale={locale} />}
        <ul className={styles.list}>
          {portfolio.businesses.map((business) => <BusinessCard key={business.businessId} business={business} locale={locale} now={portfolio.now} />)}
        </ul>
        {portfolio.unlinked.length > 0 && (
          <p className={styles.note}>{t('unlinked', { count: portfolio.unlinked.length, names: portfolio.unlinked.map((account) => account.name ?? `…${account.externalAccountId.slice(-4)}`).join(', ') })}</p>
        )}
      </div>
    </DesignSurface>
  );
}
