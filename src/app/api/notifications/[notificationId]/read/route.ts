import { NextResponse } from 'next/server';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import { markNotificationRead } from '@/lib/server/intelligence/repositories/notifications';
import { createAdminClient } from '@/lib/server/supabase/admin';

export async function POST(
  _request: Request,
  context: { params: Promise<{ notificationId: string }> }
) {
  try {
    const { notificationId } = await context.params;
    const { businessId, user } = await getRequiredAppContext();
    const notification = await markNotificationRead(createAdminClient() as any, {
      businessId,
      userId: user.id,
      notificationId,
    });

    if (!notification) {
      return NextResponse.json(
        { success: false, error: 'Notification not found.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, notification });
  } catch (error) {
    console.error('Failed to mark notification read:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to mark notification read.',
      },
      { status: 500 }
    );
  }
}
