import { createSupabaseClient } from "@/lib/utils/supabase/clients/server";

export async function markNotificationRead(notificationId: string) {
    try {
        const supabase = await createSupabaseClient();

        const { error } = await supabase
            .from('notifications')
            .update({ read: true })
            .eq('id', notificationId);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Error marking notification as read:', error);
        throw error;
    }
}