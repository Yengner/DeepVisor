import { NextResponse } from 'next/server';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import { createAdminClient } from '@/lib/server/supabase/admin';
import {
  deleteCalendarQueueTemplate,
  type CalendarQueueTemplateDraft,
  updateCalendarQueueTemplate,
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

export async function PATCH(
  request: Request,
  context: { params: Promise<{ templateId: string }> }
) {
  try {
    const { businessId } = await getRequiredAppContext();
    const { templateId } = await context.params;
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

    const template = await updateCalendarQueueTemplate(supabase, {
      id: templateId,
      businessId,
      patch: body,
    });

    return NextResponse.json({ template });
  } catch (error) {
    console.error('Failed to update calendar queue template:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to update queue template.' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ templateId: string }> }
) {
  try {
    const { businessId } = await getRequiredAppContext();
    const { templateId } = await context.params;
    const supabase = createAdminClient();

    await deleteCalendarQueueTemplate(supabase, {
      id: templateId,
      businessId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete calendar queue template:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to delete queue template.' },
      { status: 500 }
    );
  }
}
