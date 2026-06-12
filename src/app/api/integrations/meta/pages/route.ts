import { NextRequest, NextResponse } from 'next/server';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import { getMetaPages } from '@/lib/server/actions/meta/pages/actions';
import { createServerClient } from '@/lib/server/supabase/server';
import { ErrorCode, fail, ok } from '@/lib/shared';

export async function GET(request: NextRequest) {
  try {
    const { businessId } = await getRequiredAppContext();
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
