import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Button } from '@mantine/core';
import { ArrowLeft } from 'lucide-react';
import DesignSurface from '@/components/design/DesignSurface';
import SpiderMascot from '@/components/brand/SpiderMascot';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import { AssistantError, authorizeSelectedMetaAccount } from '@/lib/server/intelligence/assistant/access';
import { loadRerunPlan } from '@/lib/server/suggestions/rerun';
import RerunPlanForm from './RerunPlanForm';
import styles from './Rerun.module.css';

export async function generateMetadata() {
  const t = await getTranslations('rerun');
  return { title: t('metaTitle') };
}

/**
 * "Run this ad again" (`/campaigns/rerun?adSet=<Meta ad set id>`), opened from the Insights
 * popup. The ad set must belong to the selected account; everything shown is saved data.
 */
export default async function RerunPage({ searchParams }: { searchParams: Promise<{ adSet?: string }> }) {
  const [{ role }, t, tSuggestion, params] = await Promise.all([
    getRequiredAppContext(), getTranslations('rerun'), getTranslations('suggestion'), searchParams,
  ]);

  let scope;
  try {
    scope = await authorizeSelectedMetaAccount();
  } catch (error) {
    if (!(error instanceof AssistantError)) throw error;
    return <Shell back={t('back')}><p className={styles.message}>{tSuggestion('error.account')}</p></Shell>;
  }

  const load = await loadRerunPlan(scope, params.adSet);
  if (load.kind !== 'ready') {
    const gone = load.kind === 'gone';
    return (
      <Shell back={t('back')}>
        <section className={styles.card}>
          <h1 className={styles.cardTitle}>{gone ? t('goneTitle') : t('noBudgetTitle')}</h1>
          <p className={styles.message}>{gone ? tSuggestion('error.gone') : tSuggestion('error.noBudget')}</p>
          <div className={styles.actions}>
            <Button size="md" component={Link} href="/campaigns/quick">{tSuggestion('newAd')}</Button>
          </div>
        </section>
      </Shell>
    );
  }

  return (
    <Shell back={t('back')}>
      <header className={styles.header}>
        <SpiderMascot state="idea" size={64} />
        <div className={styles.headerText}>
          <h1 className={styles.title}>{t('title')}</h1>
          <p className={styles.lead}>{t('lead')}</p>
        </div>
      </header>
      <RerunPlanForm data={load.data} canPrepare={role === 'owner' || role === 'admin'} />
    </Shell>
  );
}

function Shell({ back, children }: { back: string; children: React.ReactNode }) {
  return (
    <DesignSurface label="DeepVisor · Run this ad again">
      <div className={styles.page}>
        <Link href="/dashboard" className={styles.back}><ArrowLeft size={18} aria-hidden="true" />{back}</Link>
        {children}
      </div>
    </DesignSurface>
  );
}
