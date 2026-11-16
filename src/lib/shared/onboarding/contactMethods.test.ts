import { describe, expect, it } from 'vitest';
import {
  contactMethodsForDisplay,
  normalizeContactMethods,
  resolveContactSelection,
  withPreferredContactMethod,
} from './contactMethods';

describe('resolveContactSelection', () => {
  it('uses a single method as the main one', () => {
    expect(resolveContactSelection(['phone_calls'], null)).toEqual({
      contactMethods: ['phone_calls'], preferredContactMethod: 'phone_calls',
    });
  });

  it('requires an explicit main method when several are chosen', () => {
    expect(resolveContactSelection(['phone_calls', 'instagram_dms'], null)).toHaveProperty('error');
    expect(resolveContactSelection(['phone_calls', 'instagram_dms'], 'lead_form')).toHaveProperty('error');
    expect(resolveContactSelection(['phone_calls', 'instagram_dms', 'phone_calls'], 'instagram_dms')).toEqual({
      contactMethods: ['instagram_dms', 'phone_calls'], preferredContactMethod: 'instagram_dms',
    });
  });

  it('rejects empty, invalid, and "not sure" combined with real methods', () => {
    expect(resolveContactSelection([], null)).toHaveProperty('error');
    expect(resolveContactSelection(['carrier_pigeon'], null)).toHaveProperty('error');
    expect(resolveContactSelection(['not_sure', 'phone_calls'], 'phone_calls')).toHaveProperty('error');
    expect(resolveContactSelection(['not_sure'], null)).toEqual({
      contactMethods: ['not_sure'], preferredContactMethod: 'not_sure',
    });
  });
});

describe('contact method helpers', () => {
  it('keeps option order and drops unknown values', () => {
    expect(normalizeContactMethods(['phone_calls', 'whatsapp_messages', 'bogus'])).toEqual(['whatsapp_messages', 'phone_calls']);
  });

  it('falls back to the legacy single preferred method for older rows', () => {
    expect(contactMethodsForDisplay([], 'phone_calls')).toEqual(['phone_calls']);
    expect(contactMethodsForDisplay(['lead_form'], 'phone_calls')).toEqual(['lead_form']);
    expect(contactMethodsForDisplay(null, null)).toEqual([]);
  });

  it('adds a newly chosen main method to the list and handles "not sure"', () => {
    expect(withPreferredContactMethod(['instagram_dms'], 'phone_calls')).toEqual(['instagram_dms', 'phone_calls']);
    expect(withPreferredContactMethod(['not_sure'], 'phone_calls')).toEqual(['phone_calls']);
    expect(withPreferredContactMethod(['phone_calls', 'lead_form'], 'not_sure')).toEqual(['not_sure']);
  });
});
