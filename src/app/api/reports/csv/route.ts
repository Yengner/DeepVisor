import { NextRequest, NextResponse } from 'next/server';
import { requireUserId } from '@/lib/server/actions/user/session';
import { getOrCreateOrganizationBusinessContext } from '@/lib/server/actions/business/context';
import { parseReportQueryInput } from '@/lib/server/reports/query';
import { buildReportCsvRows } from '@/lib/server/repositories/reports/buildReportCsvRows';
import { buildReportPayload } from '@/lib/server/repositories/reports/buildReportPayload';

function escapeCsvValue(value: string | number) {
  const stringValue = String(value ?? '');

  if (/[,"\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

function toFileName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'report';
}

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const context = await getOrCreateOrganizationBusinessContext(userId);
    const query = parseReportQueryInput(
      context.businessId,
      Object.fromEntries(request.nextUrl.searchParams.entries())
    );
    const [payload, rows] = await Promise.all([
      buildReportPayload(query),
      buildReportCsvRows(query),
    ]);

    const headers = rows[0] ? Object.keys(rows[0]) : [];
    const body = [
      headers.join(','),
      ...rows.map((row) => headers.map((header) => escapeCsvValue(row[header as keyof typeof row] ?? '')).join(',')),
    ].join('\n');

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${toFileName(payload.export.title)}-report.csv"`,
      },
    });
  } catch (error) {
    console.error('Failed to export report CSV:', error);

    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : 'Failed to export report CSV',
      },
      { status: 500 }
    );
  }
}
