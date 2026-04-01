import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/server/supabase/server';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import {
  getBusinessIntegrationById,
  setPrimaryMetaAdAccount,
} from '@/lib/server/integrations/service';
import { syncBusinessPlatform } from '@/lib/server/sync';
import { ErrorCode, fail, ok } from '@/lib/shared';

type TestSyncMetaAdAccountRequest = {
  integrationId?: string;
  externalAccountId?: string;
  adAccountName?: string;
  backfillDays?: number;
};

function normalizeBackfillDays(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }

  return Math.floor(value);
}

export async function POST(request: NextRequest) {
  try {
    const { businessId } = await getRequiredAppContext();
    const body = (await request.json().catch(() => ({}))) as TestSyncMetaAdAccountRequest;
    const integrationId =
      typeof body.integrationId === 'string' ? body.integrationId : null;
    const externalAccountId =
      typeof body.externalAccountId === 'string' ? body.externalAccountId : null;
    const requestedAccountName =
      typeof body.adAccountName === 'string' && body.adAccountName.trim().length > 0
        ? body.adAccountName.trim()
        : null;
    const backfillDays = normalizeBackfillDays(body.backfillDays);

    if (!integrationId || !externalAccountId) {
      return NextResponse.json(
        fail('Missing test sync payload', ErrorCode.VALIDATION_ERROR, {
          userMessage: 'Provide both integrationId and externalAccountId.',
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

    const { data: savedAccount, error: savedAccountError } = await supabase
      .from('ad_accounts')
      .select('id, name, external_account_id')
      .eq('business_id', businessId)
      .eq('platform_id', integration.platformId)
      .eq('external_account_id', externalAccountId)
      .maybeSingle();

    if (savedAccountError) {
      throw savedAccountError;
    }

    await setPrimaryMetaAdAccount(supabase, {
      integrationId,
      externalAccountId,
      name: requestedAccountName ?? savedAccount?.name ?? null,
    });

    const summary = await syncBusinessPlatform({
      businessId,
      integrationId,
      trigger: 'integration',
      backfillDays,
    });

    const { data: syncedAccount, error: syncedAccountError } = await supabase
      .from('ad_accounts')
      .select('id, name, external_account_id')
      .eq('business_id', businessId)
      .eq('platform_id', integration.platformId)
      .eq('external_account_id', externalAccountId)
      .maybeSingle();

    if (syncedAccountError) {
      throw syncedAccountError;
    }

    const response = NextResponse.json(
      ok({
        integrationId,
        platformId: integration.platformId,
        externalAccountId,
        adAccountId: syncedAccount?.id ?? null,
        adAccountName: syncedAccount?.name ?? requestedAccountName ?? savedAccount?.name ?? null,
        counts: summary.counts,
        startedAt: summary.startedAt,
        completedAt: summary.completedAt,
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
    console.error('Meta test ad account sync failed:', error);

    return NextResponse.json(
      fail(
        error instanceof Error ? error.message : 'Failed to sync the selected Meta ad account',
        ErrorCode.UNKNOWN_ERROR
      ),
      { status: 500 }
    );
  }
}
