import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/server/supabase/server';
import { reportExportError } from '@/lib/server/reports/access';
import { getOrCreateOrganizationBusinessContext } from '@/lib/server/actions/business/context';
import { resolveReportRequest } from '@/lib/server/reports/request';
import { renderReportPdfBuffer } from '@/lib/server/reports/pdf/renderReportPdf';

export const runtime = 'nodejs';

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
    const { buffer, fileName } = await renderReportPdfBuffer({
      query,
      organizationName: context.organizationName,
      demo: isTruthySearchParam(request.nextUrl.searchParams.get('demo')),
    });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Cache-Control': 'private, no-store',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    const failure = reportExportError(error);
    if (failure.status === 500) console.error('Report export unavailable');
    return NextResponse.json({ message: failure.message }, { status: failure.status });
  }
}
