import { createClient } from "@/lib/client/supabase/browser";

// Client-side notification marking
export async function markNotificationReadClient(notificationId: string) {
    try {
        const supabase = createClient();

        const { error } = await supabase
            .from('notifications')
            .update({ read: true })
            .eq('id', notificationId);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Error marking notification as read:', error);
        return false;
    }
}