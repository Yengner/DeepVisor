import { describe, expect, it } from 'vitest';
import { negotiateLocale, resolveLocale } from './locales';

describe('locale selection', () => {
  it('prefers a saved choice, then the browser, then English', () => {
    expect(resolveLocale('es', 'en-US')).toBe('es');
    expect(resolveLocale('auto', 'es-MX,es;q=0.9')).toBe('es');
    expect(resolveLocale(undefined, 'fr-FR,fr;q=0.9')).toBe('en');
    expect(resolveLocale('de', null)).toBe('en');
  });

  it('respects Accept-Language quality values and order', () => {
    expect(negotiateLocale('es-419,es;q=0.9,en;q=0.8')).toBe('es');
    expect(negotiateLocale('en-US,en;q=0.9,es;q=0.8')).toBe('en');
    expect(negotiateLocale('fr;q=0.9,es;q=0.5,en;q=0.4')).toBe('es');
    expect(negotiateLocale('es;q=0,en')).toBe('en');
    expect(negotiateLocale('*')).toBe('en');
    expect(negotiateLocale('')).toBe('en');
  });
});
