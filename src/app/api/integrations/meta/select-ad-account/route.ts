import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/server/supabase/server';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import {
  getBusinessIntegrationById,
  listMetaAccessibleAdAccounts,
  setPrimaryMetaAdAccount,
} from '@/lib/server/integrations/service';
import { syncBusinessPlatform } from '@/lib/server/sync';
import { ErrorCode, fail, ok } from '@/lib/shared';

export async function POST(request: NextRequest) {
  try {
    const { businessId } = await getRequiredAppContext();
    const body = await request.json().catch(() => ({}));
    const integrationId =
      typeof body.integrationId === 'string' ? body.integrationId : null;
    const externalAccountId =
      typeof body.externalAccountId === 'string' ? body.externalAccountId : null;

    if (!integrationId || !externalAccountId) {
      return NextResponse.json(
        fail('Missing account selection payload', ErrorCode.VALIDATION_ERROR, {
          userMessage: 'Choose one Meta ad account to continue.',
        }),
        { status: 400 }
      );
    }

    const supabase = await createServerClient();
    const integration = await getBusinessIntegrationById(supabase, {
      businessId,
      integrationId,
    });

    if (!integration || integration.platformKey !== 'meta') {
      return NextResponse.json(
        fail('Meta integration not found', ErrorCode.NOT_FOUND, {
          userMessage: 'The selected Meta integration could not be found.',
        }),
        { status: 404 }
      );
    }

    const accounts = await listMetaAccessibleAdAccounts(supabase, integration);
    const selectedAccount = accounts.find((account) => account.externalAccountId === externalAccountId);

    if (!selectedAccount) {
      return NextResponse.json(
        fail('Selected Meta ad account is not available', ErrorCode.VALIDATION_ERROR, {
          userMessage: 'Choose a valid Meta ad account for this integration.',
        }),
        { status: 400 }
      );
    }

    await setPrimaryMetaAdAccount(supabase, {
      integrationId,
      externalAccountId: selectedAccount.externalAccountId,
      name: selectedAccount.name,
    });

    await syncBusinessPlatform({
      businessId,
      platformId: integration.platformId,
      trigger: 'integration',
    });

    const { data: syncedAccount, error: syncedAccountError } = await supabase
      .from('ad_accounts')
      .select('id')
      .eq('business_id', businessId)
      .eq('platform_id', integration.platformId)
      .eq('external_account_id', selectedAccount.externalAccountId)
      .maybeSingle();

    if (syncedAccountError) {
      throw syncedAccountError;
    }

    const response = NextResponse.json(
      ok({
        integrationId,
        adAccountId: syncedAccount?.id ?? null,
        externalAccountId: selectedAccount.externalAccountId,
      })
    );

    response.cookies.set('platform_integration_id', integrationId, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });

    if (syncedAccount?.id) {
      response.cookies.set('ad_account_row_id', syncedAccount.id, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
      });
    }

    return response;
  } catch (error) {
    return NextResponse.json(
      fail(
        error instanceof Error ? error.message : 'Failed to select Meta ad account',
        ErrorCode.UNKNOWN_ERROR
      ),
      { status: 500 }
    );
  }
}
