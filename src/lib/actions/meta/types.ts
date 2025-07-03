/**
 * Types for Meta Ads API interactions
 */

/**
 * Base campaign parameters interface
 * Contains common fields used across all Meta API requests
 */
export interface MetaBaseParams {
    /** Meta Ads Account ID */
    adAccountId: string;
    /** Access token for Meta API authentication */
    accessToken: string;
    /** Form data submitted from the campaign builder */
    formData: CampaignFormValues;
    /** Whether this is an AI-powered Smart Campaign */
    isSmartCampaign?: boolean;
}

/**
 * Campaign creation parameters
 */
export interface MetaCampaignParams extends MetaBaseParams {
    // Any campaign-specific parameters can be added here
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
 * Result of creating a smart campaign
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
 * Comprehensive interface for campaign form values
 * Represents all possible form fields in the campaign creation form
 */
export interface CampaignFormValues {
    // Campaign basics
    /** Platform for the campaign (e.g., 'meta', 'google') */
    platform: string;
    /** User-defined name for the campaign */
    campaignName: string;
    /** ID of the Facebook page to use */
    page_id: string;
    /** ID of the Ad Account to use */
    adAccountId: string;
    /** Type of buying (e.g., 'AUCTION', 'RESERVED') */
    buying_type: string;
    /** Whether to enable A/B testing */
    ab_testing: boolean;
    /** Campaign objective (e.g., 'REACH', 'TRAFFIC', 'LEAD_GENERATION') */
    objective: string;
    /** Campaign type ('AI Auto' for smart campaigns) */
    type?: string;

    // Budget and schedule
    /** Budget amount (in currency units) */
    budget: number;
    /** Budget type ('daily' or 'lifetime') */
    budgetType: string;
    /** Campaign start date */
    startDate: Date | null;
    /** Campaign end date (null for no end date) */
    endDate: Date | null;

    // Location targeting
    /** Location targeting parameters */
    location: {
        /** Geographic position for targeting */
        markerPosition: { lat: number; lng: number } | null;
        /** Radius around the position (in km) */
        radius: number;
    };

    // Audience targeting
    /** Minimum age for audience targeting */
    ageMin: number | string;
    /** Maximum age for audience targeting */
    ageMax: number | string;
    /** Gender targeting options */
    genders: string[];
    /** Language targeting options */
    languages: string[];
    /** Interest-based targeting */
    interests: string[];
    /** Behavior-based targeting */
    behaviors: string[];

    // Creative assets
    /** Source of creative content ('upload', 'existing', or 'auto') */
    contentSource: 'upload' | 'existing' | 'auto';
    /** IDs of existing posts to use */
    existingPostIds: string[];
    /** Uploaded files for creatives */
    uploadedFiles: File[];
    /** Ad headline */
    adHeadline: string;
    /** Ad primary text */
    adPrimaryText: string;
    /** Ad description */
    adDescription: string;
    /** Call to action button text */
    adCallToAction: string;
    /** Destination type for the ad */
    adDestinationType: string;
    /** Website URL for ads with website destination */
    adDestinationUrl: string;
    /** Phone number for call ads */
    adDestinationPhone: string;
    /** Form ID for lead form ads */
    adDestinationForm: string;

    // Campaign optimization
    /** Optimization goal (e.g., 'REACH', 'LINK_CLICKS') */
    optimization_goal?: string;
    /** Optimization goal (alternative field name) */
    optimization?: string;
    /** Destination type (e.g., 'WEBSITE', 'FORM') */
    destination_type?: string;
    /** Destination type (alternative field name) */
    destinationType?: string;
    /** Whether to enable campaign budget optimization */
    campaign_budget_optimization: boolean;
    /** Bidding strategy (e.g., 'LOWEST_COST_WITHOUT_CAP') */
    bidStrategy: string;
    /** Billing event (e.g., 'IMPRESSIONS', 'LINK_CLICKS') */
    billingEvent: string;
    /** Platform placement types */
    placementTypes: string[];

    // Ad content (alternative field names)
    /** Ad headline (alternative field name) */
    headline: string;
    /** Ad primary text (alternative field name) */
    primaryText: string;
    /** Ad description (alternative field name) */
    description: string;
    /** Call to action (alternative field name) */
    callToAction: string;

    // Tracking and measurement
    /** Tracking pixel ID */
    trackingPixel: string;
    /** Custom URL parameters */
    customParameters: string;

    // Ad set configuration
    /** Name for the ad set */
    adSetName: string;
    /** Whether to use Advantage audience */
    useAdvantageAudience: boolean;
    /** Whether to use a saved audience */
    useSavedAudience: boolean;
    /** ID of the saved audience to use */
    savedAudienceId: string;
    /** Whether to use Advantage placements */
    useAdvantagePlacements: boolean;
}