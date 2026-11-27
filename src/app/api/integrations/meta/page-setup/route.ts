import { NextRequest, NextResponse } from 'next/server';
import { unstable_rethrow } from 'next/navigation';
import { canManageBusiness } from '@/lib/shared/business/access';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import { getMetaPages } from '@/lib/server/actions/meta/pages/actions';
import { createAdminClient } from '@/lib/server/supabase/admin';
import { ErrorCode, fail, ok } from '@/lib/shared';

function cleanString(value: unknown): string | null {
  return typeof value === 'string' ? value.trim() || null : null;
}

/** Saves the Facebook Page used for ads. The WhatsApp number is saved by `../whatsapp`. */
export async function POST(request: NextRequest) {
  try {
    const { businessId, role } = await getRequiredAppContext(false);
    if (!canManageBusiness(role)) {
      return NextResponse.json(
        fail('Requires an owner or admin', ErrorCode.FORBIDDEN, {
          userMessage: 'Only an owner or admin can change this setup.',
        }),
        { status: 403 }
      );
    }
    const body = await request.json().catch(() => ({}));
    const integrationId = cleanString(body.integrationId);
    const externalAccountId = cleanString(body.externalAccountId);
    const pageId = cleanString(body.pageId);

    if (!integrationId || !pageId) {
      return NextResponse.json(
        fail('Missing Page setup payload', ErrorCode.VALIDATION_ERROR, {
          userMessage: 'Choose a Facebook Page to continue.',
        }),
        { status: 400 }
      );
    }

    const pagesResponse = await getMetaPages({
      platformId: integrationId,
      adAccountId: externalAccountId,
    });

    if (!pagesResponse.success) {
      return NextResponse.json(pagesResponse, { status: 502 });
    }

    const selectedPage = pagesResponse.data.find((page) => page.page_id === pageId) ?? null;
    if (!selectedPage) {
      return NextResponse.json(
        fail('Selected Page was not returned by Meta', ErrorCode.VALIDATION_ERROR, {
          userMessage: 'Choose a Facebook Page returned by Meta.',
        }),
        { status: 400 }
      );
    }

    const { error } = await createAdminClient()
      .from('business_profiles')
      .update({
        meta_page_id: selectedPage.page_id,
        meta_page_name: selectedPage.name,
        meta_page_instagram_account_id: selectedPage.instagram_account_id ?? null,
        meta_page_instagram_account_name: selectedPage.instagram_account_name ?? null,
        meta_page_instagram_account_username: selectedPage.instagram_account_username ?? null,
        meta_page_instagram_account_picture_url: selectedPage.instagram_account_picture_url ?? null,
        meta_page_picture_url: selectedPage.picture_url ?? null,
        page_phone: selectedPage.phone?.trim().replace(/[\s\-()]/g, '') || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', businessId);

    if (error) {
      throw error;
    }

    return NextResponse.json(ok({ pageId: selectedPage.page_id }));
  } catch (error) {
    unstable_rethrow(error);
    return NextResponse.json(
      fail(
        error instanceof Error ? error.message : 'Failed to save the Page',
        ErrorCode.UNKNOWN_ERROR,
        { userMessage: 'We could not save your Facebook Page right now.' }
      ),
      { status: 500 }
    );
  }
}
