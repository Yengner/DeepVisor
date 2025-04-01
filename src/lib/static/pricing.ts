import { IPricing } from "@/types/public/types";

export const tiers: IPricing[] = [
    {
        name: 'Solo Starter',
        price: 55,
        features: [
            'Basic platform integration',
            'Access to insights for one platform',
            'Campaign tracking & reporting',
            'Email support',
        ],
    },
    {
        name: 'Growth Pro',
        price: 99,
        features: [
            'Multi-platform integration',
            'Advanced analytics & insights',
            'Customizable reports',
            'Priority email support',
            'AI-powered recommendations',
        ],
    },
    {
        name: 'Enterprise',
        price: 'Custom',
        features: [
            'Multi-platform integration',
            'Advanced analytics & reporting tools',
            'Website analytics integration',
            '24/7 dedicated support',
            'Custom workflows for your business',
            'API access for integrations',
        ],
    },
    {
        name: 'DeepVisor',
        price: 'Contact Us',
        features: [
            'Results-driven ad management',
            'All campaigns run and optimized by DeepVisor ',
            'Full access to campaign data & insights',
            'Multi-platform integration & reporting',
            'Regular strategy reviews and updates',
            'Best-in-class tools for the highest ROI',
        ],
    },
];
