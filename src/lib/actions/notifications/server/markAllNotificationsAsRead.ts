import { createSupabaseClient } from "@/lib/utils/supabase/clients/server";

export async function markAllNotificationsAsRead(userId: string) {
    try {
        const supabase = await createSupabaseClient();

        const { error } = await supabase
            .from('notifications')
            .update({ read: true })
            .eq('user_id', userId)
            .eq('read', false);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        throw error;
    }
}