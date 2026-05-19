import { NextResponse } from 'next/server';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import { createAdminClient } from '@/lib/server/supabase/admin';
import {
  createCalendarQueueTemplate,
  type CalendarQueueTemplateDraft,
} from '@/lib/server/intelligence/repositories/calendarQueueTemplates';

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_OF_DAY_PATTERN = /^\d{2}:\d{2}(:\d{2})?$/;

function localDateKey(date = new Date()): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function normalizeDateKey(value: unknown, fallback: string): string {
  return typeof value === 'string' && DATE_KEY_PATTERN.test(value) ? value : fallback;
}

function normalizeNullableDateKey(value: unknown): string | null {
  return typeof value === 'string' && DATE_KEY_PATTERN.test(value) ? value : null;
}

function normalizeTimeOfDay(value: unknown): string {
  if (typeof value !== 'string' || !TIME_OF_DAY_PATTERN.test(value)) {
    return '09:00:00';
  }

  return value.length === 5 ? `${value}:00` : value;
}

async function validateAdAccountAccess(
  supabase: ReturnType<typeof createAdminClient>,
  input: {
    businessId: string;
    adAccountId: string | null;
  }
) {
  if (!input.adAccountId) {
    return true;
  }

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
    const { businessId, user } = await getRequiredAppContext();
    const supabase = createAdminClient();
    const body = (await request.json()) as Partial<CalendarQueueTemplateDraft>;
    const defaultStartDate = localDateKey();

    const hasAccess = await validateAdAccountAccess(supabase, {
      businessId,
      adAccountId: body.adAccountId ?? null,
    });

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Selected ad account was not found for this business.' },
        { status: 404 }
      );
    }

    const template = await createCalendarQueueTemplate(supabase, {
      businessId,
      platformIntegrationId: body.platformIntegrationId ?? null,
      adAccountId: body.adAccountId ?? null,
      templateType: body.templateType ?? 'custom',
      title: body.title ?? 'Custom queue',
      description: body.description ?? '',
      destinationHref: body.destinationHref ?? null,
      recurrenceType: body.recurrenceType ?? 'weekly',
      weekdays: body.weekdays ?? [],
      monthlyDay: body.monthlyDay ?? null,
      timeOfDay: normalizeTimeOfDay(body.timeOfDay),
      durationMinutes: body.durationMinutes ?? 45,
      startDate: normalizeDateKey(body.startDate, defaultStartDate),
      endDate: normalizeNullableDateKey(body.endDate),
      status: body.status ?? 'active',
      createdByUserId: user.id,
      updatedByUserId: user.id,
      payloadJson: body.payloadJson ?? {},
    });

    return NextResponse.json({ template });
  } catch (error) {
    console.error('Failed to create calendar queue template:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to create queue template.' },
      { status: 500 }
    );
  }
}
