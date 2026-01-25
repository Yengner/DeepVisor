/**
 * Store  integration data in Supabase
 */
export async function storeIntegration(
    supabase: any, // eslint-disable-line @typescript-eslint/no-explicit-any
    userId: string,
    accessToken: string,
    platformName: string
): Promise<string> {
    const date = new Date().toISOString();

    // Extract additional token details
    const integrationDetails = {
        access_token: accessToken,
        issued_at: date,
    };

    // Upsert into the platform_integration table
    const upsertData = {
        user_id: userId,
        platform_name: platformName,
        access_token: accessToken,
        is_integrated: true,
        integration_details: integrationDetails,
        created_at: date,
        updated_at: date,
    };

    const { data, error } = await supabase
        .from('platform_integrations')
        .upsert(upsertData)
        .select('id')
        .single();

    if (error || !data) {
        throw new Error('Failed to save platform integration');
    }

    return data.id;
}
