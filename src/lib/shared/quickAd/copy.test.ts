import { describe, expect, it } from 'vitest';
import { fallbackCopy, validateCopy } from './copy';

const v = (language: 'en' | 'es', primaryText = 'Fresh color for fall. Send us a message to book.', headline = 'Book your color') => ({ language, primaryText, headline });

describe('validateCopy', () => {
  it('returns one variant per language in the requested order', () => {
    expect(validateCopy({ variants: [v('en'), v('es', 'Color nuevo. Escríbenos para reservar.', 'Reserva tu cita')] }, ['es', 'en'])?.map(x => x.language)).toEqual(['es', 'en']);
  });

  it('rejects missing, duplicated or extra languages', () => {
    expect(validateCopy({ variants: [v('en')] }, ['en', 'es'])).toBeNull();
    expect(validateCopy({ variants: [v('en'), v('en')] }, ['en', 'es'])).toBeNull();
    expect(validateCopy({ variants: [v('en'), v('es')] }, ['en'])).toBeNull();
  });

  it('rejects over-long text, links and phone numbers', () => {
    expect(validateCopy({ variants: [v('en', 'x'.repeat(301))] }, ['en'])).toBeNull();
    expect(validateCopy({ variants: [v('en', 'ok', 'x'.repeat(41))] }, ['en'])).toBeNull();
    expect(validateCopy({ variants: [v('en', 'Visit www.salon.com today')] }, ['en'])).toBeNull();
    expect(validateCopy({ variants: [v('en', 'Call 813-555-0100 now')] }, ['en'])).toBeNull();
    expect(validateCopy({ variants: [{ ...v('en'), extra: true }] }, ['en'])).toBeNull();
    expect(validateCopy('nope', ['en'])).toBeNull();
  });
});

describe('fallbackCopy', () => {
  it('reuses the previous ad text for the first language only', () => {
    expect(fallbackCopy({ primaryText: ' Hola ', headline: 'Citas' }, ['es', 'en'])).toEqual({ variants: [{ language: 'es', primaryText: 'Hola', headline: 'Citas' }], source: 'previous_ad' });
  });
  it('returns nothing rather than inventing text', () => {
    expect(fallbackCopy(null, ['en'])).toEqual({ variants: [], source: 'none' });
    expect(fallbackCopy({ primaryText: '', headline: 'x' }, ['en'])).toEqual({ variants: [], source: 'none' });
  });
});
