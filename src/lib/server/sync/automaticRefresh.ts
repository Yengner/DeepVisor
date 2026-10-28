import 'server-only';
import { createAdminClient } from '@/lib/server/supabase/admin';
import { asRecord } from '@/lib/shared';
import { assertSimulationEnabled } from '@/lib/server/integrations/simulation/meta';

export const AUTO_SYNC_STALE_MINUTES = 90;
export const AUTO_SYNC_LOOKBACK_DAYS = 7;
export type AutomaticSyncResult = {
  status: 'queued' | 'running' | 'skipped';
  reason: string;
  jobId?: string;
  lastSuccessfulAt?: string | null;
};

/** All freshness/day/retry/duplicate checks are atomic in the existing database queue. */
export async function enqueueAutomaticAccountSync(input: {
  businessId: string; integrationId: string; adAccountId: string;
  source: 'app_visit' | 'scheduled_refresh'; staleAfterMinutes?: number; lookbackDays?: number;
  allowSimulation?: boolean;
}): Promise<AutomaticSyncResult> {
  if (input.allowSimulation) assertSimulationEnabled();
  const { data, error } = await createAdminClient().rpc('enqueue_automatic_account_sync', {
    p_business: input.businessId, p_integration: input.integrationId, p_account: input.adAccountId,
    p_source: input.source, p_stale_minutes: input.staleAfterMinutes ?? AUTO_SYNC_STALE_MINUTES,
    p_lookback_days: input.lookbackDays ?? AUTO_SYNC_LOOKBACK_DAYS,
    p_allow_simulation: input.allowSimulation ?? false,
  });
  if (error) throw error;
  const row = asRecord(data);
  if (!['queued','running','skipped'].includes(String(row.status))) throw new Error('Invalid automatic sync result');
  return row as AutomaticSyncResult;
}

export function targetedSimulationAllowed() {
  try { assertSimulationEnabled(); return true; } catch { return false; }
}
