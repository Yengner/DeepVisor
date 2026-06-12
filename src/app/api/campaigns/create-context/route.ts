import { NextRequest, NextResponse } from 'next/server';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import { resolveCurrentSelection } from '@/lib/server/actions/app/selection';
import { getMetaPages, type MetaPage } from '@/lib/server/actions/meta/pages/actions';
import { getCampaignDraftById, readCampaignDraftPayload } from '@/lib/server/campaigns/drafts';
import { getAdAccountData, getCampaignsWithAdSetsAndAds, getPlatformDetails } from '@/lib/server/data';
import { createServerClient } from '@/lib/server/supabase/server';
import { ErrorCode, fail, ok } from '@/lib/shared';
import type { ConfiguredWhatsAppNumber } from '@/lib/shared/types/whatsappSetup';

export const dynamic = 'force-dynamic';

type CreateScope = 'campaign' | 'adset' | 'ad';

function parseCreateScope(value: string | null): CreateScope {
  if (value === 'adset' || value === 'ad') {
    return value;
  }

  return 'campaign';
}

function normalizeConfiguredPhone(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().replace(/[\s\-()]/g, '');
  return normalized || null;
}

export async function GET(request: NextRequest) {
  try {
    const { businessId } = await getRequiredAppContext();
    const createScope = parseCreateScope(request.nextUrl.searchParams.get('scope'));
    const requestedDraftId = request.nextUrl.searchParams.get('draft');
    const requestedCampaignId = request.nextUrl.searchParams.get('campaign_id');
    const requestedAdSetId = request.nextUrl.searchParams.get('adset_id');

    const { selectedPlatformId: platformIntegrationId, selectedAdAccountId: adAccountDBId } =
      await resolveCurrentSelection(businessId);

    if (!platformIntegrationId || !adAccountDBId) {
      return NextResponse.json(
        ok({
          state: 'needs_selection' as const,
          createScope,
          message: 'Use the dropdown in the top navigation to select an ad account.',
        })
      );
    }

    const supabase = await createServerClient();
    const [platformData, adAccountData] = await Promise.all([
      getPlatformDetails(platformIntegrationId, businessId),
      getAdAccountData(adAccountDBId, platformIntegrationId, businessId),
    ]);

    if (!platformData?.integrationId || platformData.status !== 'connected' || !adAccountData?.external_account_id) {
      return NextResponse.json(
        ok({
          state: 'invalid_selection' as const,
          createScope,
          message: 'Please select a different ad account from the dropdown.',
        })
      );
    }

    const campaignTreePromise = getCampaignsWithAdSetsAndAds(adAccountDBId);
    const draftRowPromise =
      requestedDraftId && createScope === 'campaign'
        ? getCampaignDraftById(supabase, {
            businessId,
            draftId: requestedDraftId,
          })
        : null;
    const businessProfilePromise =
      createScope === 'campaign'
        ? supabase
          .from('business_profiles')
          .select(
              'meta_page_id, meta_page_name, meta_page_picture_url, meta_page_instagram_account_id, meta_page_instagram_account_name, meta_page_instagram_account_username, meta_page_instagram_account_picture_url, whatsapp_number, whatsapp_number_source, whatsapp_setup_completed, page_phone'
          )
            .eq('id', businessId)
            .maybeSingle()
        : null;
    const metaPagesPromise =
      createScope === 'campaign'
        ? getMetaPages({
            platformId: platformData.integrationId,
            adAccountId: adAccountData.external_account_id,
          })
        : null;

    const [campaignTree, draftRow, businessProfileResult, metaPagesResponse] = await Promise.all([
      campaignTreePromise,
      draftRowPromise,
      businessProfilePromise,
      metaPagesPromise,
    ]);
    const draftPayload = readCampaignDraftPayload(draftRow);
    const manualDraft = draftPayload?.mode === 'manual' ? draftPayload.form : null;
    let metaPages: MetaPage[] = [];
    let pagesError: string | null = null;
    let configuredWhatsAppNumbers: ConfiguredWhatsAppNumber[] = [];

    if (createScope === 'campaign') {
      if (businessProfileResult?.error) {
        throw businessProfileResult.error;
      }

      metaPages = metaPagesResponse?.success ? metaPagesResponse.data : [];
      pagesError = metaPagesResponse?.success ? null : metaPagesResponse?.error.userMessage ?? null;

      const businessProfile = businessProfileResult?.data ?? null;
      if (
        businessProfile?.meta_page_id &&
        businessProfile.meta_page_name &&
        !metaPages.some((page) => page.page_id === businessProfile.meta_page_id)
      ) {
        metaPages = [
          {
            id: businessProfile.meta_page_id,
            page_id: businessProfile.meta_page_id,
            name: businessProfile.meta_page_name,
            phone: businessProfile.page_phone ?? null,
            instagram_account_id: businessProfile.meta_page_instagram_account_id ?? undefined,
            instagram_account_name: businessProfile.meta_page_instagram_account_name ?? null,
            instagram_account_username: businessProfile.meta_page_instagram_account_username ?? null,
            instagram_account_picture_url: businessProfile.meta_page_instagram_account_picture_url ?? null,
            picture_url: businessProfile.meta_page_picture_url ?? undefined,
          },
          ...metaPages,
        ];
      }

      const configuredWhatsAppNumber = businessProfile?.whatsapp_setup_completed
        ? normalizeConfiguredPhone(businessProfile.whatsapp_number ?? businessProfile.page_phone)
        : null;

      configuredWhatsAppNumbers = configuredWhatsAppNumber
        ? [
            {
              id: `configured:${configuredWhatsAppNumber}`,
              display_phone_number: configuredWhatsAppNumber,
              source: businessProfile?.whatsapp_number_source ?? 'manual',
              pageName: businessProfile?.meta_page_name ?? null,
              pagePictureUrl: businessProfile?.meta_page_picture_url ?? null,
              label:
                businessProfile?.whatsapp_number_source === 'page_phone_confirmed'
                  ? businessProfile?.meta_page_name
                    ? `${businessProfile.meta_page_name} WhatsApp`
                    : 'Facebook Page WhatsApp number'
                  : businessProfile?.meta_page_name
                    ? `${businessProfile.meta_page_name} saved number`
                    : 'Saved WhatsApp number',
            },
          ]
        : [];
    }

    return NextResponse.json(
      ok({
        state: 'ready' as const,
        createScope,
        requestedCampaignId,
        requestedAdSetId,
        requestedDraftId,
        platformData: {
          id: platformData.integrationId,
          platform_name: platformData.vendor,
        },
        adAccountId: adAccountData.external_account_id,
        campaigns: campaignTree,
        draft: manualDraft,
        metaPages,
        pagesError,
        configuredWhatsAppNumbers,
      })
    );
  } catch (error) {
    return NextResponse.json(
      fail(
        error instanceof Error ? error.message : 'Failed to load campaign creation context',
        ErrorCode.UNKNOWN_ERROR,
        {
          userMessage: 'We could not load the campaign builder right now.',
        }
      ),
      { status: 500 }
    );
  }
}
