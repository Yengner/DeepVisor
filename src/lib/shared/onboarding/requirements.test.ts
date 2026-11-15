import { describe, expect, it } from 'vitest';
import {
  BUSINESS_CATEGORY_GROUPS,
  BUSINESS_CATEGORY_OPTIONS,
  SALON_INDUSTRY_OPTIONS,
  optionValues,
} from './businessProfileOptions';
import {
  formatBusinessLocation,
  isPlaceholderBusinessName,
  missingOnboardingEssentials,
  type OnboardingEssentialsProfile,
} from './requirements';

const complete: OnboardingEssentialsProfile = {
  business_name: 'Bayside Plumbing Co',
  industry: 'plumbing',
  business_location: 'Tampa, FL, US',
  location_city: 'Tampa',
  location_region: 'FL',
  location_country: 'US',
  preferred_contact_method: 'phone_calls',
};

describe('business categories', () => {
  it('keeps every original salon value valid for stored rows', () => {
    const values = new Set(optionValues(BUSINESS_CATEGORY_OPTIONS));
    for (const legacy of ['hair_salon', 'nail_salon', 'beauty_salon', 'barbershop', 'lash_brow_studio', 'med_spa', 'spa_skincare', 'other']) {
      expect(values.has(legacy)).toBe(true);
    }
    expect(SALON_INDUSTRY_OPTIONS).toBe(BUSINESS_CATEGORY_OPTIONS);
  });

  it('has unique values and labels across groups', () => {
    const values = optionValues(BUSINESS_CATEGORY_OPTIONS);
    expect(new Set(values).size).toBe(values.length);
    expect(BUSINESS_CATEGORY_GROUPS.every((group) => group.items.length > 0)).toBe(true);
  });
});

describe('missingOnboardingEssentials', () => {
  it('accepts a complete non-beauty business without a customer radius', () => {
    expect(missingOnboardingEssentials(complete)).toEqual([]);
  });

  it('reports placeholder names, unknown categories, missing location and contact', () => {
    expect(missingOnboardingEssentials({
      business_name: 'Business setup',
      industry: 'invented',
      business_location: null,
      location_city: 'Tampa',
      location_region: null,
      location_country: 'US',
      preferred_contact_method: null,
    })).toEqual(['business_name', 'industry', 'location', 'preferred_contact_method']);
  });

  it('accepts a legacy free-text location from before structured fields', () => {
    expect(missingOnboardingEssentials({
      ...complete,
      location_city: null,
      location_region: null,
      location_country: null,
      business_location: '123 Main St, Tampa, FL',
    })).toEqual([]);
  });
});

describe('isPlaceholderBusinessName', () => {
  it('matches defaults case-insensitively and ignores real names', () => {
    expect(isPlaceholderBusinessName('  My Business ')).toBe(true);
    expect(isPlaceholderBusinessName('Business setup')).toBe(true);
    expect(isPlaceholderBusinessName('Bayside Plumbing Co')).toBe(false);
    expect(isPlaceholderBusinessName(null)).toBe(false);
  });
});

describe('formatBusinessLocation', () => {
  it('formats storefront and service-area locations', () => {
    expect(formatBusinessLocation({ street: '123 Main St', city: 'Tampa', region: 'FL', postalCode: '33602', country: 'us' }))
      .toBe('123 Main St, Tampa, FL 33602, US');
    expect(formatBusinessLocation({ city: ' Tampa ', region: 'FL', country: 'US' })).toBe('Tampa, FL, US');
    expect(formatBusinessLocation({})).toBe('');
  });
});
