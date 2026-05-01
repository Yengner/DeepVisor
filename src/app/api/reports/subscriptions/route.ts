import { NextRequest, NextResponse } from 'next/server';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import { createAdminClient } from '@/lib/server/supabase/admin';
import {
  getReportSubscription,
  upsertReportSubscription,
} from '@/lib/server/intelligence/repositories/reportSubscriptions';
import type { ReportSubscriptionSetting } from '@/lib/server/intelligence/types';

export async function GET() {
  try {
    const { businessId, user } = await getRequiredAppContext();
    const supabase = createAdminClient();
    const subscription = await getReportSubscription(supabase, {
      businessId,
      userId: user.id,
    });

    return NextResponse.json({
      success: true,
      subscription,
    });
  } catch (error) {
    console.error('Failed to load report subscription:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to load report subscription.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { businessId, user } = await getRequiredAppContext();
    const body = (await request.json()) as Partial<ReportSubscriptionSetting>;
    const supabase = createAdminClient();
    const subscription = await upsertReportSubscription(supabase, {
      id: body.id ?? null,
      businessId,
      userId: user.id,
      isEnabled: body.isEnabled ?? true,
      cadence: body.cadence ?? 'weekly',
      emailEnabled: body.emailEnabled ?? true,
      inAppEnabled: body.inAppEnabled ?? true,
      timeZone: body.timeZone ?? null,
      lastSentAt: null,
      nextRunAt: null,
      createdAt: null,
      updatedAt: null,
    });

    return NextResponse.json({
      success: true,
      subscription,
    });
  } catch (error) {
    console.error('Failed to save report subscription:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to save report subscription.' },
      { status: 500 }
    );
  }
}
