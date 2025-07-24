import { createSupabaseClient } from "../../utils/supabase/clients/server";
import { createAdSet } from "./adsets/create";
import { createCampaign } from "./campaigns/create";
import { createAd } from "./ads/create";
import { getAccessToken } from "../common/accessToken";
import { FacebookAdsApi } from "../../sdk/client";
import { getLoggedInUser } from "../user";
import { logProgress } from "../utils";
import { CampaignFormValues, SmartCampaignResult } from "./types";

/**
 * Utility to wait
 */
const delayMs = 2000
function wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Utility to run a single step with progress logging.
 */
async function runStep<T>(
    supabase: any,
    jobId: string,
    stepId: string,
    meta: Record<string, any> | null,
    fn: () => Promise<{ value: T; meta?: Record<string, any> }>
): Promise<T> {
    try {
        await logProgress(supabase, jobId, stepId, 'loading', meta);
        await wait(delayMs);
        const { value, meta: resultMeta } = await fn();
        await logProgress(supabase, jobId, stepId, 'success', resultMeta ?? {});
        return value;
    } catch (err: any) {
        await logProgress(supabase, jobId, stepId, 'error', { message: err.message });
        throw err;
    }
}

/**
 * Server action to create a Meta campaign with full progress tracking.
 */
export async function createMetaCampaign(
    jobId: string,
    formData: CampaignFormValues
): Promise<SmartCampaignResult> {
    const supabase = await createSupabaseClient();
    const loggedIn = await getLoggedInUser();
    const userId = loggedIn?.id;
    const accessToken = await getAccessToken(formData.platformIntegrationId);
    const APP_SECRET = process.env.META_APP_SECRET!;
    const adAccountId = formData.campaign.adAccountId;

    FacebookAdsApi.init(accessToken, APP_SECRET).setDebug(true);

    const isSmart = formData.type === 'AI Auto';
    // Campaign
    const campaignId = await runStep(
        supabase,
        jobId,
        'campaign',
        {
            campaignName: formData.campaign.campaignName,
            objective: formData.campaign.objective,
            budget: formData.budget.amount,
            budgetType: formData.budget.type,
        },
        async () => {
            const id = await createCampaign({
                adAccountId,
                formData,
                budgetData: formData.budget,
                isSmartCampaign: isSmart,
            });
            return { value: id, meta: { campaignId: id } };
        }
    );

    // Ad Sets
    const adsetIds: string[] = [];
    for (let i = 0; i < formData.adSets.length; i++) {
        const adSet = formData.adSets[i];
        const stepId = `adset-${i}`;
        const adsetId = await runStep(
            supabase,
            jobId,
            stepId,
            {
                adSetName: adSet.adSetName,
                pageId: adSet.page_id,
                useAdvantageAudience: adSet.useAdvantageAudience,
                useAdvantagePlacements: adSet.useAdvantagePlacements,
                startDate: formData.schedule.startDate,
                endDate: formData.schedule.endDate ? null : null,
            },
            async () => {
                const id = await createAdSet({
                    adAccountId,
                    campaignId,
                    formData: { ...formData, ...adSet },
                    isSmartCampaign: isSmart,
                });
                return { value: id, meta: { adsetId: id } };
            }
        );
        adsetIds.push(adsetId);

        // Creatives & Ads per AdSet
        for (let j = 0; j < adSet.creatives.length; j++) {
            const creative = adSet.creatives[j];
            const cStep = `creative-${i}-${j}`;
            await logProgress(supabase, jobId, cStep, 'loading', formData.adSets[i].creatives[j].existingCreativeIds?.[0] ?? null);
            const creativeId = creative.existingCreativeIds?.[0] ?? null;
            if (creativeId) {
                await logProgress(supabase, jobId, cStep, 'success', { creativeId });
                
                await logProgress(supabase, jobId, cStep, 'success', { creativeId });
                const aStep = `ad-${i}-${j}`;
                const adId = await runStep(
                    supabase,
                    jobId,
                    aStep,
                    { adSetName: adSet.adSetName, creativeId },
                    async () => {
                        const id = await createAd({
                            adAccountId,
                            accessToken,
                            adsetId,
                            creativeId,
                            formData: { ...formData, ...adSet, ...creative },
                            isSmartCampaign: isSmart,
                        });
                        return { value: id, meta: { adId: id } };
                    }
                );
                adsetIds.push(adsetId);
            } else {
                await logProgress(supabase, jobId, cStep, 'error', {
                    message: 'No creative ID available',
                });
            }
        }
    }

    await supabase
        .from('campaign_job_progress')
        .delete()
        .eq('job_id', jobId);

    await logProgress(supabase, jobId, 'function', 'success')

    return { success: true, campaignId, adsetIds, creativeIds: [], adIds: [] };
}
