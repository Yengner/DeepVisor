import { Suspense } from 'react';
import { EmptyCampaignState } from '@/components/campaigns/EmptyStates';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import { buildDemoReportPayload, getDemoReportFilterOptions } from '@/lib/server/reports/demo';
import { parseReportQueryInput } from '@/lib/server/reports/query';
import { buildReportPayload, getReportFilterOptions } from '@/lib/server/repositories/reports/buildReportPayload';
import { ReportsClient } from './components/ReportsClient';
import ReportsClientFallback from './components/ReportClientFallback';

function isTruthySearchParam(value: string | string[] | undefined): boolean {
  if (!value) {
    return false;
  }

  const raw = Array.isArray(value) ? value[0] : value;
  return raw === '1' || raw === 'true' || raw === 'yes';
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { businessId, organizationName } = await getRequiredAppContext();
  const params = await searchParams;
  const query = parseReportQueryInput(businessId, params);
  const demoRequested = isTruthySearchParam(params.demo);

  const liveResult = demoRequested
    ? null
    : await Promise.all([buildReportPayload(query), getReportFilterOptions(query)]);

  const livePayload = liveResult?.[0] ?? null;
  const liveFilterOptions = liveResult?.[1] ?? null;

  const hasData =
    (livePayload?.series.length ?? 0) > 0 ||
    (livePayload?.breakdown.rows.length ?? 0) > 0 ||
    (livePayload?.summary.spend ?? 0) > 0 ||
    (livePayload?.summary.impressions ?? 0) > 0;

  const shouldUseDemo =
    demoRequested || (!hasData && (liveFilterOptions?.adAccounts.length ?? 0) === 0);

  const payload = shouldUseDemo
    ? buildDemoReportPayload(query, organizationName)
    : livePayload;
  const filterOptions = shouldUseDemo ? getDemoReportFilterOptions() : liveFilterOptions;

  if (!payload || !filterOptions) {
    return <EmptyCampaignState type="platform" />;
  }

  if (!shouldUseDemo && !hasData && filterOptions.adAccounts.length === 0) {
    return <EmptyCampaignState type="platform" />;
  }

  return (
    <Suspense fallback={<ReportsClientFallback />}>
      <ReportsClient payload={payload} filterOptions={filterOptions} isDemo={shouldUseDemo} />
    </Suspense>
  );
}
