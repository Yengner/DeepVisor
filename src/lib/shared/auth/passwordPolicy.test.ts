import { describe, expect, it } from 'vitest';
import { passwordChecks, passwordMeetsPolicy } from './passwordPolicy';

describe('passwordPolicy', () => {
  it('rejects a long password without a symbol (the hosted project does too)', () => {
    expect(passwordMeetsPolicy('WPtSg05dStu2npZYAa1')).toBe(false);
    expect(passwordChecks('WPtSg05dStu2npZYAa1').find((check) => check.key === 'symbol')?.passed).toBe(false);
  });

  it('accepts a password with every character class and enough length', () => {
    expect(passwordMeetsPolicy('Plumb3r!x')).toBe(true);
  });

  it('reports each failing rule', () => {
    const failing = passwordChecks('abc').filter((check) => !check.passed).map((check) => check.key);
    expect(failing).toEqual(['length', 'uppercase', 'digit', 'symbol']);
  });

  it('does not count letters outside the Supabase symbol set as symbols', () => {
    expect(passwordMeetsPolicy('Caféteria12')).toBe(false);
  });
});
