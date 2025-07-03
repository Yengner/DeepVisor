/**
 * Enhanced Meta Campaign Objective and Optimization Goal Mappings
 * Based on Meta's official objective mapping documentation
 */

// Campaign Objectives
export const CAMPAIGN_OBJECTIVES = {
    LEADS: 'OUTCOME_LEADS',
    ENGAGEMENT: 'OUTCOME_ENGAGEMENT',
    AWARENESS: 'OUTCOME_AWARENESS',
    TRAFFIC: 'OUTCOME_TRAFFIC',
    APP_PROMOTION: 'OUTCOME_APP_PROMOTION',
    SALES: 'OUTCOME_SALES'
};

// Optimization Goals
export const OPTIMIZATION_GOALS = {
    // Lead Generation
    LEAD_GENERATION: 'LEAD_GENERATION',
    QUALITY_LEAD: 'QUALITY_LEAD',

    // Message Objectives (used within other campaign objectives)
    CONVERSATIONS: 'CONVERSATIONS', // General messaging
    REPLIES: 'REPLIES', // For WhatsApp specifically

    // Rest of optimization goals remain unchanged
    PAGE_LIKES: 'PAGE_LIKES',
    POST_ENGAGEMENT: 'POST_ENGAGEMENT',
    EVENT_RESPONSES: 'EVENT_RESPONSES',
    PROFILE_VISIT: 'PROFILE_VISIT',
    PROFILE_AND_PAGE_ENGAGEMENT: 'PROFILE_AND_PAGE_ENGAGEMENT',
    LANDING_PAGE_VIEWS: 'LANDING_PAGE_VIEWS',
    LINK_CLICKS: 'LINK_CLICKS',
    REACH: 'REACH',
    IMPRESSIONS: 'IMPRESSIONS',
    BRAND_AWARENESS: 'BRAND_AWARENESS',
    THRUPLAY: 'THRUPLAY',
    TWO_SECOND_CONTINUOUS_VIDEO_VIEWS: '2_SECOND_CONTINUOUS_VIDEO_VIEWS',
    APP_INSTALLS: 'APP_INSTALLS',
    OFFSITE_CONVERSIONS: 'OFFSITE_CONVERSIONS',
    VALUE: 'VALUE',
    QUALITY_CALL: 'QUALITY_CALL'
};

// Destination Types - Basically Conversions
export const DESTINATION_TYPES = {
    WHATSAPP: 'WHATSAPP',
    MESSENGER: 'MESSENGER',
    LEAD_FROM_IG_DIRECT: 'INSTAGRAM',
    WEBSITE: 'WEBSITE',
    FORM: 'LEAD_GENERATION',
    APP: 'APP',
    SHOP: 'SHOP',
    PHONE_CALL: 'PHONE',
    UNDEFINED: 'UNDEFINED',
    ON_POST: 'ON_POST',
    ON_PAGE: 'ON_PAGE',
    ON_EVENT: 'ON_EVENT',
    ON_VIDEO: 'ON_VIDEO',
    FACEBOOK: 'FACEBOOK'
};

// Call to Action Types remain unchanged
export const CALL_TO_ACTION_TYPES = {
    // Same as before
    WHATSAPP: 'WHATSAPP_MESSAGE',
    MESSENGER: 'MESSAGE_PAGE',
    WEBSITE: 'LEARN_MORE',
    FORM: 'SIGN_UP',
    APP: 'INSTALL_MOBILE_APP',
    SHOP: 'SHOP_NOW',
    PHONE: 'CALL_NOW',
    BOOK_NOW: 'BOOK_NOW',
    CONTACT_US: 'CONTACT_US',
    DONATE_NOW: 'DONATE_NOW',
    GET_DIRECTIONS: 'GET_DIRECTIONS',
    GET_QUOTE: 'GET_QUOTE',
    SUBSCRIBE: 'SUBSCRIBE'
};

export const DEFAULT_OPTIMIZATION_GOAL = {
    [CAMPAIGN_OBJECTIVES.AWARENESS]: OPTIMIZATION_GOALS.REACH,
    [CAMPAIGN_OBJECTIVES.TRAFFIC]: OPTIMIZATION_GOALS.LINK_CLICKS,
    [CAMPAIGN_OBJECTIVES.ENGAGEMENT]: OPTIMIZATION_GOALS.POST_ENGAGEMENT,
    [CAMPAIGN_OBJECTIVES.LEADS]: OPTIMIZATION_GOALS.LEAD_GENERATION,
    [CAMPAIGN_OBJECTIVES.APP_PROMOTION]: OPTIMIZATION_GOALS.APP_INSTALLS,
    [CAMPAIGN_OBJECTIVES.SALES]: OPTIMIZATION_GOALS.OFFSITE_CONVERSIONS
};

