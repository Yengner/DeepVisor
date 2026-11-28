import { NextRequest, NextResponse } from 'next/server';
import { requireUserId } from '@/lib/server/actions/user/session';
import { getOrCreateOrganizationBusinessContext } from '@/lib/server/actions/business/context';
import { canManageBusiness } from '@/lib/shared/business/access';
import { softDisconnectIntegration } from '@/lib/server/integrations/service';
import { releaseIntegrationWebhooks } from '@/lib/server/webhooks/subscription';
import { stopSharedConnections } from '@/lib/server/clients/sharedSync';
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
    if (!canManageBusiness(context.role)) {
      return NextResponse.json({ success: false } satisfies DisconnectIntegrationResponse, { status: 403 });
    }

    // Client businesses borrow this connection's token, so their syncing stops with it.
    await stopSharedConnections(context.businessId);
    await releaseIntegrationWebhooks(body.integrationId, context.businessId).catch(() => console.warn('Meta webhook subscription could not be released.'));

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
