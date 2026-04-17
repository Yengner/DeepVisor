import { NextResponse } from 'next/server';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import { createAdminClient } from '@/lib/server/supabase/admin';
import { getMetaAccountIntelligenceReadModel } from '@/lib/server/intelligence';
import { acceptCalendarQueueWorkflow } from '@/lib/server/intelligence/repositories/calendarQueue';

export async function POST(
  _request: Request,
  context: { params: Promise<{ queueItemId: string }> }
) {
  try {
    const { queueItemId } = await context.params;
    const { businessId, user } = await getRequiredAppContext();
    const adminSupabase = createAdminClient();

    const { data: queueItem, error: queueError } = await adminSupabase
      .from('calendar_queue_items')
      .select('id, business_id, ad_account_id')
      .eq('id', queueItemId)
      .eq('business_id', businessId)
      .maybeSingle();

    if (queueError) {
      throw queueError;
    }

    if (!queueItem) {
      return NextResponse.json({ error: 'Queue item not found' }, { status: 404 });
    }

    await acceptCalendarQueueWorkflow(adminSupabase, {
      queueItemId,
      userId: user.id,
    });

    const intelligence = await getMetaAccountIntelligenceReadModel(adminSupabase, {
      businessId,
      adAccountId: queueItem.ad_account_id,
    });

    return NextResponse.json({
      success: true,
      queueItems: intelligence.queueItems,
    });
  } catch (error) {
    console.error('Failed to accept calendar queue workflow:', error);
    return NextResponse.json(
      { error: 'Failed to accept calendar queue workflow' },
      { status: 500 }
    );
  }
}
