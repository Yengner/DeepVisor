import { NextRequest, NextResponse } from 'next/server';
import { requireUserId } from '@/lib/server/actions/user/session';
import { getOrCreateOrganizationBusinessContext } from '@/lib/server/actions/business/context';
import { buildDemoReportPayload } from '@/lib/server/reports/demo';
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

function isTruthySearchParam(value: string | null): boolean {
  return value === '1' || value === 'true' || value === 'yes';
}

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const context = await getOrCreateOrganizationBusinessContext(userId);
    const query = parseReportQueryInput(
      context.businessId,
      Object.fromEntries(request.nextUrl.searchParams.entries())
    );
    const demoRequested = isTruthySearchParam(request.nextUrl.searchParams.get('demo'));
    const [payload, rows] = demoRequested
      ? (() => {
          const demoPayload = buildDemoReportPayload(query, context.organizationName);
          const demoRows = demoPayload.breakdown.rows.map((row) => ({
            id: row.id,
            name: row.name,
            level: row.level,
            status: row.status ?? '',
            primary_context: row.primaryContext ?? '',
            secondary_context: row.secondaryContext ?? '',
            spend: row.spend,
            reach: row.reach,
            impressions: row.impressions,
            clicks: row.clicks,
            link_clicks: row.linkClicks,
            leads: row.leads,
            messages: row.messages,
            conversion: row.conversion,
            conversion_rate: row.conversionRate,
            cost_per_result: row.costPerResult,
            ctr: row.ctr,
            cpc: row.cpc,
            cpm: row.cpm,
            frequency: row.frequency,
            start_date: row.startDate ?? '',
            end_date: row.endDate ?? '',
          }));

          return [demoPayload, demoRows] as const;
        })()
      : await Promise.all([buildReportPayload(query), buildReportCsvRows(query)]);

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
