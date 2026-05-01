import { NextRequest, NextResponse } from 'next/server';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import { resolveCurrentSelection } from '@/lib/server/actions/app/selection';
import { createAdminClient } from '@/lib/server/supabase/admin';
import {
  listTrendFindingsForBusiness,
  toTrendFindingView,
} from '@/lib/server/intelligence/repositories/trendFindings';

export async function GET(request: NextRequest) {
  try {
    const { businessId } = await getRequiredAppContext();
    const selection = await resolveCurrentSelection(businessId);
    const searchParams = request.nextUrl.searchParams;
    const adAccountId = searchParams.get('adAccountId') ?? selection.selectedAdAccountId ?? null;
    const status = (searchParams.get('status') as 'active' | 'dismissed' | 'resolved' | 'converted_to_queue' | 'all' | null) ?? 'active';
    const limit = Number(searchParams.get('limit') ?? 25);
    const supabase = createAdminClient();

    const findings = await listTrendFindingsForBusiness(supabase, {
      businessId,
      adAccountId,
      status,
      limit: Number.isFinite(limit) ? limit : 25,
    });

    return NextResponse.json({
      success: true,
      findings: findings.map(toTrendFindingView),
    });
  } catch (error) {
    console.error('Failed to list trend findings:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to list findings.' },
      { status: 500 }
    );
  }
}