// New comprehensive mapping system that connects all three elements:
// objective -> destination type -> optimization goals
export const OBJECTIVE_DESTINATION_OPTIMIZATION_MAP = {
    /* AWARENESS MAPPING - NOT DONE*/
    [CAMPAIGN_OBJECTIVES.AWARENESS]: {
        [DESTINATION_TYPES.WEBSITE]: {
            optimizationGoals: [
                OPTIMIZATION_GOALS.REACH,
                OPTIMIZATION_GOALS.IMPRESSIONS,
                OPTIMIZATION_GOALS.BRAND_AWARENESS
            ],
            defaultGoal: OPTIMIZATION_GOALS.REACH,
            promotedObjectFields: ['page_id']
        },
        [DESTINATION_TYPES.MESSENGER]: {
            optimizationGoals: [
                OPTIMIZATION_GOALS.REACH,
                OPTIMIZATION_GOALS.IMPRESSIONS
            ],
            defaultGoal: OPTIMIZATION_GOALS.REACH,
            promotedObjectFields: ['page_id']
        },
        [DESTINATION_TYPES.WHATSAPP]: {
            optimizationGoals: [
                OPTIMIZATION_GOALS.REACH,
                OPTIMIZATION_GOALS.IMPRESSIONS
            ],
            defaultGoal: OPTIMIZATION_GOALS.REACH,
            promotedObjectFields: ['page_id']
        },
        [DESTINATION_TYPES.UNDEFINED]: {
            optimizationGoals: [
                OPTIMIZATION_GOALS.THRUPLAY,
                OPTIMIZATION_GOALS.TWO_SECOND_CONTINUOUS_VIDEO_VIEWS,
                OPTIMIZATION_GOALS.REACH,
                OPTIMIZATION_GOALS.IMPRESSIONS
            ],
            defaultGoal: OPTIMIZATION_GOALS.REACH,
            promotedObjectFields: ['page_id']
        }
    },

    [CAMPAIGN_OBJECTIVES.TRAFFIC]: {
        [DESTINATION_TYPES.WEBSITE]: {
            optimizationGoals: [
                OPTIMIZATION_GOALS.LINK_CLICKS,
                OPTIMIZATION_GOALS.LANDING_PAGE_VIEWS,
                OPTIMIZATION_GOALS.REACH,
                OPTIMIZATION_GOALS.IMPRESSIONS
            ],
            defaultGoal: OPTIMIZATION_GOALS.LINK_CLICKS,
            promotedObjectFields: ['page_id']
        },
        [DESTINATION_TYPES.APP]: {
            optimizationGoals: [
                OPTIMIZATION_GOALS.LINK_CLICKS,
                OPTIMIZATION_GOALS.APP_INSTALLS,
                OPTIMIZATION_GOALS.REACH,
                OPTIMIZATION_GOALS.IMPRESSIONS
            ],
            defaultGoal: OPTIMIZATION_GOALS.LINK_CLICKS,
            promotedObjectFields: ['page_id', 'application_id', 'object_store_url']
        },
        [DESTINATION_TYPES.MESSENGER]: {
            optimizationGoals: [
                OPTIMIZATION_GOALS.LINK_CLICKS,
                OPTIMIZATION_GOALS.REACH,
                OPTIMIZATION_GOALS.IMPRESSIONS
            ],
            defaultGoal: OPTIMIZATION_GOALS.LINK_CLICKS,
            promotedObjectFields: ['page_id']
        },
        [DESTINATION_TYPES.WHATSAPP]: {
            optimizationGoals: [
                OPTIMIZATION_GOALS.LINK_CLICKS,
                OPTIMIZATION_GOALS.REACH,
                OPTIMIZATION_GOALS.IMPRESSIONS
            ],
            defaultGoal: OPTIMIZATION_GOALS.LINK_CLICKS,
            promotedObjectFields: ['page_id']
        },
        [DESTINATION_TYPES.PHONE_CALL]: {
            optimizationGoals: [
                OPTIMIZATION_GOALS.LINK_CLICKS,
                OPTIMIZATION_GOALS.QUALITY_CALL,
                OPTIMIZATION_GOALS.REACH,
                OPTIMIZATION_GOALS.IMPRESSIONS
            ],
            defaultGoal: OPTIMIZATION_GOALS.QUALITY_CALL,
            promotedObjectFields: ['page_id']
        }
    },

    [CAMPAIGN_OBJECTIVES.ENGAGEMENT]: {
        [DESTINATION_TYPES.ON_POST]: {
            optimizationGoals: [
                OPTIMIZATION_GOALS.POST_ENGAGEMENT,
                OPTIMIZATION_GOALS.REACH,
                OPTIMIZATION_GOALS.IMPRESSIONS
            ],
            defaultGoal: OPTIMIZATION_GOALS.POST_ENGAGEMENT,
            promotedObjectFields: ['page_id']
        },
        [DESTINATION_TYPES.ON_PAGE]: {
            optimizationGoals: [
                OPTIMIZATION_GOALS.PAGE_LIKES,
                OPTIMIZATION_GOALS.REACH,
                OPTIMIZATION_GOALS.IMPRESSIONS
            ],
            defaultGoal: OPTIMIZATION_GOALS.PAGE_LIKES,
            promotedObjectFields: ['page_id']
        },
        [DESTINATION_TYPES.ON_EVENT]: {
            optimizationGoals: [
                OPTIMIZATION_GOALS.EVENT_RESPONSES,
                OPTIMIZATION_GOALS.REACH,
                OPTIMIZATION_GOALS.IMPRESSIONS
            ],
            defaultGoal: OPTIMIZATION_GOALS.EVENT_RESPONSES,
            promotedObjectFields: ['page_id', 'event_id']
        },
        [DESTINATION_TYPES.MESSENGER]: {
            optimizationGoals: [
                OPTIMIZATION_GOALS.CONVERSATIONS,
                OPTIMIZATION_GOALS.REACH,
                OPTIMIZATION_GOALS.IMPRESSIONS
            ],
            defaultGoal: OPTIMIZATION_GOALS.CONVERSATIONS,
            promotedObjectFields: ['page_id']
        },
        [DESTINATION_TYPES.WHATSAPP]: {
            optimizationGoals: [
                OPTIMIZATION_GOALS.REPLIES,
                OPTIMIZATION_GOALS.REACH,
                OPTIMIZATION_GOALS.IMPRESSIONS
            ],
            defaultGoal: OPTIMIZATION_GOALS.REPLIES,
            promotedObjectFields: ['page_id']
        },
        [DESTINATION_TYPES.ON_VIDEO]: {
            optimizationGoals: [
                OPTIMIZATION_GOALS.THRUPLAY,
                OPTIMIZATION_GOALS.TWO_SECOND_CONTINUOUS_VIDEO_VIEWS,
                OPTIMIZATION_GOALS.POST_ENGAGEMENT,
                OPTIMIZATION_GOALS.REACH,
                OPTIMIZATION_GOALS.IMPRESSIONS
            ],
            defaultGoal: OPTIMIZATION_GOALS.THRUPLAY,
            promotedObjectFields: ['page_id']
        }
    },

    /* LEADS MAPPING - ALMOST DONE BESIDES WEBSITE*/
    [CAMPAIGN_OBJECTIVES.LEADS]: {
        [DESTINATION_TYPES.FORM]: {
            optimizationGoals: [
                OPTIMIZATION_GOALS.LEAD_GENERATION,
                OPTIMIZATION_GOALS.QUALITY_LEAD,
            ],
            defaultGoal: OPTIMIZATION_GOALS.LEAD_GENERATION,
            promotedObjectFields: ['page_id']
        },
        [DESTINATION_TYPES.MESSENGER]: {
            optimizationGoals: [
                OPTIMIZATION_GOALS.LEAD_GENERATION,
            ],
            defaultGoal: OPTIMIZATION_GOALS.LEAD_GENERATION,
            promotedObjectFields: ['page_id']
        },
        [DESTINATION_TYPES.LEAD_FROM_IG_DIRECT]: {
            optimizationGoals: [
                OPTIMIZATION_GOALS.LEAD_GENERATION,
            ],
            defaultGoal: OPTIMIZATION_GOALS.LEAD_GENERATION,
            promotedObjectFields: ['page_id']
        },
        [DESTINATION_TYPES.WHATSAPP]: {
            optimizationGoals: [
                OPTIMIZATION_GOALS.CONVERSATIONS,
            ],
            defaultGoal: OPTIMIZATION_GOALS.CONVERSATIONS,
            promotedObjectFields: ['page_id']
        },
        [DESTINATION_TYPES.PHONE_CALL]: {
            optimizationGoals: [
                OPTIMIZATION_GOALS.QUALITY_CALL,
            ],
            defaultGoal: OPTIMIZATION_GOALS.QUALITY_CALL,
            promotedObjectFields: ['page_id']
        },
        [DESTINATION_TYPES.WEBSITE]: {
            optimizationGoals: [
                OPTIMIZATION_GOALS.LINK_CLICKS,
                OPTIMIZATION_GOALS.LANDING_PAGE_VIEWS,
                OPTIMIZATION_GOALS.OFFSITE_CONVERSIONS,
                OPTIMIZATION_GOALS.REACH,
                OPTIMIZATION_GOALS.IMPRESSIONS
            ],
            defaultGoal: OPTIMIZATION_GOALS.OFFSITE_CONVERSIONS,
            promotedObjectFields: ['page_id', 'pixel_id', 'custom_event_type']
        }
    },

    [CAMPAIGN_OBJECTIVES.APP_PROMOTION]: {
        [DESTINATION_TYPES.APP]: {
            optimizationGoals: [
                OPTIMIZATION_GOALS.APP_INSTALLS,
                OPTIMIZATION_GOALS.OFFSITE_CONVERSIONS,
                OPTIMIZATION_GOALS.LINK_CLICKS
            ],
            defaultGoal: OPTIMIZATION_GOALS.APP_INSTALLS,
            promotedObjectFields: ['page_id', 'application_id', 'object_store_url']
        }
    },

    [CAMPAIGN_OBJECTIVES.SALES]: {
        [DESTINATION_TYPES.WEBSITE]: {
            optimizationGoals: [
                OPTIMIZATION_GOALS.OFFSITE_CONVERSIONS,
                OPTIMIZATION_GOALS.VALUE,
                OPTIMIZATION_GOALS.LINK_CLICKS,
                OPTIMIZATION_GOALS.LANDING_PAGE_VIEWS,
                OPTIMIZATION_GOALS.REACH,
                OPTIMIZATION_GOALS.IMPRESSIONS
            ],
            defaultGoal: OPTIMIZATION_GOALS.OFFSITE_CONVERSIONS,
            promotedObjectFields: ['page_id', 'pixel_id', 'custom_event_type']
        },
        [DESTINATION_TYPES.MESSENGER]: {
            optimizationGoals: [
                OPTIMIZATION_GOALS.CONVERSATIONS,
                OPTIMIZATION_GOALS.REACH,
                OPTIMIZATION_GOALS.IMPRESSIONS
            ],
            defaultGoal: OPTIMIZATION_GOALS.CONVERSATIONS,
            promotedObjectFields: ['page_id']
        },
        [DESTINATION_TYPES.WHATSAPP]: {
            optimizationGoals: [
                OPTIMIZATION_GOALS.REPLIES,
                OPTIMIZATION_GOALS.REACH,
                OPTIMIZATION_GOALS.IMPRESSIONS
            ],
            defaultGoal: OPTIMIZATION_GOALS.REPLIES,
            promotedObjectFields: ['page_id']
        },
        [DESTINATION_TYPES.PHONE_CALL]: {
            optimizationGoals: [
                OPTIMIZATION_GOALS.QUALITY_CALL,
                OPTIMIZATION_GOALS.REACH,
                OPTIMIZATION_GOALS.IMPRESSIONS
            ],
            defaultGoal: OPTIMIZATION_GOALS.QUALITY_CALL,
            promotedObjectFields: ['page_id']
        },
        [DESTINATION_TYPES.FACEBOOK]: {
            optimizationGoals: [
                OPTIMIZATION_GOALS.OFFSITE_CONVERSIONS,
                OPTIMIZATION_GOALS.VALUE,
                OPTIMIZATION_GOALS.REACH,
                OPTIMIZATION_GOALS.IMPRESSIONS
            ],
            defaultGoal: OPTIMIZATION_GOALS.OFFSITE_CONVERSIONS,
            promotedObjectFields: ['page_id', 'product_catalog_id', 'product_set_id']
        }
    }
};

