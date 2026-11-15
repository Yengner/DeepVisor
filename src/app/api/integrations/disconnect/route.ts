import { NextRequest, NextResponse } from 'next/server';
import { requireUserId } from '@/lib/server/actions/user/session';
import { getOrCreateOrganizationBusinessContext } from '@/lib/server/actions/business/context';
import { getBusinessIntegrationById, getPrimaryAdAccountSelection, resolveIntegrationAccessToken, softDisconnectIntegration } from '@/lib/server/integrations/service';
import { releaseAccountWebhooks } from '@/lib/server/webhooks/subscription';
import { createAdminClient } from '@/lib/server/supabase/admin';
import type {
  DisconnectIntegrationRequest,
  DisconnectIntegrationResponse,
} from '@/lib/shared/types/integrations';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as DisconnectIntegrationRequest;

    if (!body?.integrationId || typeof body.integrationId !== 'string') {
      return NextResponse.json({ success: false } satisfies DisconnectIntegrationResponse, {
        status: 400,
      });
    }

    const userId = await requireUserId();
    const context = await getOrCreateOrganizationBusinessContext(userId);

    await releaseWebhooks(body.integrationId, context.businessId).catch(() => console.warn('Meta webhook subscription could not be released.'));

    await softDisconnectIntegration(createAdminClient(), {
      integrationId: body.integrationId,
      businessId: context.businessId,
    });

    return NextResponse.json({ success: true } satisfies DisconnectIntegrationResponse);
  } catch (error) {
    console.error('Disconnect integration failed:', error);
    return NextResponse.json({ success: false } satisfies DisconnectIntegrationResponse, {
      status: 500,
    });
  }
}

/** Best effort, before the credential is removed. Never blocks the disconnect. */
async function releaseWebhooks(integrationId: string, businessId: string) {
  if (process.env.DEEPVISOR_META_WEBHOOKS !== 'true') return;
  const db = createAdminClient();
  const integration = await getBusinessIntegrationById(db, { businessId, integrationId });
  if (!integration || integration.platformKey !== 'meta') return;
  const external = getPrimaryAdAccountSelection(integration.integrationDetails).externalAccountId;
  if (!external) return;
  const account = await db.from('ad_accounts').select('id').eq('business_id', businessId).eq('platform_id', integration.platformId).eq('external_account_id', external).maybeSingle();
  const accessToken = await resolveIntegrationAccessToken(db, integration, businessId);
  if (!account.data || !accessToken) return;
  await releaseAccountWebhooks({ businessId, adAccountId: account.data.id, externalAccountId: external, accessToken });
}
