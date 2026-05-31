import { NextRequest, NextResponse } from 'next/server';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import { resolveCurrentSelection } from '@/lib/server/actions/app/selection';
import { createAdminClient } from '@/lib/server/supabase/admin';
import { createCampaignDraft, getCampaignDraftById } from '@/lib/server/campaigns/drafts';
import type { CampaignDraftPayload } from '@/lib/shared/types/campaignDrafts';
import type { Database } from '@/lib/shared/types/supabase';

type SaveCampaignDraftRequest = {
  draftId?: string | null;
  title?: string | null;
  reviewNotes?: string | null;
  payloadJson?: CampaignDraftPayload;
};

function isCampaignDraftPayload(value: unknown): value is CampaignDraftPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    (record.mode === 'manual' || record.mode === 'smart') &&
    Boolean(record.form) &&
    typeof record.form === 'object' &&
    !Array.isArray(record.form)
  );
}

function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

export async function POST(request: NextRequest) {
  try {
    const { user, businessId } = await getRequiredAppContext();
    const body = (await request.json().catch(() => ({}))) as SaveCampaignDraftRequest;
    const payloadJson = body.payloadJson;

    if (!isCampaignDraftPayload(payloadJson)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing campaign draft payload',
        },
        { status: 400 }
      );
    }

    const { selectedPlatformId, selectedAdAccountId } = await resolveCurrentSelection(businessId);
    if (!selectedPlatformId || !selectedAdAccountId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Select a connected Meta ad account before saving this draft.',
        },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const [{ data: integration, error: integrationError }, { data: adAccount, error: adAccountError }] =
      await Promise.all([
        supabase
          .from('platform_integrations')
          .select('id, business_id, platform_id, status, platforms ( key )')
          .eq('id', selectedPlatformId)
          .eq('business_id', businessId)
          .maybeSingle(),
        supabase
          .from('ad_accounts')
          .select('id, business_id, platform_id')
          .eq('id', selectedAdAccountId)
          .eq('business_id', businessId)
          .maybeSingle(),
      ]);

    if (integrationError) {
      throw integrationError;
    }

    if (adAccountError) {
      throw adAccountError;
    }

    const platform = Array.isArray(integration?.platforms)
      ? integration?.platforms[0]
      : integration?.platforms;

    if (!integration || integration.status !== 'connected' || platform?.key !== 'meta') {
      return NextResponse.json(
        {
          success: false,
          error: 'The selected platform is not a connected Meta integration.',
        },
        { status: 400 }
      );
    }

    if (!adAccount || adAccount.platform_id !== integration.platform_id) {
      return NextResponse.json(
        {
          success: false,
          error: 'The selected ad account does not belong to the active Meta integration.',
        },
        { status: 400 }
      );
    }

    const draftId = optionalString(body.draftId);
    const title = optionalString(body.title) ?? 'Meta lead campaign';
    const reviewNotes = optionalString(body.reviewNotes);

    if (draftId) {
      const existingDraft = await getCampaignDraftById(supabase, {
        businessId,
        draftId,
      });

      if (!existingDraft) {
        return NextResponse.json(
          {
            success: false,
            error: 'Campaign draft not found.',
          },
          { status: 404 }
        );
      }

      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('campaign_drafts')
        .update({
          platform_integration_id: integration.id,
          ad_account_id: adAccount.id,
          updated_by_user_id: user.id,
          title,
          payload_json: payloadJson as unknown as Database['public']['Tables']['campaign_drafts']['Update']['payload_json'],
          review_notes: reviewNotes,
          status: 'draft',
          updated_at: now,
          version: (existingDraft.version ?? 1) + 1,
        })
        .eq('id', existingDraft.id)
        .eq('business_id', businessId)
        .select('id')
        .single();

      if (error || !data) {
        throw error ?? new Error('Failed to update campaign draft');
      }

      return NextResponse.json({
        success: true,
        data: {
          draftId: data.id,
          href: `/campaigns/create?draft=${data.id}`,
          status: 'updated',
        },
      });
    }

    const draft = await createCampaignDraft(supabase, {
      businessId,
      platformIntegrationId: integration.id,
      adAccountId: adAccount.id,
      userId: user.id,
      title,
      payloadJson,
      reviewNotes,
      sourceActionId: 'meta_lead_helper',
    });

    return NextResponse.json({
      success: true,
      data: {
        draftId: draft.id,
        href: `/campaigns/create?draft=${draft.id}`,
        status: 'created',
      },
    });
  } catch (error) {
    console.error('Failed to save campaign draft:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save campaign draft',
      },
      { status: 500 }
    );
  }
}
