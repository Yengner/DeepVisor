export type OnboardingOption = {
  value: string;
  label: string;
};

export const SALON_INDUSTRY_OPTIONS: OnboardingOption[] = [
  { value: 'hair_salon', label: 'Hair Salon' },
  { value: 'nail_salon', label: 'Nail Salon' },
  { value: 'beauty_salon', label: 'Beauty Salon' },
  { value: 'barbershop', label: 'Barbershop' },
  { value: 'lash_brow_studio', label: 'Lash / Brow Studio' },
  { value: 'med_spa', label: 'Med Spa' },
  { value: 'spa_skincare', label: 'Spa / Skincare' },
  { value: 'other', label: 'Other' },
];

export const CUSTOMER_RADIUS_OPTIONS: OnboardingOption[] = [
  { value: 'within_3_miles', label: 'Within 3 miles' },
  { value: 'within_5_miles', label: 'Within 5 miles' },
  { value: 'within_10_miles', label: 'Within 10 miles' },
  { value: 'within_15_miles', label: 'Within 15 miles' },
  { value: 'within_25_miles', label: 'Within 25 miles' },
  { value: 'not_sure', label: 'Not sure' },
];

export const SALON_SERVICE_OPTIONS: OnboardingOption[] = [
  { value: 'haircuts', label: 'Haircuts' },
  { value: 'hair_color', label: 'Hair color' },
  { value: 'balayage', label: 'Balayage' },
  { value: 'hair_extensions', label: 'Hair extensions' },
  { value: 'blowouts', label: 'Blowouts' },
  { value: 'nails', label: 'Nails' },
  { value: 'lashes', label: 'Lashes' },
  { value: 'brows', label: 'Brows' },
  { value: 'facials', label: 'Facials' },
  { value: 'skincare', label: 'Skincare' },
  { value: 'waxing', label: 'Waxing' },
  { value: 'bridal_event_services', label: 'Bridal / event services' },
  { value: 'consultations', label: 'Consultations' },
  { value: 'same_day_openings', label: 'Same-day openings' },
  { value: 'new_client_offer', label: 'New client offer' },
  { value: 'other', label: 'Other' },
];

export const SALON_MOST_VALUABLE_SERVICE_OPTIONS: OnboardingOption[] = [
  { value: 'hair_extensions', label: 'Hair extensions' },
  { value: 'hair_color', label: 'Hair color' },
  { value: 'balayage', label: 'Balayage' },
  { value: 'new_client_consultation', label: 'New client consultation' },
  { value: 'nails', label: 'Nails' },
  { value: 'lashes', label: 'Lashes' },
  { value: 'other', label: 'Other' },
];

export const MONTHLY_AD_BUDGET_OPTIONS: OnboardingOption[] = [
  { value: 'not_running_ads_yet', label: '$0 - not running ads yet' },
  { value: '100_300', label: '$100 - $300' },
  { value: '300_500', label: '$300 - $500' },
  { value: '500_1000', label: '$500 - $1,000' },
  { value: '1000_2500', label: '$1,000 - $2,500' },
  { value: '2500_5000', label: '$2,500 - $5,000' },
  { value: '5000_plus', label: '$5,000+' },
  { value: 'not_sure', label: 'Not sure' },
];

export const META_ADS_STATUS_OPTIONS: OnboardingOption[] = [
  { value: 'currently_running', label: 'Yes, currently running ads' },
  { value: 'ran_before_stopped', label: 'I ran ads before but stopped' },
  { value: 'boosted_posts_before', label: 'I have boosted posts before' },
  { value: 'never_run_meta_ads', label: 'I have never run Meta ads' },
  { value: 'not_sure', label: 'Not sure' },
];

export const INTELLIGENCE_GOAL_OPTIONS: OnboardingOption[] = [
  { value: 'more_leads', label: 'Get more leads' },
  { value: 'more_booked_appointments', label: 'Get more booked appointments' },
  { value: 'lower_cost_per_lead', label: 'Lower my cost per lead' },
  { value: 'reduce_wasted_spend', label: 'Reduce wasted ad spend' },
  { value: 'understand_working_ads', label: 'Understand which ads are working' },
  { value: 'find_best_creative', label: 'Find my best-performing creative' },
  { value: 'improve_follow_up', label: 'Improve follow-up with leads' },
  { value: 'launch_simple_meta_campaigns', label: 'Launch simple Meta lead campaigns' },
  { value: 'recommend_for_me', label: 'Not sure - recommend for me' },
];

export const LEAD_TYPE_OPTIONS: OnboardingOption[] = [
  { value: 'whatsapp_messages', label: 'WhatsApp messages' },
  { value: 'messages', label: 'Messages' },
  { value: 'phone_calls', label: 'Phone calls' },
  { value: 'instant_forms', label: 'Instant forms' },
  { value: 'booking_link_clicks', label: 'Booking link clicks' },
  { value: 'consultation_requests', label: 'Consultation requests' },
  { value: 'recommend_for_me', label: 'Not sure - recommend for me' },
];

