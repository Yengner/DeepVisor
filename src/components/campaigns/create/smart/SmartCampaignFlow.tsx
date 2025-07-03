'use client';

import { useState } from 'react';
import PlatformSelector from '../common/PlatformSelector';
import SmartMetaCampaignBuilder from './MetaCampaignBuilder';

export default function SmartCampaignFlow() {
    const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);

    if (!selectedPlatform) {
        return (
            <PlatformSelector
                campaignType="smart"
                onSelectPlatform={setSelectedPlatform}
                availablePlatforms={[
                    { id: 'meta', available: true },
                    // Only enable platforms that work with Smart mode
                ]}
            />
        );
    }

    // Render the appropriate smart builder
    switch (selectedPlatform) {
        case 'meta':
            return <SmartMetaCampaignBuilder onBack={() => setSelectedPlatform(null)} />;
        default:
            return null;
    }
}