/**
 * Ad text contract for Quick ad. Pure: the schema the model must return, its validation and
 * the fallback used when the model is unavailable. Lengths follow Meta's recommended display
 * limits so text is not truncated in feeds.
 */
import { z } from 'zod';

export const COPY_LIMITS = { primaryText: 300, headline: 40 } as const;
export type CopyLanguage = 'en' | 'es';
export type AdCopy = { language: CopyLanguage; primaryText: string; headline: string };
export type CopyResult = { variants: AdCopy[]; source: 'model' | 'previous_ad' | 'none' };

const variant = z.object({
  language: z.enum(['en', 'es']),
  primaryText: z.string().trim().min(1).max(COPY_LIMITS.primaryText),
  headline: z.string().trim().min(1).max(COPY_LIMITS.headline),
}).strict();

/** JSON schema sent to the model (strict structured output). */
export const COPY_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['variants'],
  properties: {
    variants: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['language', 'primaryText', 'headline'],
        properties: {
          language: { type: 'string', enum: ['en', 'es'] },
          primaryText: { type: 'string', maxLength: COPY_LIMITS.primaryText },
          headline: { type: 'string', maxLength: COPY_LIMITS.headline },
        },
      },
    },
  },
} as const;

const LINK_OR_PHONE = /(https?:\/\/|www\.|\b\d{3}[\s.-]?\d{3}[\s.-]?\d{4}\b)/i;

/**
 * Accepts model output only when it has exactly one variant per requested language, within
 * limits, without links or phone numbers (the ad's button and WhatsApp handle contact).
 */
export function validateCopy(value: unknown, languages: readonly CopyLanguage[]): AdCopy[] | null {
  const parsed = z.object({ variants: z.array(variant).max(languages.length) }).strict().safeParse(value);
  if (!parsed.success) return null;
  const byLanguage = new Map(parsed.data.variants.map(v => [v.language, v]));
  if (byLanguage.size !== languages.length || languages.some(l => !byLanguage.has(l))) return null;
  const ordered = languages.map(l => byLanguage.get(l)!);
  return ordered.some(v => LINK_OR_PHONE.test(v.primaryText) || LINK_OR_PHONE.test(v.headline)) ? null : ordered;
}

/** The previous ad's own text, reused for the first language only; never translated or invented. */
export function fallbackCopy(previous: { primaryText: string | null; headline: string | null } | null, languages: readonly CopyLanguage[]): CopyResult {
  const primaryText = previous?.primaryText?.trim().slice(0, COPY_LIMITS.primaryText) ?? '';
  const headline = previous?.headline?.trim().slice(0, COPY_LIMITS.headline) ?? '';
  if (!primaryText || !languages.length) return { variants: [], source: 'none' };
  return { variants: [{ language: languages[0], primaryText, headline }], source: 'previous_ad' };
}

export const COPY_SYSTEM_PROMPT = [
  'You write short Facebook and Instagram ad text for a small local business that gets clients through WhatsApp messages.',
  'Write one variant per requested language. Spanish must be natural, neutral Latin American Spanish, not a word-for-word translation.',
  'Follow Meta advertising policy: never assert or imply personal attributes of the reader (no "Are you…", "Your thinning hair…", body, health, age or ethnicity references); no before/after claims; no guarantees.',
  'Use only facts given in the input. Do not invent prices, discounts, availability, awards or reviews.',
  'Do not include links, phone numbers, emojis in headlines, or ALL CAPS words. End the primary text with a gentle invitation to send a message.',
  'Keep primary text under 300 characters (aim for 125) and headlines under 40 characters.',
].join('\n');
