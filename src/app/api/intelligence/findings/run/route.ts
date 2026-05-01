import { NextRequest, NextResponse } from 'next/server';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import { resolveCurrentSelection } from '@/lib/server/actions/app/selection';
import { createAdminClient } from '@/lib/server/supabase/admin';
import {
  syncMetaTrendIntelligenceArtifacts,
} from '@/lib/server/intelligence';
import { toTrendFindingView } from '@/lib/server/intelligence/repositories/trendFindings';

type RunFindingsBody = {
  platformIntegrationId?: string | null;
  adAccountId?: string | null;
};

async function validateAccount(
  supabase: ReturnType<typeof createAdminClient>,
  input: {
    businessId: string;
    adAccountId: string;
  }
) {
  const { data, error } = await supabase
    .from('ad_accounts')
    .select('id')
    .eq('id', input.adAccountId)
    .eq('business_id', input.businessId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
}

export async function POST(request: NextRequest) {
  try {
    const { businessId } = await getRequiredAppContext();
    const selection = await resolveCurrentSelection(businessId);
    const body = (await request.json().catch(() => ({}))) as RunFindingsBody;
    const adAccountId = body.adAccountId ?? selection.selectedAdAccountId ?? null;
    const platformIntegrationId =
      body.platformIntegrationId ?? selection.selectedPlatformId ?? null;

    if (!adAccountId || !platformIntegrationId) {
      return NextResponse.json(
        { success: false, error: 'Select a connected Meta ad account first.' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const hasAccess = await validateAccount(supabase, {
      businessId,
      adAccountId,
    });

    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: 'The selected ad account is not available for this business.' },
        { status: 404 }
      );
    }

    const result = await syncMetaTrendIntelligenceArtifacts({
      supabase,
      businessId,
      platformIntegrationId,
      adAccountId,
    });

    return NextResponse.json({
      success: true,
      findings: result.findings.map(toTrendFindingView),
      notificationSummary: result.notificationSummary,
      patternCount: result.patternCount,
    });
  } catch (error) {
    console.error('Failed to run trend findings:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to run findings.' },
      { status: 500 }
    );
  }
}
