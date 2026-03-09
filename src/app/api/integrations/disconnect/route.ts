import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/server/supabase/server';
import { requireUserId } from '@/lib/server/actions/user/session';
import { getOrCreateOrganizationBusinessContext } from '@/lib/server/actions/business/context';
import { softDisconnectIntegration } from '@/lib/server/integrations/service';
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

    const supabase = await createServerClient();
    const userId = await requireUserId();
    const context = await getOrCreateOrganizationBusinessContext(userId);

    await softDisconnectIntegration(supabase, {
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
