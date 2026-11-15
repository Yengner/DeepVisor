import {
  BUSINESS_CATEGORY_OPTIONS,
  CONTACT_METHOD_OPTIONS,
  isAllowedOption,
} from './businessProfileOptions';

/**
 * The single contract for "business essentials are complete".
 * Used by the onboarding form and by the server before onboarding can advance.
 * Pure: no I/O.
 */

const BUSINESS_NAME_PLACEHOLDERS = new Set([
  'my business',
  'business setup',
  'new business',
  'untitled business',
]);

export function normalizeBusinessName(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Workspaces start as "Business setup"; that and similar defaults are not real names. */
export function isPlaceholderBusinessName(value: string | null | undefined): boolean {
  return BUSINESS_NAME_PLACEHOLDERS.has(normalizeBusinessName(value).toLowerCase());
}

export const LOCATION_MODES = ['storefront', 'service_area'] as const;
export type LocationMode = (typeof LOCATION_MODES)[number];

export function isLocationMode(value: unknown): value is LocationMode {
  return typeof value === 'string' && (LOCATION_MODES as readonly string[]).includes(value);
}

export type LocationParts = {
  street?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
  country?: string | null;
};

function part(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Human-readable location kept in `business_location` for existing readers.
 * e.g. "123 Main St, Tampa, FL 33602, US" or "Tampa, FL, US".
 */
export function formatBusinessLocation(parts: LocationParts): string {
  const regionAndPostal = [part(parts.region), part(parts.postalCode)].filter(Boolean).join(' ');
  return [part(parts.street), part(parts.city), regionAndPostal, part(parts.country).toUpperCase()]
    .filter(Boolean)
    .join(', ');
}

export const ONBOARDING_REQUIRED_FIELDS = [
  'business_name',
  'industry',
  'location',
  'preferred_contact_method',
] as const;
export type OnboardingRequiredField = (typeof ONBOARDING_REQUIRED_FIELDS)[number];

export type OnboardingEssentialsProfile = {
  business_name: string | null;
  industry: string | null;
  business_location: string | null;
  location_city?: string | null;
  location_region?: string | null;
  location_country?: string | null;
  preferred_contact_method: string | null;
};

/** Structured city/region/country, or a legacy free-text location from before structured fields. */
export function hasCompleteLocation(profile: OnboardingEssentialsProfile): boolean {
  const structured = Boolean(
    part(profile.location_city) && part(profile.location_region) && part(profile.location_country)
  );
  return structured || Boolean(part(profile.business_location));
}

/** Returns the required fields that are still missing or invalid; empty means complete. */
export function missingOnboardingEssentials(
  profile: OnboardingEssentialsProfile
): OnboardingRequiredField[] {
  const missing: OnboardingRequiredField[] = [];
  const name = normalizeBusinessName(profile.business_name);
  if (!name || isPlaceholderBusinessName(name)) missing.push('business_name');
  if (!isAllowedOption(profile.industry, BUSINESS_CATEGORY_OPTIONS)) missing.push('industry');
  if (!hasCompleteLocation(profile)) missing.push('location');
  if (!isAllowedOption(profile.preferred_contact_method, CONTACT_METHOD_OPTIONS)) {
    missing.push('preferred_contact_method');
  }
  return missing;
}
