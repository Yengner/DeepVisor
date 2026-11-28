import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import DesignSurface from '@/components/design/DesignSurface';
import { NewBusinessForm } from '@/components/clients/ClientForms';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import { getOperator } from '@/lib/server/clients/operator';
import styles from '../Clients.module.css';

export async function generateMetadata() {
  return { title: (await getTranslations('clients'))('add') };
}

export default async function NewClientPage() {
  const { user } = await getRequiredAppContext();
  if (!(await getOperator(user.id))) redirect('/dashboard');
  const t = await getTranslations('clients');
  return (
    <DesignSurface label="DeepVisor · Add a business">
      <div className={`${styles.page} ${styles.narrow}`}>
        <Link href="/clients">← {t('title')}</Link>
        <h1 className={styles.title}>{t('add')}</h1>
        <p className={styles.muted}>{t('addHint')}</p>
        <div className={styles.card}><NewBusinessForm /></div>
      </div>
    </DesignSurface>
  );
}
