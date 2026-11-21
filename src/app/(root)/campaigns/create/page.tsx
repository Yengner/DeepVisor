import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { FilePen } from 'lucide-react';
import CampaignCreateClient from '@/components/campaigns/create/CampaignCreateClient';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import { resolveCurrentSelection } from '@/lib/server/actions/app/selection';
import { countDrafts } from '@/lib/server/suggestions/drafts';
import { createServerClient } from '@/lib/server/supabase/server';
import styles from './CreateDraftsNotice.module.css';

/**
 * Starting something new is where saved drafts matter, so a fresh create page shows one quiet
 * line when the account has any ("You have 2 saved drafts · See drafts"). Opening a specific
 * draft or adding an ad set/ad to an existing campaign shows nothing extra.
 */
export default async function CreateCampaignPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const fresh = !params.draft && !params.scope;
  const count = fresh ? await draftsHere() : 0;
  const t = count > 0 ? await getTranslations('drafts') : null;
  return (
    <div className="dv-app-page dv-create-route">
      {t && (
        <p className={styles.notice} role="note">
          <FilePen size={18} aria-hidden="true" />
          <span>{t('notice', { count })}</span>
          <Link href="/campaigns/drafts" className={styles.link}>{t('noticeLink')}</Link>
        </p>
      )}
      <CampaignCreateClient />
    </div>
  );
}

async function draftsHere(): Promise<number> {
  try {
    const { businessId } = await getRequiredAppContext();
    const { selectedAdAccountId } = await resolveCurrentSelection(businessId);
    return selectedAdAccountId ? await countDrafts(await createServerClient(), { businessId, adAccountId: selectedAdAccountId }) : 0;
  } catch (error) {
    // The notice is a convenience; the builder still opens without it.
    console.error('Draft notice unavailable', { message: (error as Error)?.message });
    return 0;
  }
}