/**
 * Enhanced helper functions that use the new mapping
 */

/**
 * Get valid destination types for a given objective
 */
export function getValidDestinationTypes(objective: string): string[] {
    if (!OBJECTIVE_DESTINATION_OPTIMIZATION_MAP[objective]) return [];
    return Object.keys(OBJECTIVE_DESTINATION_OPTIMIZATION_MAP[objective]);
}

/**
 * Get valid optimization goals for a given objective and destination type
 */
export function getValidOptimizationGoals(objective: string, destinationType: string): string[] {
    if (!OBJECTIVE_DESTINATION_OPTIMIZATION_MAP[objective]?.[destinationType]) return [];
    return OBJECTIVE_DESTINATION_OPTIMIZATION_MAP[objective][destinationType].optimizationGoals;
}

/**
 * Get the default optimization goal for a given objective and destination type
 */
export function getDefaultOptimizationGoal(objective: string, destinationType: string): string {
    if (!OBJECTIVE_DESTINATION_OPTIMIZATION_MAP[objective]?.[destinationType]) {
        // Fallback to the old default if specific combination not found
        return DEFAULT_OPTIMIZATION_GOAL[objective] || OPTIMIZATION_GOALS.LINK_CLICKS;
    }
    return OBJECTIVE_DESTINATION_OPTIMIZATION_MAP[objective][destinationType].defaultGoal;
}

