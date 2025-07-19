import { createSupabaseClient } from "@/lib/utils/supabase/clients/server";
import { formatRelativeTime } from "../utils";

export async function getNotifications(userId: string) {
    try {
        const supabase = await createSupabaseClient();
        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .order('created_at', { ascending: false })
            .eq('user_id', userId);

        if (error) {
            console.error('Error fetching notifications:', error);
            throw error;
        }

        const notifications = (data || []).map((notification: any) => ({
            ...notification,
            created_at: formatRelativeTime(notification.created_at),
        }));

        return notifications;
    } catch (error) {
        console.error('Unexpected error while fetching notifications:', error);
        return [];
    }
}