import SmartCampaignClient from "./SmartCampaignClient";
import { EmptyCampaignState } from "@/components/campaigns/EmptyStates";
import { redirect } from 'next/navigation';
import { resolveCurrentSelection } from "@/lib/server/actions/app/selection";
import { getRequiredAppContext } from "@/lib/server/actions/app/context";
import { getCampaignDraftById, readCampaignDraftPayload } from '@/lib/server/campaigns/drafts';
import { getAdAccountData, getPlatformDetails } from '@/lib/server/data';
import { createServerClient } from '@/lib/server/supabase/server';


export default async function SmartCampaignPage({
    searchParams,
}: {
    searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    const params = searchParams ? await searchParams : {};
    const requestedDraftId = typeof params?.draft === 'string' ? params.draft : null;

    if (!requestedDraftId) {
        redirect('/campaigns/create');
    }

    const { user, businessId } = await getRequiredAppContext();
    const userId = user.id;
    const { selectedPlatformId, selectedAdAccountId } = await resolveCurrentSelection(businessId);

    if (!selectedPlatformId) {
        return <EmptyCampaignState type="platform" />;
    }

    const platformDetails = await getPlatformDetails(selectedPlatformId, businessId);
    if (!platformDetails || platformDetails.status !== "connected") {
        return <EmptyCampaignState type="platform" />;
    }

    if (!selectedAdAccountId) {
        return <EmptyCampaignState type="adAccount" platformName={platformDetails.vendor} />;
    }
    const adAccount = await getAdAccountData(selectedAdAccountId, selectedPlatformId, businessId);
    if (!adAccount?.ad_account_id) {
        return <EmptyCampaignState type="adAccount" platformName={platformDetails.vendor} />;
    }

    const supabase = await createServerClient();
    const draftRow = requestedDraftId
        ? await getCampaignDraftById(supabase, {
            businessId,
            draftId: requestedDraftId,
        })
        : null;
    const draftPayload = readCampaignDraftPayload(draftRow);
    const smartDraft = draftPayload?.mode === 'smart' ? draftPayload.form : null;

    if (!smartDraft) {
        redirect(`/campaigns/create?draft=${requestedDraftId}`);
    }

    return (
        <SmartCampaignClient
            userId={userId}
            platformName={platformDetails.displayName}
            platformId={platformDetails.integrationId}
            adAccountId={adAccount.ad_account_id}
            draft={smartDraft}
        />);
}
