import { NextRequest, NextResponse } from 'next/server';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import { createAdminClient } from '@/lib/server/supabase/admin';
import {
  getNotificationPreference,
  upsertNotificationPreference,
} from '@/lib/server/intelligence/repositories/notificationPreferences';
import type { NotificationPreference } from '@/lib/server/intelligence/types';

export async function GET() {
  try {
    const { businessId, user } = await getRequiredAppContext();
    const supabase = createAdminClient();
    const preference = await getNotificationPreference(supabase, {
      businessId,
      userId: user.id,
    });

    return NextResponse.json({
      success: true,
      preference,
    });
  } catch (error) {
    console.error('Failed to load notification preferences:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to load preferences.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { businessId, user } = await getRequiredAppContext();
    const body = (await request.json()) as Partial<NotificationPreference>;
    const supabase = createAdminClient();

    const preference = await upsertNotificationPreference(supabase, {
      id: body.id ?? null,
      businessId,
      userId: user.id,
      inAppEnabled: body.inAppEnabled ?? true,
      emailEnabled: body.emailEnabled ?? true,
      reportReadyEnabled: body.reportReadyEnabled ?? true,
      minSeverity: body.minSeverity ?? 'warning',
      quietHoursStart: body.quietHoursStart ?? null,
      quietHoursEnd: body.quietHoursEnd ?? null,
      timeZone: body.timeZone ?? null,
      createdAt: null,
      updatedAt: null,
    });

    return NextResponse.json({
      success: true,
      preference,
    });
  } catch (error) {
    console.error('Failed to save notification preferences:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to save preferences.' },
      { status: 500 }
    );
  }
}