/**
 * Get the required promoted object fields for a given objective and destination type
 */
export function getPromotedObjectFields(objective: string, destinationType: string): string[] {
    if (!OBJECTIVE_DESTINATION_OPTIMIZATION_MAP[objective]?.[destinationType]) return ['page_id'];
    return OBJECTIVE_DESTINATION_OPTIMIZATION_MAP[objective][destinationType].promotedObjectFields;
}

/**
 * Build the promoted object based on objective, destination, and provided params
 */
export function buildPromotedObject(
    objective: string,
    destinationType: string,
    params: {
        page_id?: string,
        pixel_id?: string,
        custom_event_type?: string,
        application_id?: string,
        object_store_url?: string,
        product_catalog_id?: string,
        product_set_id?: string,
        event_id?: string
    }
): any {
    const requiredFields = getPromotedObjectFields(objective, destinationType);
    const promotedObject: any = {};

    requiredFields.forEach(field => {
        if (params[field]) {
            promotedObject[field] = params[field];
        }
    });

    return Object.keys(promotedObject).length > 0 ? promotedObject : null;
}

export const getOptimizationLabel = (goal: string): string => {
    switch (goal) {
        case OPTIMIZATION_GOALS.LEAD_GENERATION: return 'Maximum Leads';
        case OPTIMIZATION_GOALS.QUALITY_LEAD: return 'Quality Leads';
        case OPTIMIZATION_GOALS.CONVERSATIONS: return 'Messaging Conversations';
        case OPTIMIZATION_GOALS.REPLIES: return 'Message Replies';
        case OPTIMIZATION_GOALS.PAGE_LIKES: return 'Page Likes';
        case OPTIMIZATION_GOALS.POST_ENGAGEMENT: return 'Post Engagement';
        case OPTIMIZATION_GOALS.EVENT_RESPONSES: return 'Event Responses';
        case OPTIMIZATION_GOALS.PROFILE_VISIT: return 'Profile Visit';
        case OPTIMIZATION_GOALS.PROFILE_AND_PAGE_ENGAGEMENT: return 'Profile & Page Engagement';
        case OPTIMIZATION_GOALS.LANDING_PAGE_VIEWS: return 'Landing Page Views';
        case OPTIMIZATION_GOALS.LINK_CLICKS: return 'Link Clicks';
        case OPTIMIZATION_GOALS.REACH: return 'Maximum Reach';
        case OPTIMIZATION_GOALS.IMPRESSIONS: return 'Impressions';
        case OPTIMIZATION_GOALS.BRAND_AWARENESS: return 'Brand Awareness';
        case OPTIMIZATION_GOALS.THRUPLAY: return 'ThruPlays';
        case OPTIMIZATION_GOALS.TWO_SECOND_CONTINUOUS_VIDEO_VIEWS: return '2-Second Video Views';
        case OPTIMIZATION_GOALS.APP_INSTALLS: return 'App Installs';
        case OPTIMIZATION_GOALS.OFFSITE_CONVERSIONS: return 'Offsite Conversions';
        case OPTIMIZATION_GOALS.VALUE: return 'Value Optimization';
        case OPTIMIZATION_GOALS.QUALITY_CALL: return 'Quality Phone Calls';
        default: return goal;
    }
};

// Helper to get a user-friendly label for objectives
export const getObjectiveLabel = (objective: string): string => {
    switch (objective) {
        case CAMPAIGN_OBJECTIVES.LEADS: return 'Lead Generation';
        case CAMPAIGN_OBJECTIVES.ENGAGEMENT: return 'Engagement';
        case CAMPAIGN_OBJECTIVES.AWARENESS: return 'Awareness';
        case CAMPAIGN_OBJECTIVES.TRAFFIC: return 'Traffic';
        case CAMPAIGN_OBJECTIVES.APP_PROMOTION: return 'App Promotion';
        case CAMPAIGN_OBJECTIVES.SALES: return 'Sales';
        default: return objective;
    }
};