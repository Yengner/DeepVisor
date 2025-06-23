import { createClient } from '@/lib/utils/supabase/clients/browser';

// Format relative time for notification timestamps
export function formatRelativeTime(dateString: string) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
}

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