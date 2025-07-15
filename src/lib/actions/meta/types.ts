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

    // For internal use - platform details
    /** Campaign type ('AI Auto' for smart/optimized campaigns) */
    type?: string;
    /** Platform for the campaign (e.g., 'meta', 'google') */
    platform?: string;
    /** ID of the Ad Account to use */
    adAccountId: string;
    /** ID of the platform integration (e.g., Meta integration ID) */
    platformIntegrationId: string;

    // Campaign basics
    /** User-defined name for the campaign */
    campaignName: string;
    /** Campaign objective (using OUTCOME_* format for newer API) */
    objective: string;
    /** Type of buying (e.g., 'AUCTION', 'RESERVED') */
    buying_type: string;
    /** Special ad categories */
    special_ad_categories?: string[];
    /** Bid strategy for the campaign */
    bid_strategy?: string;
    /** Destination type (e.g., 'WEBSITE', 'ON_AD' for lead gen forms) */
    destinationType: string;


    // Budget and schedule
    /** Budget amount (in currency units) */
    budget: number;
    /** Budget type ('daily' or 'lifetime') */
    budgetType: string;
    /** Campaign start date */
    startDate: Date | null;
    /** Campaign end date (null for no end date) */
    endDate: Date | null;
    /** Bidding strategy */
    bidStrategy: string;
    /** Campaign budget optimization */
    campaign_budget_optimization: boolean;

    // Ad Set level parameters
    /** Name of the ad set */
    adSetName?: string;
    /** ID of the Facebook Page to use for the ad set */
    page_id: string;
    /** Whether to use Advantage+ audience targeting */
    useAdvantageAudience: boolean;
    /** Whether to use saved audience targeting */
    useAdvantagePlacements: boolean;
    /** Billing event (e.g., 'IMPRESSIONS', 'LINK_CLICKS') */
    billingEvent?: string;
    /** Optimization goal */
    optimization_goal?: string;
    /** Location targeting parameters */
    location?: {
        markerPosition?: { lat: number; lng: number } | null;
        radius?: number;
    };
    /** Minimum age for audience targeting */
    ageMin?: number | string;
    /** Maximum age for audience targeting */
    ageMax?: number | string;
    /** Gender targeting options */
    genders?: string[];
    /** Interest-based targeting */
    interests?: any[];

    // Creative content
    /** Source of creative content ('upload', 'existing', 'auto') */
    contentSource?: 'upload' | 'existing' | 'auto';
    /** Uploaded files for creatives */
    uploadedFiles?: any[];

    /** Existing Creatives Object */
    existingCreatives: string[];
    /** Selected creative ID for existing creatives */
    selectedCreativeName?: string;
    /** Selected creative thumbnail URL */
    selectedCreativeThumbnail?: string;
    /** IDs of existing creatives to use */
    existingCreativeIds: string[];

    /** Image hash from uploaded files */
    imageHash?: string;
    /** Ad headline */
    adHeadline?: string;
    /** Ad primary text */
    adPrimaryText?: string;
    /** Ad description */
    adDescription?: string;
    /** Call to action button text */
    adCallToAction?: string;
    /** Creative Id */
    creativeIdTesting: string;
    // Lead generation specific
    /** Form ID for lead form ads */
    adDestinationForm?: string;
    /** Website URL for ads with website destination */
    adDestinationUrl?: string;

}