import 'server-only';
import { createAdminClient } from '../../supabase/admin';

/** Bounded, database-only work. Measurement failure must never fail Meta sync. */
export async function processActionOutcomes(): Promise<void> {
  try {
    const { data, error } = await createAdminClient().schema('ai')
      .rpc('process_action_outcomes', { p_limit: 100 })
      .abortSignal(AbortSignal.timeout(15000));
    if (error) throw error;
    console.info(JSON.stringify({ event: 'outcomes.processed', result: data }));
  } catch {
    console.error(JSON.stringify({ event: 'outcomes.failed', code: 'OUTCOME_MEASUREMENT_FAILED' }));
  }
}
