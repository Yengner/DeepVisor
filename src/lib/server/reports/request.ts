import 'server-only';
import { resolveCurrentSelection } from '@/lib/server/actions/app/selection';
import { parseReportQueryInput } from './query';

/** Shared by the page and both export endpoints. Authorization remains in the repository. */
export async function resolveReportRequest(businessId: string, params: Record<string, string | string[] | undefined>) {
  const query = parseReportQueryInput(businessId, params);
  const demo = ['1', 'true', 'yes'].includes(String(params.demo ?? ''));
  const explicitScope = ['scope', 'platform_integration_id', 'ad_account_id', 'campaign_id', 'adset_id', 'ad_id']
    .some(key => Boolean(params[key]));
  if (!demo && !explicitScope) {
    const selected = await resolveCurrentSelection(businessId);
    if (selected.selectedAdAccountId) {
      query.adAccountIds = [selected.selectedAdAccountId];
      query.platformIntegrationId = selected.selectedPlatformId;
      query.scope = 'ad_account';
    }
  }
  return query;
}
