import { createSupabaseClient } from "@/lib/utils/supabase/clients/server";
import { NotificationCreateProps } from "../types";

/**
 * Creates a notification for a user | Not really used in the app yet maybe for future admin use
 * @param userId The ID of the user to notify
 * @param title The title of the notification
 * @param message The message content of the notification
 * @param type The type of notification (e.g., 'campaign', 'budget', etc.)
 * @param link Optional link associated with the notification
 * @param metadata Optional additional metadata for the notification
 * @return The created notification data
 */
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


