import 'server-only';
import { createAdminClient } from '@/lib/server/supabase/admin';
import { readAllPages } from '@/lib/server/repositories/pagination';
import { accountToday, shiftReportDay } from '@/lib/shared/reports/dates';
import { lifecycleOutcome, OUTCOME_WINDOW, type LifecycleOutcome, type OutcomeDay } from '@/lib/shared/lifecycle/outcome';

/**
 * Live before/after for one lifecycle event, scoped to the business and selected ad account.
 * Reads saved daily ad rows only (no Meta calls). Per-day values are null when any row that day
 * is unavailable or in another currency, so they stay gaps rather than zeros.
 */
export async function loadLifecycleOutcome(business: string, account: string, eventId: string): Promise<(LifecycleOutcome & { currency: string | null; timezone: string | null }) | null> {
  const db = createAdminClient();
  const [event, acct] = await Promise.all([
    db.from('ad_lifecycle_events').select('affected_ids,created_at').eq('business_id', business).eq('ad_account_id', account).eq('id', eventId).maybeSingle(),
    db.from('ad_accounts').select('timezone,currency_code').eq('business_id', business).eq('id', account).single(),
  ]);
  if (event.error) throw event.error;
  if (acct.error) throw acct.error;
  if (!event.data) return null;
  const timezone = acct.data.timezone, currency = acct.data.currency_code;
  const changeDay = accountToday(timezone, new Date(event.data.created_at)), today = accountToday(timezone);
  if (!changeDay || !today) throw new Error('Account timezone unavailable');
  const from = shiftReportDay(changeDay, -OUTCOME_WINDOW), to = shiftReportDay(changeDay, OUTCOME_WINDOW);
  const ids = event.data.affected_ids;
  const rows = ids.length ? await readAllPages((a, b) => db.from('report_entity_daily_v').select('entity_external_id,day,spend,leads,messages,calls,currency_code')
    .eq('business_id', business).eq('ad_account_id', account).eq('entity_level', 'ad').in('entity_external_id', ids)
    .gte('day', from).lte('day', to).order('day').order('entity_external_id').range(a, b), { nullDataError: 'Lifecycle performance unavailable' }) : [];
  // Account days with any saved records: evidence that a sync covered the day.
  const syncedRows = await readAllPages((a, b) => db.from('report_entity_daily_v').select('day')
    .eq('business_id', business).eq('ad_account_id', account).eq('entity_level', 'adset')
    .gt('day', changeDay).lte('day', to).order('day').range(a, b), { nullDataError: 'Sync coverage unavailable' });
  const byDay = new Map<string, typeof rows>();
  for (const r of rows) if (r.day) byDay.set(r.day, [...(byDay.get(r.day) ?? []), r]);
  const sum = (values: Array<number | null>) => values.every(v => v !== null && Number.isFinite(v)) ? values.reduce<number>((s, v) => s + v!, 0) : null;
  const days: OutcomeDay[] = [...byDay].map(([day, group]) => {
    const valid = Boolean(currency) && group.every(r => r.currency_code === currency);
    return {
      day,
      spend: valid ? sum(group.map(r => r.spend)) : null,
      results: valid ? sum(group.map(r => r.leads === null || r.messages === null || r.calls === null ? null : r.leads + r.messages + r.calls)) : null,
    };
  });
  const synced = [...new Set(syncedRows.map(r => r.day).filter((d): d is string => Boolean(d)))];
  return { ...lifecycleOutcome(days, changeDay, today, synced), currency, timezone };
}
