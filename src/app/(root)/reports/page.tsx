import { Suspense } from 'react';
import { EmptyCampaignState } from '@/components/campaigns/EmptyStates';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import { parseReportQueryInput } from '@/lib/server/reports/query';
import { buildReportPayload, getReportFilterOptions } from '@/lib/server/repositories/reports/buildReportPayload';
import { ReportsClient } from './components/ReportsClient';
import ReportsClientFallback from './components/ReportClientFallback';

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { businessId } = await getRequiredAppContext();
  const params = await searchParams;
  const query = parseReportQueryInput(businessId, params);
  const [payload, filterOptions] = await Promise.all([
    buildReportPayload(query),
    getReportFilterOptions(query),
  ]);

  const hasData =
    payload.series.length > 0 ||
    payload.breakdown.rows.length > 0 ||
    payload.summary.spend > 0 ||
    payload.summary.impressions > 0;

  if (!hasData && filterOptions.adAccounts.length === 0) {
    return <EmptyCampaignState type="platform" />;
  }
  return (
    <Suspense fallback={<ReportsClientFallback />}>
      <ReportsClient payload={payload} filterOptions={filterOptions} />
    </Suspense>
  );
}
