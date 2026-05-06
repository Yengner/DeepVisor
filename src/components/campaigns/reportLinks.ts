import { buildReportUrl, type ReportUrlScope } from '@/lib/shared';

type BuildEntityReportUrlInput = {
  scope: Extract<ReportUrlScope, 'campaign' | 'adset' | 'ad'>;
  platformIntegrationId?: string | null;
  adAccountId?: string | null;
  campaignId?: string | null;
  adsetId?: string | null;
  adId?: string | null;
  startDate?: string | null;
  endDate?: string | null;
};

function toIsoDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeReportDate(value?: string | null): string | null {
  const trimmed = value?.trim();

  if (!trimmed || trimmed === 'No End Date' || trimmed === 'Ongoing' || trimmed === '—') {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : toIsoDate(parsed);
}

export function buildEntityReportUrl(input: BuildEntityReportUrlInput): string {
  const dateFrom = normalizeReportDate(input.startDate);
  const dateTo = normalizeReportDate(input.endDate) ?? toIsoDate(new Date());

  return buildReportUrl({
    scope: input.scope,
    platformIntegrationId: input.platformIntegrationId,
    adAccountIds: input.adAccountId ? [input.adAccountId] : [],
    campaignIds: input.campaignId ? [input.campaignId] : [],
    adsetIds: input.adsetId ? [input.adsetId] : [],
    adIds: input.adId ? [input.adId] : [],
    dateFrom,
    dateTo,
    compareMode: 'none',
  });
}
