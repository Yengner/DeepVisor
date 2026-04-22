import { NextRequest, NextResponse } from 'next/server';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import {
  getMetaAccountIntelligenceReadModel,
  runMetaAdAccountAssessment,
  syncMetaAccountIntelligenceArtifacts,
} from '@/lib/server/intelligence';
import { deleteSignalCalendarQueueItems } from '@/lib/server/intelligence/repositories/calendarQueue';
import { createAdminClient } from '@/lib/server/supabase/admin';

export async function POST(request: NextRequest) {
  try {
    const { businessId } = await getRequiredAppContext();
    const adminSupabase = createAdminClient();
    const body = await request.json().catch(() => ({}));
    const adAccountId = typeof body?.adAccountId === 'string' ? body.adAccountId : null;
    const platformIntegrationId =
      typeof body?.platformIntegrationId === 'string' ? body.platformIntegrationId : null;

    if (!adAccountId || !platformIntegrationId) {
      return NextResponse.json(
        { error: 'Select an ad account before rebuilding the queue.' },
        { status: 400 }
      );
    }

    const { data: adAccount, error: adAccountError } = await adminSupabase
      .from('ad_accounts')
      .select('id, platform_id')
      .eq('id', adAccountId)
      .eq('business_id', businessId)
      .maybeSingle();

    if (adAccountError) {
      throw adAccountError;
    }

    if (!adAccount) {
      return NextResponse.json({ error: 'Ad account not found' }, { status: 404 });
    }

    const { data: platformIntegration, error: platformIntegrationError } = await adminSupabase
      .from('platform_integrations')
      .select('id, platform_id')
      .eq('id', platformIntegrationId)
      .eq('business_id', businessId)
      .maybeSingle();

    if (platformIntegrationError) {
      throw platformIntegrationError;
    }

    if (!platformIntegration || platformIntegration.platform_id !== adAccount.platform_id) {
      return NextResponse.json(
        { error: 'Selected ad account is not available on that integration.' },
        { status: 400 }
      );
    }

    const assessment = await runMetaAdAccountAssessment({
      supabase: adminSupabase,
      businessId,
      platformIntegrationId,
      adAccountId,
      trigger: 'manual',
    });

    const removedCount = await deleteSignalCalendarQueueItems(adminSupabase, {
      businessId,
      adAccountId,
    });

    await syncMetaAccountIntelligenceArtifacts({
      supabase: adminSupabase,
      assessment,
    });

    const intelligence = await getMetaAccountIntelligenceReadModel(adminSupabase, {
      businessId,
      adAccountId,
    });

    return NextResponse.json({
      success: true,
      removedCount,
      queueItems: intelligence.queueItems,
    });
  } catch (error) {
    console.error('Failed to rebuild calendar queue:', error);
    return NextResponse.json(
      { error: 'Failed to rebuild calendar queue' },
      { status: 500 }
    );
  }
}
