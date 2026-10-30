import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/shared/types/supabase';
import { businessObjectives } from './objectives';

export async function loadBusinessObjectives(client: SupabaseClient<Database>, businessId: string) {
  const { data, error } = await client.from('business_profiles')
    .select('primary_goal,monthly_budget,target_cost_per_lead,lead_type,industry,safety_preference,recommendation_style')
    .eq('id', businessId).single();
  if (error || !data) throw new Error('BUSINESS_OBJECTIVES_UNAVAILABLE');
  return businessObjectives(data);
}
