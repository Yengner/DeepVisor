import { NextRequest, NextResponse } from 'next/server';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import {
  getMetaAccountIntelligenceReadModel,
  type CalendarQueueItemDraft,
  type CalendarQueueItemType,
  type CalendarQueuePriority,
} from '@/lib/server/intelligence';
import {
  processCalendarQueue,
  processCalendarQueueItem,
} from '@/lib/server/intelligence/calendarQueueProcessor';
import { createCalendarQueueItemWithStatus } from '@/lib/server/intelligence/repositories/calendarQueue';
import { createAdminClient } from '@/lib/server/supabase/admin';

type DevCalendarQueueAction = 'create_test_item' | 'create_and_process' | 'process_due';

type DevCalendarQueueBody = {
  action?: DevCalendarQueueAction;
  platformIntegrationId?: string | null;
  adAccountId?: string | null;
  itemType?: CalendarQueueItemType;
  priority?: CalendarQueuePriority;
  scheduledOffsetMinutes?: number;
  processNowOffsetMinutes?: number;
  reportLookbackDays?: number;
  reportCampaignId?: string | null;
  reportAdsetId?: string | null;
  reportAdId?: string | null;
};

const ITEM_TYPE_LABELS: Record<CalendarQueueItemType, string> = {
  revive_campaign: 'Revive campaign',
  refresh_creative: 'Refresh creative',
  investigate_efficiency: 'Investigate efficiency',
  launch_test: 'Launch test',
  fix_tracking: 'Fix tracking',
  review_report: 'Review report',
  campaign_review: 'Campaign review',
};

function isDevRouteEnabled() {
  return process.env.NODE_ENV !== 'production';
}

function normalizeItemType(value: unknown): CalendarQueueItemType {
  return value === 'revive_campaign' ||
    value === 'refresh_creative' ||
    value === 'investigate_efficiency' ||
    value === 'launch_test' ||
    value === 'fix_tracking' ||
    value === 'review_report' ||
    value === 'campaign_review'
    ? value
    : 'review_report';
}

function normalizePriority(value: unknown): CalendarQueuePriority {
  return value === 'low' ||
    value === 'medium' ||
    value === 'high' ||
    value === 'critical'
    ? value
    : 'medium';
}

function normalizeOffset(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(-1440, Math.min(1440, Math.floor(value)));
}

function normalizeReportLookbackDays(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 7;
  }

  return Math.max(1, Math.min(366, Math.floor(value)));
}

function normalizeOptionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function scheduledDateFromOffset(minutes: number): Date {
  const scheduledFor = new Date();
  scheduledFor.setMinutes(scheduledFor.getMinutes() + minutes);
  return scheduledFor;
}

