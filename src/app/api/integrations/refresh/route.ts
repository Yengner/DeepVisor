import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/server/supabase/server';
import { requireUserId } from '@/lib/server/actions/user/session';
import { getOrCreateOrganizationBusinessContext } from '@/lib/server/actions/business/context';
import {
  refreshBusinessAdAccounts,
} from '@/lib/server/integrations/service';
import type { RefreshIntegrationsResponse } from '@/lib/shared/types/integrations';

export async function POST(_request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const userId = await requireUserId();
    const context = await getOrCreateOrganizationBusinessContext(userId);
    const { refreshedCount, failedCount } = await refreshBusinessAdAccounts(supabase, {
      businessId: context.businessId,
      platform: 'meta',
    });

    return NextResponse.json({
      success: true,
      refreshedCount,
      failedCount,
    } satisfies RefreshIntegrationsResponse);
  } catch (error) {
    console.error('Refresh integrations failed:', error);
    return NextResponse.json(
      {
        success: false,
        refreshedCount: 0,
        failedCount: 0,
      } satisfies RefreshIntegrationsResponse,
      { status: 500 }
    );
  }
}
