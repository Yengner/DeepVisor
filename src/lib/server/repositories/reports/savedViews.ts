import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/shared/types/supabase';
import { MAX_VIEWS_PER_BUSINESS } from '@/lib/shared/reports/savedViews';

export interface ReportSavedView { id: string; name: string; query: string; createdAt: string; isMine: boolean }
type Client = SupabaseClient<Database>;

export async function listReportSavedViews(supabase: Client, input: { businessId: string; userId: string }): Promise<ReportSavedView[]> {
  const { data, error } = await supabase.from('report_saved_views')
    .select('id, name, query, created_at, created_by')
    .eq('business_id', input.businessId)
    .order('created_at', { ascending: false })
    .limit(MAX_VIEWS_PER_BUSINESS);
  if (error) throw error;
  return (data ?? []).map(row => ({ id: row.id, name: row.name, query: row.query, createdAt: row.created_at, isMine: row.created_by === input.userId }));
}

export async function createReportSavedView(supabase: Client, input: { businessId: string; userId: string; name: string; query: string }): Promise<ReportSavedView> {
  const { count, error: countError } = await supabase.from('report_saved_views')
    .select('id', { count: 'exact', head: true }).eq('business_id', input.businessId);
  if (countError) throw countError;
  if ((count ?? 0) >= MAX_VIEWS_PER_BUSINESS) throw new Error(`A business can keep up to ${MAX_VIEWS_PER_BUSINESS} saved views. Delete one first.`);
  const { data, error } = await supabase.from('report_saved_views')
    .insert({ business_id: input.businessId, created_by: input.userId, name: input.name, query: input.query })
    .select('id, name, query, created_at').single();
  if (error) throw error;
  return { id: data.id, name: data.name, query: data.query, createdAt: data.created_at, isMine: true };
}

/** Only the creator can delete a view, and only within the current business. Returns false when nothing matched. */
export async function deleteReportSavedView(supabase: Client, input: { businessId: string; userId: string; id: string }): Promise<boolean> {
  const { data, error } = await supabase.from('report_saved_views').delete()
    .eq('id', input.id).eq('business_id', input.businessId).eq('created_by', input.userId).select('id');
  if (error) throw error;
  return (data ?? []).length > 0;
}
