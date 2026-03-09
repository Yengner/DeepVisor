import 'server-only';

import { createSupabaseClient } from '@/lib/server/supabase/server';

export async function getBusinessRecommendations(userId: string) {
  const supabase = await createSupabaseClient();

  const { data, error } = await supabase
    .from('recommendations')
    .select('recommendations')
    .eq('user_id', userId)
    .single();

  if (error) {
    console.error('Error getting recommendations:', error);
    return [];
  }

  return data.recommendations || [];
}
