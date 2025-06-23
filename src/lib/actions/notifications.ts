import { createSupabaseClient } from "../utils/supabase/clients/server";

// High-key kinda random until i have most of this website done
export type NotificationType = 'campaign' | 'budget' | 'system' | 'integration';

interface NotificationCreateProps {
    userId: string;
    title: string;
    message: string;
    type: NotificationType;
    link?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadata?: Record<string, any>;
}

// Create a new notification
export async function createNotification({
    userId,
    title,
    message,
    type,
    link,
    metadata = {}
}: NotificationCreateProps) {
    try {
        const supabase = await createSupabaseClient();

        const { data, error } = await supabase
            .from('notifications')
            .insert({
                user_id: userId,
                title,
                message,
                type,
                link,
                metadata
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error creating notification:', error);
        throw error;
    }
}

// Mark a single notification as read
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

// Mark all notifications as read for a user
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

// Get notifications for a user
export async function getUserNotifications(userId: string, limit = 10) {
    try {
        const supabase = await createSupabaseClient();

        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error fetching notifications:', error);
        return [];
    }
}