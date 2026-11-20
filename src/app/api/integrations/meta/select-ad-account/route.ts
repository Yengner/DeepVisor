export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import {
  getBusinessIntegrationById,
} from '@/lib/server/integrations/service';
import { createAdminClient } from '@/lib/server/supabase/admin';
import {
  applyAppSelectionCookies,
  syncSelectedMetaAdAccount,
} from '@/lib/server/integrations/metaSelection';
import { dispatchAccountSync } from '@/lib/server/sync/dispatch';
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
    return 'Meta is busy right now. Wait a minute and try again.';
  }

  return message;
}

/**
 * Selects a primary Meta ad account for an integration and kicks off the initial sync workflow.
 *
 * The route validates the submitted integration/account pair against already-discovered server
 * state, promotes that account to the integration's primary selection, queues its sync and starts it
 * in the background, and updates the app-selection cookies used by the UI. It does not wait for Meta.
 *
 * @param request - Next.js request containing the selected integration id and external account id.
 * @returns A JSON response with the selected account, sync coverage, and updated selection cookies.
 */
export async function POST(request: NextRequest) {
  try {
    const { businessId } = await getRequiredAppContext(false);
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

    const supabase = createAdminClient();
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

    if (!savedAccount?.external_account_id) {
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
      externalAccountId: savedAccount.external_account_id,
      name: savedAccount.name,
      trigger: 'integration',
    });

    // The sync runs after this response (same durable job + lease; the cron worker picks it up if this
    // run is cut short), so the owner continues setup instead of waiting for Meta.
    if (result.syncJobId && result.firstSyncJob?.status !== 'completed') {
      dispatchAccountSync(result.syncJobId, businessId);
    }

    const response = NextResponse.json(
      ok({
        integrationId: result.integrationId,
        adAccountId: result.adAccountId,
        externalAccountId: result.externalAccountId,
        syncCoverage: result.syncCoverage,
        firstSyncJob: result.firstSyncJob,
        syncJobId: result.syncJobId,
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
