import type { Database } from '@/lib/shared/types/supabase';
import {
  INTELLIGENCE_GOAL_OPTIONS, MONTHLY_AD_BUDGET_OPTIONS, TARGET_COST_PER_LEAD_OPTIONS,
  LEAD_TYPE_OPTIONS, SALON_INDUSTRY_OPTIONS, SAFETY_PREFERENCE_OPTIONS, RECOMMENDATION_STYLE_OPTIONS,
  type OnboardingOption,
} from '@/lib/shared/onboarding/businessProfileOptions';

type Profile = Database['public']['Tables']['business_profiles']['Row'];
export type ObjectiveProfile = Pick<Profile, 'primary_goal' | 'monthly_budget' | 'target_cost_per_lead' | 'lead_type' | 'industry' | 'safety_preference' | 'recommendation_style'>;
const choice = (options: OnboardingOption[], value: string | null) => {
  const found = options.find(option => option.value === value);
  return found ? { code: found.value, label: found.label } : null;
};

/** Descriptive preferences, never execution authority. Unknown legacy values stay unavailable. */
export function businessObjectives(profile: ObjectiveProfile) {
  return {
    version: 1 as const,
    objective: choice(INTELLIGENCE_GOAL_OPTIONS, profile.primary_goal),
    monthlyBudget: choice(MONTHLY_AD_BUDGET_OPTIONS, profile.monthly_budget),
    targetCost: choice(TARGET_COST_PER_LEAD_OPTIONS, profile.target_cost_per_lead),
    leadType: choice(LEAD_TYPE_OPTIONS, profile.lead_type),
    industry: choice(SALON_INDUSTRY_OPTIONS, profile.industry),
    safety: choice(SAFETY_PREFERENCE_OPTIONS, profile.safety_preference),
    recommendationStyle: choice(RECOMMENDATION_STYLE_OPTIONS, profile.recommendation_style),
  };
}
export type BusinessObjectives = ReturnType<typeof businessObjectives>;

/** Stored with decision questions so later preference edits cannot rewrite the historical input. */
export function agencyQuestions(questions: readonly string[], context: BusinessObjectives): string[] {
  const summary = [
    ['Goal', context.objective], ['Monthly budget preference', context.monthlyBudget], ['Target lead cost', context.targetCost],
    ['Lead type', context.leadType], ['Industry', context.industry], ['Safety preference', context.safety], ['Review preference', context.recommendationStyle],
  ].map(([name, value]) => `${name}: ${typeof value === 'object' && value ? value.label : 'Not specified'}`).join('; ');
  return [...questions, `Business objectives context v1: ${summary}. These are descriptive preferences, not execution permissions. Budget and target-cost choices are ranges, not exact limits; their currency is not explicitly stored, so do not compare them numerically with account currency. Meta-reported results, leads, messages and booking-link clicks are not verified appointments, customers, or revenue. Use only supplied evidence. Do not change the supported decision vocabulary. PolicyEngine and separately authorized approvals remain authoritative.`];
}
