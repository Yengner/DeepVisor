import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/server/supabase/server';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import {
  getBusinessIntegrationById,
  getPrimaryAdAccountSelection,
} from '@/lib/server/integrations/service';
import { ErrorCode, fail, ok } from '@/lib/shared';

export async function GET(request: NextRequest) {
  try {
    const { businessId } = await getRequiredAppContext();
    const integrationId = request.nextUrl.searchParams.get('integrationId');

    if (!integrationId) {
      return NextResponse.json(
        fail('Missing integration id', ErrorCode.VALIDATION_ERROR, {
          userMessage: 'Choose an integration first.',
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

    const primary = getPrimaryAdAccountSelection(integration.integrationDetails);
    const { data: savedAccounts, error: savedAccountsError } = await supabase
      .from('ad_accounts')
      .select('external_account_id, name, status')
      .eq('business_id', businessId)
      .eq('platform_id', integration.platformId)
      .order('last_synced', { ascending: false });

    if (savedAccountsError) {
      throw savedAccountsError;
    }

    const accountsByExternalId = new Map<
      string,
      { externalAccountId: string; name: string | null; status: string | null }
    >();

    for (const account of savedAccounts ?? []) {
      if (!account.external_account_id || accountsByExternalId.has(account.external_account_id)) {
        continue;
      }

      accountsByExternalId.set(account.external_account_id, {
        externalAccountId: account.external_account_id,
        name: account.name,
        status: account.status,
      });
    }

    if (primary.externalAccountId && !accountsByExternalId.has(primary.externalAccountId)) {
      accountsByExternalId.set(primary.externalAccountId, {
        externalAccountId: primary.externalAccountId,
        name: primary.name,
        status: null,
      });
    }

    const accounts = Array.from(accountsByExternalId.values());

    return NextResponse.json(
      ok({
        integrationId,
        accounts,
        primaryAdAccountExternalId: primary.externalAccountId,
        primaryAdAccountName: primary.name,
      })
    );
  } catch (error) {
    return NextResponse.json(
      fail(
        error instanceof Error ? error.message : 'Failed to load Meta ad accounts',
        ErrorCode.UNKNOWN_ERROR
      ),
      { status: 500 }
    );
  }
}
