import { NextRequest, NextResponse } from 'next/server';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import { createAdminClient } from '@/lib/server/supabase/admin';
import {
  createCalendarQueueItem,
  listCalendarQueueItems,
} from '@/lib/server/intelligence/repositories/calendarQueue';
import {
  getTrendFindingById,
  markTrendFindingConvertedToQueue,
  toTrendFindingView,
} from '@/lib/server/intelligence/repositories/trendFindings';
import type { CalendarQueueItemDraft } from '@/lib/server/intelligence/types';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ findingId: string }> }
) {
  try {
    const { findingId } = await params;
    const { businessId } = await getRequiredAppContext();
    const supabase = createAdminClient();
    const finding = await getTrendFindingById(supabase, {
      businessId,
      findingId,
    });

    if (!finding) {
      return NextResponse.json(
        { success: false, error: 'Trend finding not found.' },
        { status: 404 }
      );
    }

    if (!finding.recommendedAction?.queueSuggested) {
      return NextResponse.json(
        { success: false, error: 'This finding does not have a calendar action.' },
        { status: 400 }
      );
    }

    const queueItems = await listCalendarQueueItems(supabase, {
      businessId,
      adAccountId: finding.adAccountId,
    });
    const duplicate = queueItems.find(
      (item) =>
        item.sourceType === 'ai' &&
        item.payload?.trendFindingId === finding.id &&
        item.status !== 'dismissed' &&
        item.status !== 'completed'
    );

    if (!duplicate) {
      const draft: CalendarQueueItemDraft = {
        businessId,
        platformIntegrationId: finding.platformIntegrationId,
        adAccountId: finding.adAccountId,
        sourceSignalId: null,
        sourceType: 'ai',
        itemType: finding.recommendedAction.type,
        priority:
          finding.severity === 'critical'
            ? 'critical'
            : finding.severity === 'warning'
              ? 'high'
              : 'medium',
        title: finding.title,
        description: finding.summary,
        destinationHref: finding.recommendedAction.href ?? '/calendar',
        payload: {
          trendFindingId: finding.id,
          trendFindingType: finding.findingType,
          adsetId: finding.adsetId,
          metricSnapshot: finding.metricSnapshot,
        },
      };

      await createCalendarQueueItem(supabase, draft);
    }

    const updatedFinding = await markTrendFindingConvertedToQueue(supabase, {
      businessId,
      findingId,
    });

    return NextResponse.json({
      success: true,
      finding: updatedFinding ? toTrendFindingView(updatedFinding) : null,
      created: !duplicate,
    });
  } catch (error) {
    console.error('Failed to approve trend finding:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to approve finding.' },
      { status: 500 }
    );
  }
}
