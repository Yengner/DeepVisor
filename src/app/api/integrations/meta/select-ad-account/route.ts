import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/server/supabase/server';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import {
  getBusinessIntegrationById,
  getPrimaryAdAccountSelection,
  listMetaAccessibleAdAccounts,
} from '@/lib/server/integrations/service';
import {
  applyAppSelectionCookies,
  syncSelectedMetaAdAccount,
} from '@/lib/server/integrations/metaSelection';
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

    let selectedAccount:
      | {
          externalAccountId: string;
          name: string | null;
        }
      | null = null;

    try {
      const accounts = await listMetaAccessibleAdAccounts(supabase, integration);
      const matchedAccessibleAccount = accounts.find(
        (account) => account.externalAccountId === externalAccountId
      );

      if (matchedAccessibleAccount) {
        selectedAccount = {
          externalAccountId: matchedAccessibleAccount.externalAccountId,
          name: matchedAccessibleAccount.name,
        };
      }
    } catch (error) {
      console.warn('Meta accessible account lookup failed during selection, falling back to saved account state:', error);
    }

    if (!selectedAccount) {
      const { data: savedAccount, error: savedAccountError } = await supabase
        .from('ad_accounts')
        .select('external_account_id, name')
        .eq('business_id', businessId)
        .eq('platform_id', integration.platformId)
        .eq('external_account_id', externalAccountId)
        .maybeSingle();

      if (savedAccountError) {
        throw savedAccountError;
      }

      if (savedAccount?.external_account_id) {
        selectedAccount = {
          externalAccountId: savedAccount.external_account_id,
          name: savedAccount.name,
        };
      }
    }

    if (!selectedAccount) {
      const primarySelection = getPrimaryAdAccountSelection(integration.integrationDetails);
      if (primarySelection.externalAccountId === externalAccountId) {
        selectedAccount = {
          externalAccountId,
          name: primarySelection.name,
        };
      }
    }

    if (!selectedAccount) {
      return NextResponse.json(
        fail('Selected Meta ad account is not available', ErrorCode.VALIDATION_ERROR, {
          userMessage: 'Choose a valid Meta ad account for this integration.',
        }),
        { status: 400 }
      );
    }

    const result = await syncSelectedMetaAdAccount({
      supabase,
      businessId,
      integrationId,
      platformId: integration.platformId,
      externalAccountId: selectedAccount.externalAccountId,
      name: selectedAccount.name,
      trigger: 'integration',
    });

    const response = NextResponse.json(
      ok({
        integrationId: result.integrationId,
        adAccountId: result.adAccountId,
        externalAccountId: result.externalAccountId,
      })
    );
    applyAppSelectionCookies(response, {
      platformIntegrationId: result.integrationId,
      adAccountId: result.adAccountId,
    });

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
