import type { NotificationFeedItem } from '@/lib/shared';
import {
    listNotifications,
    listUnreadNotificationIds,
} from '@/lib/server/intelligence/repositories/notifications';
import { createSupabaseClient } from "../../supabase/server";

/**
 * 
 * @param userId The ID of the user to fetch notifications for
 * @param limit The maximum number of notifications to fetch
 * @returns An array of notifications for the user
 */
export async function getUserNotifications(userId: string, limit = 10): Promise<NotificationFeedItem[]> {
    try {
        const supabase = await createSupabaseClient();
        return await listNotifications(supabase as any, {
            userId,
            limit,
        });
    } catch (error) {
        console.error('Failed to load user notifications:', error);
        return [];
    }
}

export async function getUnreadUserNotificationIds(userId: string): Promise<string[]> {
    try {
        const supabase = await createSupabaseClient();
        return await listUnreadNotificationIds(supabase as any, { userId });
    } catch (error) {
        console.error('Failed to load unread notification ids:', error);
        return [];
    }
}
