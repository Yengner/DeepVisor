'use client';

import { useState } from 'react';

import PlatformSelector from '../../platforms/meta/components/PlatformSelector';
import ManualMetaCampaignBuilder from '../../platforms/meta/builders/ManualMetaCampaignBuilder';

interface CustomCampaignFlowProps {
    platformData: {
        id: string;
        platform_name: string;
    }
    adAccountId: string;
}

/**
 * 
 * @param { platformData, adAccountId }
 */

export default function ManualCampaignFlow({ platformData, adAccountId }: CustomCampaignFlowProps) {
    // Initialize with platformName if provided, otherwise null
    const [selectedPlatform, setSelectedPlatform] = useState<string | null>(
        platformData.platform_name ? platformData.platform_name.toLowerCase() : null
    );

    if (!selectedPlatform) {
        return (
            <PlatformSelector
                campaignType="manual"
                onSelectPlatform={setSelectedPlatform}
            />
        );
    }

    // Render the appropriate builder based on platform
    switch (selectedPlatform) {
        case 'meta':
            return <ManualMetaCampaignBuilder
                platformData={platformData}
                adAccountId={adAccountId}
                onBack={() => setSelectedPlatform(null)}
            />;
        default:
            return null;
    }
}