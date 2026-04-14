import { NextRequest, NextResponse } from 'next/server';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import { createAdminClient } from '@/lib/server/supabase/admin';
import { createReviveCampaignDraft } from '@/lib/server/campaigns/revive';
import type { ReviveDraftSource } from '@/lib/shared/types/campaignDrafts';

type CreateReviveDraftRequest = {
  adAccountId?: string;
  platformIntegrationId?: string;
  source?: ReviveDraftSource;
};

function isReviveDraftSource(value: unknown): value is ReviveDraftSource {
  return value === 'historic_clone' || value === 'fresh_relaunch' || value === 'manual_defaults';
}

export async function POST(request: NextRequest) {
  try {
    const { user, businessId } = await getRequiredAppContext();
    const body = (await request.json().catch(() => ({}))) as CreateReviveDraftRequest;
    const adAccountId =
      typeof body.adAccountId === 'string' && body.adAccountId.length > 0 ? body.adAccountId : null;
    const platformIntegrationId =
      typeof body.platformIntegrationId === 'string' && body.platformIntegrationId.length > 0
        ? body.platformIntegrationId
        : null;

    if (!adAccountId || !platformIntegrationId || !isReviveDraftSource(body.source)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing revive draft payload',
        },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const result = await createReviveCampaignDraft(supabase, {
      businessId,
      platformIntegrationId,
      adAccountId,
      userId: user.id,
      source: body.source,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Failed to create revive campaign draft:', error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to create revive campaign draft',
      },
      { status: 500 }
    );
  }
}
