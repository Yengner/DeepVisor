import type { SupabaseClient } from '@supabase/supabase-js';
import { asRecord } from '@/lib/shared';
import type { Database } from '@/lib/shared/types/supabase';
import type { ReportScope } from '@/lib/server/reports/types';

type IntelligenceClient = SupabaseClient<Database>;

type ReportArchiveRow = {
  id: string;
  title: string;
  scheduled_for: string | null;
  completed_at: string | null;
  payload_json: unknown;
  ad_accounts?: { name: string | null } | { name: string | null }[] | null;
};

export type ArchivedReport = {
  id: string;
  title: string;
  level: ReportScope | 'unknown';
  levelLabel: string;
  dateFrom: string | null;
  dateTo: string | null;
  generatedAt: string | null;
  reportHref: string | null;
  viewerHref: string;
  pdfHref: string | null;
  downloadHref: string | null;
  storagePath: string | null;
  fileName: string | null;
  adAccountName: string | null;
  summary: {
    spend: number | null;
    results: number | null;
    clicks: number | null;
    ctr: number | null;
    cpc: number | null;
    costPerResult: number | null;
  };
};

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function firstAdAccountName(value: ReportArchiveRow['ad_accounts']): string | null {
  if (Array.isArray(value)) {
    return value[0]?.name ?? null;
  }

  return value?.name ?? null;
}

function isReportScope(value: string | null): value is ReportScope {
  return (
    value === 'business' ||
    value === 'platform' ||
    value === 'ad_account' ||
    value === 'campaign' ||
    value === 'adset' ||
    value === 'ad'
  );
}

function fallbackLevelLabel(scope: ReportScope | 'unknown'): string {
  switch (scope) {
    case 'business':
      return 'Business';
    case 'platform':
      return 'Platform';
    case 'ad_account':
      return 'Ad account';
    case 'campaign':
      return 'Campaign';
    case 'adset':
      return 'Ad set';
    case 'ad':
      return 'Ad';
    default:
      return 'Report';
  }
}

function mapReportArchiveRow(row: ReportArchiveRow): ArchivedReport | null {
  const payload = asRecord(row.payload_json);
  const execution = asRecord(payload.execution);
  const action = asRecord(execution.action);

  if (action.type !== 'report_pdf') {
    return null;
  }

  const summary = asRecord(action.summary);
  const scopeValue = asString(action.scope);
  const level = isReportScope(scopeValue) ? scopeValue : 'unknown';
  const storedReportHref = asString(action.reportHref);
  const storagePath = asString(action.storagePath);
  const viewerHref = asString(action.viewerHref) ?? `/campaigns/reports/${row.id}`;
  const pdfHref = storagePath
    ? asString(action.pdfHref) ??
      (storedReportHref?.startsWith('/api/reports/archive/') ? storedReportHref : null) ??
      `/api/reports/archive/${row.id}/pdf`
    : null;
  const downloadHref = asString(action.downloadHref) ?? (pdfHref ? `${pdfHref}?download=1` : null);

  return {
    id: row.id,
    title: asString(action.title) ?? row.title,
    level,
    levelLabel: asString(action.levelLabel) ?? fallbackLevelLabel(level),
    dateFrom: asString(action.dateFrom),
    dateTo: asString(action.dateTo),
    generatedAt: asString(action.generatedAt) ?? row.completed_at,
    reportHref: viewerHref,
    viewerHref,
    pdfHref,
    downloadHref,
    storagePath,
    fileName: asString(action.fileName),
    adAccountName: firstAdAccountName(row.ad_accounts),
    summary: {
      spend: asNumber(summary.spend),
      results: asNumber(summary.results),
      clicks: asNumber(summary.clicks),
      ctr: asNumber(summary.ctr),
      cpc: asNumber(summary.cpc),
      costPerResult: asNumber(summary.costPerResult),
    },
  };
}

export async function listArchivedReports(
  supabase: IntelligenceClient,
  input: {
    businessId: string;
    limit?: number;
  }
): Promise<ArchivedReport[]> {
  const { data, error } = await (supabase as any)
    .from('calendar_queue_items')
    .select('id, title, scheduled_for, completed_at, payload_json, ad_accounts ( name )')
    .eq('business_id', input.businessId)
    .eq('item_type', 'review_report')
    .eq('status', 'completed')
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(input.limit ?? 50);

  if (error) {
    throw error;
  }

  return ((data ?? []) as ReportArchiveRow[])
    .map(mapReportArchiveRow)
    .filter((report): report is ArchivedReport => Boolean(report));
}

export async function getArchivedReport(
  supabase: IntelligenceClient,
  input: {
    businessId: string;
    queueItemId: string;
  }
): Promise<ArchivedReport | null> {
  const { data, error } = await (supabase as any)
    .from('calendar_queue_items')
    .select('id, title, scheduled_for, completed_at, payload_json, ad_accounts ( name )')
    .eq('id', input.queueItemId)
    .eq('business_id', input.businessId)
    .eq('item_type', 'review_report')
    .eq('status', 'completed')
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapReportArchiveRow(data as ReportArchiveRow) : null;
}
