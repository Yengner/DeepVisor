import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/shared/types/supabase';
import { allPages, readPagesByIds } from '@/lib/server/repositories/pagination';
import {
  bookingSummary,
  checkinToAsk,
  completedWeeks,
  isAnswerableWeek,
  weekEnd,
  weekTotals,
  type BookingSummary,
  type CheckinAnswer,
  type WeekTotals,
} from '@/lib/shared/bookings/checkin';

/**
 * Weekly booking check-ins (public.booking_checkins). Callers pass an authorized business and an
 * ad account already validated to belong to it; every query filters by both.
 */
type Client = SupabaseClient<Database>;
export const SUMMARY_WEEKS = 4;

export class CheckinError extends Error {
  constructor(readonly code: 'INVALID_WEEK' | 'INVALID_COUNT') { super(code); }
}

export async function listCheckins(client: Client, input: { businessId: string; adAccountId: string; since: string }): Promise<CheckinAnswer[]> {
  const { data, error } = await client.from('booking_checkins')
    .select('week_start, bookings, skipped')
    .eq('business_id', input.businessId).eq('ad_account_id', input.adAccountId).gte('week_start', input.since);
  if (error) throw error;
  return (data ?? []).map(r => ({ weekStart: r.week_start, bookings: r.bookings, skipped: r.skipped }));
}

/** Saves or corrects one week's answer: a count, or `null` for "not sure". */
export async function saveCheckin(client: Client, input: { businessId: string; adAccountId: string; userId: string; weekStart: string; bookings: number | null; today: string }) {
  if (!isAnswerableWeek(input.weekStart, input.today)) throw new CheckinError('INVALID_WEEK');
  if (input.bookings !== null && (!Number.isInteger(input.bookings) || input.bookings < 0 || input.bookings > 10_000)) throw new CheckinError('INVALID_COUNT');
  const { error } = await client.from('booking_checkins').upsert({
    business_id: input.businessId,
    ad_account_id: input.adAccountId,
    week_start: input.weekStart,
    bookings: input.bookings,
    skipped: input.bookings === null,
    answered_at: new Date().toISOString(),
    answered_by: input.userId,
  }, { onConflict: 'ad_account_id,week_start' });
  if (error) throw error;
}

export type CheckinView = { ask: WeekTotals | null; summary: BookingSummary; weeks: WeekTotals[] };

/** What to ask this week and the owner-reported summary for the last completed weeks. */
export async function loadCheckins(client: Client, input: { businessId: string; adAccountId: string; today: string }): Promise<CheckinView> {
  const weeks = completedWeeks(input.today, SUMMARY_WEEKS);
  const since = weeks[weeks.length - 1];
  const entities = await allPages((from, to) => client.from('ad_entities')
    .select('id, raw').eq('business_id', input.businessId).eq('ad_account_id', input.adAccountId)
    .eq('entity_level', 'adset').order('id').range(from, to));
  const destination = new Map(entities.map(e => {
    const raw = e.raw && typeof e.raw === 'object' ? e.raw as Record<string, unknown> : {};
    return [e.id, typeof raw.destination_type === 'string' ? raw.destination_type : null] as const;
  }));
  const [rows, answers] = await Promise.all([
    readPagesByIds(entities.map(e => e.id), (ids, from, to) => client.from('ad_entity_performance_daily')
      .select('entity_id, day, spend, leads, messages, calls')
      .eq('ad_account_id', input.adAccountId).eq('entity_level', 'adset').in('entity_id', ids)
      .gte('day', since).lte('day', weekEnd(weeks[0]))
      .order('entity_id').order('day').range(from, to)),
    listCheckins(client, { ...input, since }),
  ]);
  const weekRows = rows.map(r => ({ ...r, destinationType: destination.get(r.entity_id) }));
  const totals = weeks.map(w => weekTotals(weekRows, w));
  return { ask: checkinToAsk({ today: input.today, answers, totals: totals[0] }), summary: bookingSummary(totals, answers), weeks: totals };
}
