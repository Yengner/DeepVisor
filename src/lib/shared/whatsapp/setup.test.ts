import { describe, expect, it } from 'vitest';
import {
  defaultWhatsAppChoice, formatWhatsAppNumber, mergeWhatsAppCandidates, normalizeWhatsAppNumber,
  savedNumberMismatch, whatsAppNumbersFromAdSets,
} from './setup';

const adSet = (number: unknown, status = 'PAUSED') => ({ effective_status: status, promoted_object: { whatsapp_phone_number: number } });

describe('numbers', () => {
  it('normalizes common formats and rejects anything else', () => {
    expect(normalizeWhatsAppNumber('+1 (813) 555-1234')).toBe('+18135551234');
    expect(normalizeWhatsAppNumber('18135551234')).toBe('+18135551234');
    for (const bad of ['', '555-12', 'call me', '+0 813 555 1234', null, 18135551234]) expect(normalizeWhatsAppNumber(bad)).toBeNull();
  });
  it('formats US numbers and leaves others as digits', () => {
    expect(formatWhatsAppNumber('+18135551234')).toBe('+1 (813) 555-1234');
    expect(formatWhatsAppNumber('+5215512345678')).toBe('+5215512345678');
  });
});

describe('detection', () => {
  const fromAds = whatsAppNumbersFromAdSets([
    adSet('18135550001'), adSet('18135550001', 'ACTIVE'), adSet('+1 813 555 0002'),
    adSet(undefined), { promoted_object: null }, null,
  ]);

  it('counts ad sets and running ad sets per number, skipping ad sets without one', () => {
    expect(fromAds.map(c => [c.number, c.adSets, c.activeAdSets])).toEqual([['+18135550001', 2, 1], ['+18135550002', 1, 0]]);
  });

  it('adds portfolio detail, lists a repeated number once and keeps ad numbers first', () => {
    const merged = mergeWhatsAppCandidates(fromAds, [
      { number: '+18135550003', name: 'Front desk', onPhoneApp: false },
      { number: '+18135550003', name: 'Duplicate', onPhoneApp: true },
      { number: '+18135550001', name: 'Salon', onPhoneApp: true },
    ]);
    expect(merged.map(c => c.number)).toEqual(['+18135550001', '+18135550002', '+18135550003']);
    expect(merged[0]).toMatchObject({ adSets: 2, inPortfolio: true, name: 'Salon', onPhoneApp: true });
    expect(merged[2]).toMatchObject({ adSets: 0, name: 'Front desk', onPhoneApp: true });
  });

  it('flags a saved number the ads do not use, but not when ads give no evidence', () => {
    expect(savedNumberMismatch('+18135559999', fromAds)).toBe(true);
    expect(savedNumberMismatch('1 (813) 555-0002', fromAds)).toBe(false);
    expect(savedNumberMismatch(null, fromAds)).toBe(false);
    expect(savedNumberMismatch('+18135559999', mergeWhatsAppCandidates([], [{ number: '+18135550003', name: null, onPhoneApp: null }]))).toBe(false);
  });

  it('preselects only an obvious answer', () => {
    expect(defaultWhatsAppChoice(null, fromAds)).toBe('+18135550001');
    expect(defaultWhatsAppChoice('+18135550002', fromAds)).toBe('+18135550002');
    expect(defaultWhatsAppChoice('+18135559999', fromAds)).toBe('+18135550001');
    expect(defaultWhatsAppChoice(null, whatsAppNumbersFromAdSets([adSet('18135550001'), adSet('18135550002')]))).toBeNull();
    expect(defaultWhatsAppChoice(null, [])).toBeNull();
  });
});
