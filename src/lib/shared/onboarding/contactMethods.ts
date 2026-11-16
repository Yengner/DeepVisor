import { CONTACT_METHOD_OPTIONS, isAllowedOption } from './businessProfileOptions';

/**
 * Rules for "how customers reach you". `contact_methods` lists every way;
 * `preferred_contact_method` is the main one (campaign defaults read it). Pure: no I/O.
 */

export const NOT_SURE_CONTACT_METHOD = 'not_sure';

export type ContactSelection = {
  contactMethods: string[];
  preferredContactMethod: string;
};

/** Allowed, de-duplicated values in option order. */
export function normalizeContactMethods(values: readonly string[] | null | undefined): string[] {
  const chosen = new Set((values ?? []).filter((value) => isAllowedOption(value, CONTACT_METHOD_OPTIONS)));
  return CONTACT_METHOD_OPTIONS.map((option) => option.value).filter((value) => chosen.has(value));
}

/**
 * Validates a full selection. One method is its own main method; several need an
 * explicit main one; "Not sure" cannot be combined with real methods.
 */
export function resolveContactSelection(
  methods: readonly string[] | null | undefined,
  main: string | null | undefined
): ContactSelection | { error: string } {
  const raw = methods ?? [];
  if (raw.some((value) => !isAllowedOption(value, CONTACT_METHOD_OPTIONS))) {
    return { error: 'One of the contact methods is invalid.' };
  }
  const contactMethods = normalizeContactMethods(raw);
  if (contactMethods.length === 0) return { error: 'Choose how customers usually reach you.' };
  if (contactMethods.includes(NOT_SURE_CONTACT_METHOD) && contactMethods.length > 1) {
    return { error: '"Not sure yet" cannot be combined with other contact methods.' };
  }
  if (contactMethods.length === 1) {
    return { contactMethods, preferredContactMethod: contactMethods[0] };
  }
  if (!main || !contactMethods.includes(main)) {
    return { error: 'Choose which contact method brings the most customers.' };
  }
  return { contactMethods, preferredContactMethod: main };
}

/** Stored list, or the single legacy preferred method for rows saved before the list existed. */
export function contactMethodsForDisplay(
  stored: readonly string[] | null | undefined,
  preferred: string | null | undefined
): string[] {
  const list = normalizeContactMethods(stored);
  if (list.length > 0) return list;
  return preferred && isAllowedOption(preferred, CONTACT_METHOD_OPTIONS) ? [preferred] : [];
}

/** Keeps the list consistent when only the main method is changed (e.g. from Settings). */
export function withPreferredContactMethod(
  stored: readonly string[] | null | undefined,
  preferred: string
): string[] {
  const list = normalizeContactMethods(stored);
  if (preferred === NOT_SURE_CONTACT_METHOD) return [NOT_SURE_CONTACT_METHOD];
  const real = list.filter((value) => value !== NOT_SURE_CONTACT_METHOD);
  return normalizeContactMethods(real.includes(preferred) ? real : [...real, preferred]);
}
