/**
 * Types for Meta Ads API interactions
 * Standardized based on Meta's API documentation
 */

/**
 * Base parameters interface for all Meta API requests
 */
export interface MetaBaseParams {
    /** Meta Ads Account ID */
    adAccountId: string;
    /** Access token for Meta API authentication */
    accessToken: string;
    /** Form data submitted from the campaign builder */
    formData: CampaignFormValues;
    /** Whether this is an Optimized Campaign */
    isSmartCampaign: boolean;
}

/**
 * Campaign creation parameters
 */
export interface MetaCampaignParams extends MetaBaseParams {
    // Campaign-specific parameters
}

/**
 * Ad Set creation parameters
 */
export interface MetaAdSetParams extends MetaBaseParams {
    /** ID of the parent campaign */
    campaignId: string;
    /** Type of ad set for smart campaigns (broad, high-intent, control) */
    adSetType?: string;
}

/**
 * Creative creation parameters
 */
export interface MetaCreativeParams extends MetaBaseParams {
    /** ID of the page to associate with the creative */
    pageId: string;
    /** Creative variation number for smart campaigns */
    creativeVariation?: number;
}

/**
 * Ad creation parameters
 */
export interface MetaAdParams extends MetaBaseParams {
    /** ID of the ad set this ad belongs to */
    adsetId: string;
    /** ID of the creative to use for this ad */
    creativeId: string;
    /** Variation number for smart campaigns */
    adVariation?: number;
}

/**
 * Result of creating a campaign
 */
export interface SmartCampaignResult {
    /** Whether the campaign creation was successful */
    success: boolean;
    /** ID of the created campaign */
    campaignId: string;
    /** IDs of the created ad sets */
    adsetIds: string[];
    /** IDs of the created creatives */
    creativeIds: string[];
    /** IDs of the created ads */
    adIds: string[];
}

/**
 * Form values interface standardized to match Meta API parameters
 */
export interface CampaignFormValues {
    step: 'list' | 'adset' | 'creative';
    activeAdSetIdx: number | null;
    type: string; 
    adSetSubStep: 'adset' | 'creative';

    mode: string;
    platform: string;
    platformIntegrationId: string;

    campaign: {
        adAccountId: string;
        campaignName: string;
        objective: string;
        buying_type: string;
        special_ad_categories: string[];
        bid_strategy: string;
        destinationType: string;
        // Optionally add destination object if used
        // destination?: {
        //     form?: string;
        //     url?: string;
        // };
    };

    budget: {
        amount: number;
        type: string;
        optimization: boolean;
        bidstrategy: string;
        buying_type: string;
    };

    schedule: {
        startDate: Date;
        endDate: Date | null;
    };

    adSets: {
        adSetName: string;
        page_id: string;
        useAdvantageAudience: boolean;
        useAdvantagePlacements: boolean;
        billingEvent: string;
        optimization_goal: string;
        targeting: {
            location: {
                markerPosition: { lat: number; lng: number } | null;
                radius: number;
            };
            age: {
                min: number;
                max: number;
            };
            genders: string[];
            interests: string[];
            // Optionally add behaviors, languages, etc.
            // behaviors?: string[];
            // languages?: string[];
        };
        creatives: {
            contentSource: string;
            existingCreativeIds: string[];
            uploadedFiles: File[];
            imageHash: string;
            adHeadline: string;
            adPrimaryText: string;
            adDescription: string;
            adCallToAction: string;
        }[];
    }[];
}