async function validateAdAccountAccess(
  supabase: ReturnType<typeof createAdminClient>,
  input: {
    businessId: string;
    adAccountId: string;
  }
) {
  const { data, error } = await supabase
    .from('ad_accounts')
    .select('id, name, platform_id')
    .eq('id', input.adAccountId)
    .eq('business_id', input.businessId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ?? null;
}

async function loadQueueItems(
  supabase: ReturnType<typeof createAdminClient>,
  input: {
    businessId: string;
    adAccountId: string;
    userId: string;
  }
) {
  const intelligence = await getMetaAccountIntelligenceReadModel(supabase, input);
  return intelligence.queueItems;
}

export async function POST(request: NextRequest) {
  if (!isDevRouteEnabled()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const { businessId, user } = await getRequiredAppContext();
    const body = (await request.json().catch(() => ({}))) as DevCalendarQueueBody;
    const adminSupabase = createAdminClient();
    const adAccountId =
      typeof body.adAccountId === 'string' && body.adAccountId.trim().length > 0
        ? body.adAccountId.trim()
        : null;

    if (!adAccountId) {
      return NextResponse.json(
        { error: 'Select an ad account before using the queue dev tool.' },
        { status: 400 }
      );
    }

    const adAccount = await validateAdAccountAccess(adminSupabase, {
      businessId,
      adAccountId,
    });

    if (!adAccount) {
      return NextResponse.json({ error: 'Ad account not found.' }, { status: 404 });
    }

    if (body.action === 'create_test_item' || body.action === 'create_and_process') {
      const platformIntegrationId =
        typeof body.platformIntegrationId === 'string' &&
        body.platformIntegrationId.trim().length > 0
          ? body.platformIntegrationId.trim()
          : null;

      if (!platformIntegrationId) {
        return NextResponse.json(
          { error: 'Select a platform integration before creating a test queue.' },
          { status: 400 }
        );
      }

      const { data: platformIntegration, error: platformIntegrationError } =
        await adminSupabase
          .from('platform_integrations')
          .select('id, platform_id')
          .eq('id', platformIntegrationId)
          .eq('business_id', businessId)
          .maybeSingle();

      if (platformIntegrationError) {
        throw platformIntegrationError;
      }

      if (!platformIntegration || platformIntegration.platform_id !== adAccount.platform_id) {
        return NextResponse.json(
          { error: 'Selected platform integration does not match this ad account.' },
          { status: 400 }
        );
      }

      const itemType = normalizeItemType(body.itemType);
      const priority = normalizePriority(body.priority);
      const scheduledFor = scheduledDateFromOffset(
        normalizeOffset(body.scheduledOffsetMinutes, 0)
      );
      const timestampLabel = scheduledFor.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      });
      const reportPayload: Record<string, unknown> =
        itemType === 'review_report'
          ? {
              lookbackDays: normalizeReportLookbackDays(body.reportLookbackDays),
            }
          : {};
      const reportCampaignId = normalizeOptionalString(body.reportCampaignId);
      const reportAdsetId = normalizeOptionalString(body.reportAdsetId);
      const reportAdId = normalizeOptionalString(body.reportAdId);

      if (itemType === 'review_report') {
        if (reportCampaignId) {
          reportPayload.campaignId = reportCampaignId;
        }

        if (reportAdsetId) {
          reportPayload.adsetId = reportAdsetId;
        }

        if (reportAdId) {
          reportPayload.adId = reportAdId;
        }
      }

      const draft: CalendarQueueItemDraft = {
        businessId,
        platformIntegrationId,
        adAccountId,
        sourceSignalId: null,
        sourceType: 'manual',
        itemType,
        priority,
        title: `Dev test: ${ITEM_TYPE_LABELS[itemType]} at ${timestampLabel}`,
        description:
          'Development-only queue item for testing the calendar processor one item at a time.',
        destinationHref:
          itemType === 'review_report' ? '/reports?compare=previous_period' : '/calendar',
        scheduledFor: scheduledFor.toISOString(),
        dueDate: scheduledFor.toISOString().slice(0, 10),
        createdByUserId: user.id,
        updatedByUserId: user.id,
        payload: {
          devTool: true,
          createdByUserId: user.id,
          scheduledOffsetMinutes: normalizeOffset(body.scheduledOffsetMinutes, 0),
          durationMinutes: 30,
          ...reportPayload,
        },
      };
      const queueItem = await createCalendarQueueItemWithStatus(
        adminSupabase,
        draft,
        'scheduled'
      );
      console.info('[calendar queue dev] created test item', {
        id: queueItem.id,
        itemType,
        priority,
        scheduledFor: queueItem.scheduledFor,
        action: body.action,
      });
      const result =
        body.action === 'create_and_process'
          ? await processCalendarQueueItem(adminSupabase, queueItem, {
              now: new Date(Math.max(Date.now(), scheduledFor.getTime())),
            })
          : null;

      if (result) {
        console.info('[calendar queue dev] processed created test item', {
          id: queueItem.id,
          result,
        });
      }

      const queueItems = await loadQueueItems(adminSupabase, {
        businessId,
        adAccountId,
        userId: user.id,
      });

      return NextResponse.json({
        success: true,
        action: body.action,
        queueItem,
        result,
        queueItems,
      });
    }

    if (body.action === 'process_due') {
      const now = new Date();
      now.setMinutes(
        now.getMinutes() + normalizeOffset(body.processNowOffsetMinutes, 0)
      );
      const result = await processCalendarQueue(adminSupabase, {
        businessId,
        adAccountId,
        limit: 1,
        lookbackDays: 14,
        now,
      });
      const queueItems = await loadQueueItems(adminSupabase, {
        businessId,
        adAccountId,
        userId: user.id,
      });
      console.info('[calendar queue dev] processed due item', result);

      return NextResponse.json({
        success: result.failedCount === 0,
        action: body.action,
        result,
        queueItems,
      });
    }

    return NextResponse.json({ error: 'Unsupported dev queue action.' }, { status: 400 });
  } catch (error) {
    console.error('Calendar queue dev tool failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Calendar queue dev tool failed.' },
      { status: 500 }
    );
  }
}
