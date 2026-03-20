import { NextRequest, NextResponse } from 'next/server';
import { requireUserId } from '@/lib/server/actions/user/session';
import { getOrCreateOrganizationBusinessContext } from '@/lib/server/actions/business/context';
import { runManualBusinessSync } from '@/lib/server/sync/manualRefresh';
import type { RefreshIntegrationsResponse } from '@/lib/shared/types/integrations';

export async function POST(_request: NextRequest) {
  try {
    const userId = await requireUserId();
    const context = await getOrCreateOrganizationBusinessContext(userId);
    const result = await runManualBusinessSync({
      businessId: context.businessId,
    });

    if (!result.allowed) {
      return NextResponse.json(
        {
          success: false,
          refreshedCount: 0,
          failedCount: 0,
          message: result.message,
          retryAfterMs: result.retryAfterMs,
          nextAllowedAt: result.nextAllowedAt,
        } satisfies RefreshIntegrationsResponse,
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil(result.retryAfterMs / 1000)),
          },
        }
      );
    }

    return NextResponse.json({
      success: true,
      refreshedCount: result.refreshedCount,
      failedCount: result.failedCount,
      message: 'Sync completed.',
    } satisfies RefreshIntegrationsResponse);
  } catch (error) {
    console.error('Sync refresh failed:', error);

    return NextResponse.json(
      {
        success: false,
        refreshedCount: 0,
        failedCount: 0,
        message: error instanceof Error ? error.message : 'Sync failed',
      } satisfies RefreshIntegrationsResponse,
      { status: 500 }
    );
  }
}
