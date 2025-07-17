/**
 * Trigger sync of user ad data after successful Meta integration
 */
export async function triggerMetaCampaignSync(userId: string) {
    try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/sync_user_ad_data`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
            },
            body: JSON.stringify({ userId })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('Error triggering ad data sync:', response.status, errorData);
            return false;
        }

        return true;
    } catch (error) {
        console.error('Failed to trigger ad data sync:', error);
        return false;
    }
}