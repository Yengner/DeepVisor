import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/server/supabase/server';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import {
  getBusinessIntegrationById,
  getPrimaryAdAccountSelection,
  listMetaAccessibleAdAccounts,
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

    const accounts = await listMetaAccessibleAdAccounts(supabase, integration);
    const primary = getPrimaryAdAccountSelection(integration.integrationDetails);

    return NextResponse.json(
      ok({
        integrationId,
        accounts,
        primaryAdAccountExternalId: primary.externalAccountId,
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
