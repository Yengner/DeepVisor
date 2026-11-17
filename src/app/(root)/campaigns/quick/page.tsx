import Link from 'next/link';
import DesignSurface from '@/components/design/DesignSurface';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import { AssistantError, authorizeAssistant } from '@/lib/server/intelligence/assistant/access';
import { loadQuickAdContext, quickAdSummary } from '@/lib/server/quickAd/service';
import AdFactsCard from '../../settings/components/AdFactsCard';
import QuickAdForm from './QuickAdForm';
import classes from './QuickAd.module.css';

export const metadata = { title: 'Quick ad | DeepVisor' };

export default async function QuickAdPage() {
  const { role } = await getRequiredAppContext();
  let scope;
  try {
    scope = await authorizeAssistant();
  } catch (error) {
    if (!(error instanceof AssistantError)) throw error;
    return <DesignSurface label="DeepVisor · Quick ad"><p>Select a Meta account in <Link href="/integration">Connections</Link> first.</p></DesignSurface>;
  }
  const context = await loadQuickAdContext(scope);
  const summary = quickAdSummary(context);
  const canAnswer = role === 'owner' || role === 'admin';

  return (
    <DesignSurface label="DeepVisor · Quick ad">
      <div className={classes.page}>
        <header>
          <h1>Quick ad</h1>
          <p>Add your photo or video. DeepVisor prepares a paused draft for you to review. Nothing is published.</p>
        </header>

        {!summary.source ? (
          <section className={classes.card}>
            <h2>No messaging ad to start from yet</h2>
            <p>Quick ad copies the settings of an ad that sends people to WhatsApp or Messenger. Create one in <Link href="/campaigns/create">Campaigns</Link> first.</p>
          </section>
        ) : (
          <>
            {summary.missing.length > 0 && (
              <section className={classes.card} aria-labelledby="quick-questions">
                <h2 id="quick-questions">A few answers first</h2>
                <p>You only answer these once. Change them anytime in Settings.</p>
                {canAnswer
                  ? <AdFactsCard facts={context.facts.facts} accountCurrency={context.facts.accountCurrency} canEdit keys={summary.missing} />
                  : <p>Ask a workspace owner or admin to answer these in Settings.</p>}
              </section>
            )}
            <QuickAdForm accountId={scope.account.id} summary={summary} />
          </>
        )}
      </div>
    </DesignSurface>
  );
}
