import { NextResponse } from 'next/server';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import { createAdminClient } from '@/lib/server/supabase/admin';
import {
  createCalendarQueueItem,
  listCalendarQueueItems,
} from '@/lib/server/intelligence/repositories/calendarQueue';
import type { CalendarQueueItemDraft, CalendarQueueItemType, CalendarQueuePriority } from '@/lib/server/intelligence/types';

type CreateDashboardQueueBody = {
  platformIntegrationId?: string | null;
  adAccountId?: string | null;
  itemType?: CalendarQueueItemType;
  priority?: CalendarQueuePriority;
  title?: string;
  description?: string | null;
  destinationHref?: string | null;
  payload?: Record<string, unknown>;
};

async function validateAdAccountAccess(
  supabase: ReturnType<typeof createAdminClient>,
  input: {
    businessId: string;
    adAccountId: string;
  }
) {
  const { data, error } = await supabase
    .from('ad_accounts')
    .select('id')
    .eq('id', input.adAccountId)
    .eq('business_id', input.businessId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
}

export async function POST(request: Request) {
  try {
    const { businessId } = await getRequiredAppContext();
    const supabase = createAdminClient();
    const body = (await request.json()) as CreateDashboardQueueBody;

    if (!body.platformIntegrationId || !body.adAccountId || !body.itemType || !body.title) {
      return NextResponse.json(
        { error: 'platformIntegrationId, adAccountId, itemType, and title are required.' },
        { status: 400 }
      );
    }

    const hasAccess = await validateAdAccountAccess(supabase, {
      businessId,
      adAccountId: body.adAccountId,
    });

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Selected ad account was not found for this business.' },
        { status: 404 }
      );
    }

    const existingRows = await listCalendarQueueItems(supabase, {
      businessId,
      adAccountId: body.adAccountId,
    });
    const duplicate = existingRows.find(
      (item) =>
        item.sourceType === 'ai' &&
        item.title === body.title &&
        item.status !== 'dismissed' &&
        item.status !== 'completed'
    );

    if (duplicate) {
      return NextResponse.json({
        success: true,
        created: false,
        queueItem: duplicate,
      });
    }

    const draft: CalendarQueueItemDraft = {
      businessId,
      platformIntegrationId: body.platformIntegrationId,
      adAccountId: body.adAccountId,
      sourceSignalId: null,
      sourceType: 'ai',
      itemType: body.itemType,
      priority: body.priority ?? 'medium',
      title: body.title,
      description: body.description ?? null,
      destinationHref: body.destinationHref ?? '/calendar',
      payload: body.payload ?? {},
    };

    const queueItem = await createCalendarQueueItem(supabase, draft);

    return NextResponse.json({
      success: true,
      created: true,
      queueItem,
    });
  } catch (error) {
    console.error('Failed to create calendar queue item from dashboard:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to create queue item.' },
      { status: 500 }
    );
  }
}
