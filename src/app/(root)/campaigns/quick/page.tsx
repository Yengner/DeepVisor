import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import DesignSurface from '@/components/design/DesignSurface';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import { AssistantError, authorizeSelectedMetaAccount } from '@/lib/server/intelligence/assistant/access';
import { loadQuickAdContext, quickAdSummary } from '@/lib/server/quickAd/service';
import AdFactsCard from '../../settings/components/AdFactsCard';
import QuickAdForm from './QuickAdForm';
import classes from './QuickAd.module.css';

export async function generateMetadata() {
  const t = await getTranslations('quickAd');
  return { title: t('metaTitle') };
}

/** Optional prefill from a link: `?budget=20&days=7`. Invalid values are ignored. */
function prefill(params: { budget?: string; days?: string }) {
  const budget = params.budget && /^\d{1,6}(\.\d{1,2})?$/.test(params.budget) && Number(params.budget) > 0 ? Number(params.budget) : null;
  const days = params.days && /^\d{1,2}$/.test(params.days) && Number(params.days) >= 1 && Number(params.days) <= 90 ? Number(params.days) : null;
  return { budget, days };
}

export default async function QuickAdPage({ searchParams }: { searchParams: Promise<{ budget?: string; days?: string }> }) {
  const [{ role }, t, params] = await Promise.all([getRequiredAppContext(), getTranslations('quickAd'), searchParams]);
  let scope;
  try {
    scope = await authorizeSelectedMetaAccount();
  } catch (error) {
    if (!(error instanceof AssistantError)) throw error;
    return <DesignSurface label="DeepVisor · Quick ad"><p>{t.rich('selectAccount', { link: chunks => <Link href="/integration">{chunks}</Link> })}</p></DesignSurface>;
  }
  const context = await loadQuickAdContext(scope);
  const summary = quickAdSummary(context);
  const canAnswer = role === 'owner' || role === 'admin';

  return (
    <DesignSurface label="DeepVisor · Quick ad">
      <div className={classes.page}>
        <header>
          <h1>{t('title')}</h1>
          <p>{t('intro')}</p>
        </header>

        {!summary.source ? (
          <section className={classes.card}>
            <h2>{t('noSourceTitle')}</h2>
            <p>{t.rich('noSourceBody', { link: chunks => <Link href="/campaigns/create">{chunks}</Link> })}</p>
          </section>
        ) : (
          <>
            {summary.missing.length > 0 && (
              <section className={classes.card} aria-labelledby="quick-questions">
                <h2 id="quick-questions">{t('questionsTitle')}</h2>
                <p>{t('questionsIntro')}</p>
                {canAnswer
                  ? <AdFactsCard facts={context.facts.facts} accountCurrency={context.facts.accountCurrency} canEdit keys={summary.missing} />
                  : <p>{t('askAdmin')}</p>}
              </section>
            )}
            <QuickAdForm accountId={scope.account.id} summary={summary} initial={prefill(params)} />
          </>
        )}
      </div>
    </DesignSurface>
  );
}
