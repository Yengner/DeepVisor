import 'server-only';
import type { AssistantAccess } from './access';
import { analyticsArguments, analyticsRange } from './analyticsModel';
import { resourceRefreshEnabled, requestResource, requestRecentPerformance, SUPPORTED_SNAPSHOT_BREAKDOWNS, type SnapshotBreakdown } from '@/lib/server/sync/resources/coordinator';
import { targetedSimulationAllowed } from '@/lib/server/sync/automaticRefresh';
import { dispatchAccountSync } from '@/lib/server/sync/dispatch';
/** Tool demand is deterministic, scoped and bounded. The current answer still reads published data. */
export async function requestAssistantFreshness(name: string, raw: unknown, scope: AssistantAccess) {
  if (!resourceRefreshEnabled() || !['getAccountPerformance', 'getPerformanceRankings', 'getPerformanceBreakdown'].includes(name)) return null;
  const args = analyticsArguments.parse(raw);
  const range = analyticsRange(args, scope.account.timezone, new Date());
  const target = { businessId: scope.businessId, integrationId: scope.integration.id, adAccountId: scope.account.id, allowSimulation: targetedSimulationAllowed() };
  try {
    const result = name === 'getPerformanceBreakdown' && SUPPORTED_SNAPSHOT_BREAKDOWNS.includes(args.dimension as SnapshotBreakdown)
      ? await requestResource(target, 'audience', { since: range.dateFrom, until: range.dateTo, breakdown: args.dimension as SnapshotBreakdown, source: 'assistant' })
      : name === 'getPerformanceBreakdown' ? null : await requestRecentPerformance(target, 'app_visit');
    if (result?.status === 'queued' && result.jobId) dispatchAccountSync(result.jobId, scope.businessId);
    return result ? { status: result.status, reason: result.reason, limitation: 'Background request only. Use saved evidence dates for this answer; no new measurements are promised.' } : null;
  } catch { return { status: 'unavailable', limitation: 'Background refresh unavailable. Use the saved coverage; do not claim current data.' }; }
}
