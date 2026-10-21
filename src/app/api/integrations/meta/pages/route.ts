import { getBusinessIntegrationById } from '@/lib/server/integrations/service';
import { SIMULATION_TAG, assertSimulationEnabled } from '@/lib/server/integrations/simulation/meta';
import { asRecord } from '@/lib/shared';
import { NextRequest, NextResponse } from 'next/server';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import { getMetaPages } from '@/lib/server/actions/meta/pages/actions';
import { createServerClient } from '@/lib/server/supabase/server';
import { ErrorCode, fail, ok } from '@/lib/shared';

export async function GET(request: NextRequest) {
  try {
    const { businessId } = await getRequiredAppContext(false);
    const integrationId = request.nextUrl.searchParams.get('integrationId');
    const externalAccountId = request.nextUrl.searchParams.get('externalAccountId');

    if (!integrationId) {
      return NextResponse.json(
        fail('Missing integration id', ErrorCode.VALIDATION_ERROR, {
          userMessage: 'Choose a Meta integration before selecting a Facebook Page.',
        }),
        { status: 400 }
      );
    }

    const supabase = await createServerClient();
    const integration = await getBusinessIntegrationById(supabase, { businessId, integrationId });
    if (!integration) return NextResponse.json(fail('Integration not found', ErrorCode.NOT_FOUND), { status: 404 });
    if (asRecord(integration.integrationDetails)[SIMULATION_TAG]) {
      assertSimulationEnabled();
      return NextResponse.json(ok({ pages: [], selectedPageId: null, whatsappSetupCompleted: false }));
    }
    const [{ data: profile, error: profileError }, pagesResponse] = await Promise.all([
      supabase
        .from('business_profiles')
        .select('meta_page_id, whatsapp_setup_completed')
        .eq('id', businessId)
        .single(),
      getMetaPages({
        platformId: integrationId,
        adAccountId: externalAccountId,
      }),
    ]);

    if (profileError) {
      throw profileError;
    }

    if (!pagesResponse.success) {
      return NextResponse.json(pagesResponse, { status: 502 });
    }

    return NextResponse.json(
      ok({
        pages: pagesResponse.data,
        selectedPageId: profile?.meta_page_id ?? null,
        whatsappSetupCompleted: Boolean(profile?.whatsapp_setup_completed),
      })
    );
  } catch (error) {
    return NextResponse.json(
      fail(
        error instanceof Error ? error.message : 'Failed to load Meta Pages',
        ErrorCode.UNKNOWN_ERROR,
        {
          userMessage: 'We could not load your Facebook Pages right now.',
        }
      ),
      { status: 500 }
    );
  }
}
