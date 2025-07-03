'use client';

import { useSearchParams } from 'next/navigation';
import { Container, Paper, Title, Text } from '@mantine/core';
import SmartCampaignFlow from '@/components/campaigns/create/smart/SmartCampaignFlow';
import CustomCampaignFlow from '@/components/campaigns/create/manual/CustomCampaignFlow';

export default function CreateCampaignPage() {
    const searchParams = useSearchParams();
    const mode = searchParams.get('mode') || 'smart';

    return (
        <>
                {mode === 'smart' ? (
                    <SmartCampaignFlow />
                ) : (
                    <CustomCampaignFlow />
                )}
        </>
    );
}