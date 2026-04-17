import { NextResponse } from 'next/server';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import { createAdminClient } from '@/lib/server/supabase/admin';
import {
  createCalendarQueueTemplate,
  type CalendarQueueTemplateDraft,
} from '@/lib/server/intelligence/repositories/calendarQueueTemplates';

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
    const { businessId } = await getRequiredAppContext();
    const supabase = createAdminClient();
    const body = (await request.json()) as Partial<CalendarQueueTemplateDraft>;

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
      timeOfDay: body.timeOfDay ?? '09:00:00',
      durationMinutes: body.durationMinutes ?? 45,
      startDate: body.startDate ?? new Date().toISOString().slice(0, 10),
      endDate: body.endDate ?? null,
      status: body.status ?? 'active',
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
