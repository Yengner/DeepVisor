import { createClient } from "@/lib/utils/supabase/clients/browser";

// Client-side mark all as read
export async function markAllNotificationsAsReadClient(notificationIds: string[]) {
    try {
        if (notificationIds.length === 0) return true;

        const supabase = createClient();

        const { error } = await supabase
            .from('notifications')
            .update({ read: true })
            .in('id', notificationIds);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        return false;
    }
}