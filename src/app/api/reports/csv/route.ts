import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/server/supabase/server';
import { reportExportError } from '@/lib/server/reports/access';
import { getOrCreateOrganizationBusinessContext } from '@/lib/server/actions/business/context';
import { buildDemoReportPayload } from '@/lib/server/reports/demo';
import { resolveReportRequest } from '@/lib/server/reports/request';
import { renderReportCsv } from '@/lib/server/reports/csv';
import { buildReportPayload } from '@/lib/server/repositories/reports/buildReportPayload';

function toFileName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'report';
}

function isTruthySearchParam(value: string | null): boolean {
  return value === '1' || value === 'true' || value === 'yes';
}

export async function GET(request: NextRequest) {
  try {
    const client = await createSupabaseClient();
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return NextResponse.json({ message: 'Authentication required.' }, { status: 401 });
    const userId = user.id;
    const context = await getOrCreateOrganizationBusinessContext(userId);
    const query = await resolveReportRequest(
      context.businessId,
      Object.fromEntries(request.nextUrl.searchParams.entries())
    );
    const demoRequested = isTruthySearchParam(request.nextUrl.searchParams.get('demo'));
    const payload = demoRequested
      ? buildDemoReportPayload(query, context.organizationName)
      : await buildReportPayload(query);
    const body = renderReportCsv(payload, demoRequested);

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Cache-Control': 'private, no-store',
        'Content-Disposition': `attachment; filename="${toFileName(payload.export.title)}-report.csv"`,
      },
    });
  } catch (error) {
    const failure = reportExportError(error);
    if (failure.status === 500) console.error('Report export unavailable');
    return NextResponse.json({ message: failure.message }, { status: failure.status });
  }
}
