/**
 * Sign-up password rules shown to the user before submit.
 * The hosted Supabase project requires lowercase, uppercase, digit and symbol
 * (observed: a long password without a symbol is rejected as "weak").
 * We also ask for 8+ characters, which is at least as strict as the hosted minimum.
 * Keep this in sync with Supabase Auth > Password requirements. Pure: no I/O.
 */

export const PASSWORD_MIN_LENGTH = 8;

/** The symbol set Supabase Auth counts for its "symbols" requirement. */
const SUPABASE_SYMBOLS = /[!@#$%^&*()_+\-=[\]{};'\\:"|<>?,./`~]/;

export type PasswordCheck = {
  key: 'length' | 'lowercase' | 'uppercase' | 'digit' | 'symbol';
  label: string;
  passed: boolean;
};

export function passwordChecks(password: string): PasswordCheck[] {
  return [
    { key: 'length', label: `At least ${PASSWORD_MIN_LENGTH} characters`, passed: password.length >= PASSWORD_MIN_LENGTH },
    { key: 'lowercase', label: 'A lowercase letter', passed: /[a-z]/.test(password) },
    { key: 'uppercase', label: 'An uppercase letter', passed: /[A-Z]/.test(password) },
    { key: 'digit', label: 'A number', passed: /\d/.test(password) },
    { key: 'symbol', label: 'A symbol (e.g. ! ? # @)', passed: SUPABASE_SYMBOLS.test(password) },
  ];
}

export function passwordMeetsPolicy(password: string): boolean {
  return passwordChecks(password).every((check) => check.passed);
}
