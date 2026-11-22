/**
 * Wording for a saved lifecycle explanation, in the reader's language.
 *
 * `changes()` (in `model.ts`) saves one English sentence per change. Like `lifecycleKind`, this
 * recognises those sentences and words them from the catalog, filling in the entity name. Anything
 * it does not recognise (older rows, demo data) keeps the saved English. `explanationText.test.ts`
 * builds every sentence with `changes()` and checks each one is recognised, so a reworded sentence
 * in `model.ts` fails a test instead of quietly going back to English.
 */

/** A `useTranslations('lifecycleText')` / `getTranslations('lifecycleText')` translator, loosely typed. */
export type LifecycleTranslate = (key: string, values?: Record<string, string>) => string;

const RULES: Array<{ key: string; pattern: RegExp }> = [
  { key: 'scheduledEnd', pattern: /^The saved scheduled end has been reached\. This alone does not confirm (?:the exact time delivery|when delivery) stopped\.$/ },
  { key: 'activeAds', pattern: /^Meta now reports this advertising as active\. Delivery and results are not guaranteed\.$/ },
  { key: 'activeNamed', pattern: /^Meta now reports ([\s\S]+) as active\. Delivery and results are not guaranteed\.$/ },
  { key: 'pausedAd', pattern: /^Meta now reports this ad as paused\.$/ },
  { key: 'pausedNamed', pattern: /^Meta now reports ([\s\S]+) as paused\.$/ },
  { key: 'archivedAds', pattern: /^Meta reports this advertising as archived or deleted\.$/ },
  { key: 'archivedNamed', pattern: /^Meta reports ([\s\S]+) as archived or deleted\.$/ },
  { key: 'interrupted', pattern: /^Delivery is interrupted because ([\s\S]+) is paused\.$/ },
  { key: 'unavailable', pattern: /^Delivery eligibility changed\. The available evidence does not establish a more specific cause\.$/ },
];

/** The catalog key and values for a saved explanation, or null when it is not one `changes()` writes. */
export function recognizeExplanation(explanation: string): { key: string; values: Record<string, string> } | null {
  for (const { key, pattern } of RULES) {
    const match = pattern.exec(explanation);
    if (match) return { key, values: match[1] === undefined ? {} : { name: match[1] } };
  }
  return null;
}

export function lifecycleExplanation(explanation: string, t: LifecycleTranslate): string {
  const found = recognizeExplanation(explanation);
  return found ? t(found.key, found.values) : explanation;
}
