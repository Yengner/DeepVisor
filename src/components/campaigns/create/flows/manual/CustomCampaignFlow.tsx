'use client';

import { useState } from 'react';

import PlatformSelector from '../common/PlatformSelector';
import MetaCampaignBuilder from './MetaCampaignBuilder';

// Dynamically import platform-specific components if needed
// const GoogleCampaignBuilder = dynamic(...)

export default function CustomCampaignFlow() {
    const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);

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
            return <MetaCampaignBuilder onBack={() => setSelectedPlatform(null)} />;
        default:
            return null;
    }
}