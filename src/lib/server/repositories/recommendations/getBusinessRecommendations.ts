import 'server-only'
import { createSupabaseClient } from '../../supabase/server'

export async function getBusinessRecommendations(userId: string) {
    const supabase = await createSupabaseClient();

    const { data, error } = await supabase
        .from('recomendations')
        .select('recommendations')
        .eq('user_id', userId)
        .single();

    if (error) {
        console.error('Error getting recommendations: ', error)
        return [];
    }

    return data.recommendations || [];
}

