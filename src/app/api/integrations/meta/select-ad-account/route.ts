import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/server/supabase/server';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import {
  getBusinessIntegrationById,
  getPrimaryAdAccountSelection,
} from '@/lib/server/integrations/service';
import {
  applyAppSelectionCookies,
  syncSelectedMetaAdAccount,
} from '@/lib/server/integrations/metaSelection';
import { ErrorCode, fail, ok } from '@/lib/shared';

/**
 * Maps low-level sync or provider errors to a user-facing message suitable for the account-selection UI.
 *
 * @param message - Raw error message captured during account selection or first sync.
 * @returns A sanitized message that is safer and more actionable for end users.
 */
function getSelectionUserMessage(message: string): string {
  const normalized = message.toLowerCase();

  if (
    normalized.includes('service temporarily unavailable') ||
    normalized.includes('temporarily unavailable')
  ) {
    return 'Meta is temporarily unavailable while we sync this account. Wait a minute and try again.';
  }

  if (normalized.includes('rate limit')) {
    return 'Meta rate-limited the first sync. Wait a minute and retry.';
  }

  return message;
}

/**
 * Selects a primary Meta ad account for an integration and kicks off the initial sync workflow.
 *
 * The route validates the submitted integration/account pair against already-discovered server
 * state, promotes that account to the integration's primary selection, syncs it, and updates the
 * app-selection cookies used by the UI.
 *
 * @param request - Next.js request containing the selected integration id and external account id.
 * @returns A JSON response with the selected account, sync coverage, and updated selection cookies.
 */
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
        syncCoverage: result.syncCoverage,
      })
    );
    applyAppSelectionCookies(response, {
      platformIntegrationId: result.integrationId,
      adAccountId: result.adAccountId,
    });

    return response;
  } catch (error) {
    console.error('Failed to select Meta ad account:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to select Meta ad account';

    return NextResponse.json(
      fail(
        message,
        ErrorCode.UNKNOWN_ERROR,
        {
          userMessage: getSelectionUserMessage(message),
        }
      ),
      { status: 500 }
    );
  }
}