export const CONTACT_METHOD_OPTIONS: OnboardingOption[] = [
  { value: 'whatsapp_messages', label: 'WhatsApp messages' },
  { value: 'instagram_dms', label: 'Instagram DMs' },
  { value: 'facebook_messenger', label: 'Facebook Messenger' },
  { value: 'phone_calls', label: 'Phone calls' },
  { value: 'lead_form', label: 'Lead form' },
  { value: 'website_booking_link', label: 'Website booking link' },
  { value: 'not_sure', label: 'Not sure' },
];

export const LEAD_QUALITY_SIGNAL_OPTIONS: OnboardingOption[] = [
  { value: 'booked_appointment', label: 'They booked an appointment' },
  { value: 'requested_consultation', label: 'They requested a consultation' },
  { value: 'called_business', label: 'They called the business' },
  { value: 'replied_to_message', label: 'They replied to our message' },
  { value: 'showed_up', label: 'They showed up' },
  { value: 'spent_over_amount', label: 'They spent over a certain amount' },
  { value: 'not_sure_yet', label: 'Not sure yet' },
];

export const AVERAGE_CUSTOMER_VALUE_OPTIONS: OnboardingOption[] = [
  { value: 'under_50', label: 'Under $50' },
  { value: '50_100', label: '$50 - $100' },
  { value: '100_200', label: '$100 - $200' },
  { value: '200_500', label: '$200 - $500' },
  { value: '500_1000', label: '$500 - $1,000' },
  { value: '1000_plus', label: '$1,000+' },
  { value: 'not_sure', label: 'Not sure' },
];

export const TARGET_COST_PER_LEAD_OPTIONS: OnboardingOption[] = [
  { value: 'under_10', label: 'Under $10' },
  { value: '10_25', label: '$10 - $25' },
  { value: '25_50', label: '$25 - $50' },
  { value: '50_100', label: '$50 - $100' },
  { value: '100_plus', label: '$100+' },
  { value: 'recommend_for_me', label: 'Not sure - recommend for me' },
];

export const WATCH_SIGNAL_OPTIONS: OnboardingOption[] = [
  { value: 'wasted_spend', label: 'Wasted spend' },
  { value: 'high_cost_per_lead', label: 'High cost per lead' },
  { value: 'no_lead_spend', label: 'Ads spending with no leads' },
  { value: 'best_creative', label: 'Best-performing creative' },
  { value: 'weak_creative', label: 'Weak-performing creative' },
  { value: 'audience_changes', label: 'Audience performance changes' },
  { value: 'placement_performance', label: 'Placement performance' },
  { value: 'budget_pacing', label: 'Budget pacing' },
  { value: 'pause_candidates', label: 'Campaigns that should be paused' },
  { value: 'scale_candidates', label: 'Campaigns that may deserve more budget' },
  { value: 'lead_volume_drops', label: 'Lead volume drops' },
  { value: 'cost_spikes', label: 'Cost spikes' },
  { value: 'new_ad_tests', label: 'Opportunities to test new ads' },
];

export const RECOMMENDATION_STYLE_OPTIONS: OnboardingOption[] = [
  { value: 'insights_only', label: 'Show insights only' },
  { value: 'recommend_actions_for_approval', label: 'Recommend actions for me to approve' },
  { value: 'create_drafts_for_review', label: 'Create drafts I can review' },
];

export const SAFETY_PREFERENCE_OPTIONS: OnboardingOption[] = [
  { value: 'very_cautious', label: 'Very cautious - only obvious recommendations' },
  { value: 'balanced', label: 'Balanced - recommend improvements when there is enough signal' },
  { value: 'growth_focused', label: 'Growth-focused - suggest more tests and scaling opportunities' },
];

export const DEFAULT_WATCH_SIGNALS = [
  'wasted_spend',
  'high_cost_per_lead',
  'no_lead_spend',
  'best_creative',
  'lead_volume_drops',
  'cost_spikes',
];

export const DEFAULT_INTELLIGENCE_GOALS = {
  primaryGoal: 'more_booked_appointments',
  leadType: 'whatsapp_messages',
  preferredContactMethod: 'whatsapp_messages',
  leadQualitySignal: 'booked_appointment',
  recommendationStyle: 'recommend_actions_for_approval',
  safetyPreference: 'balanced',
} as const;

export function optionValues(options: OnboardingOption[]): string[] {
  return options.map((option) => option.value);
}

export function isAllowedOption(value: string | null | undefined, options: OnboardingOption[]): boolean {
  return typeof value === 'string' && optionValues(options).includes(value);
}

export function labelForOption(
  value: string | null | undefined,
  options: OnboardingOption[],
  fallback = 'Not set'
): string {
  if (!value) return fallback;
  return options.find((option) => option.value === value)?.label ?? fallback;
}
