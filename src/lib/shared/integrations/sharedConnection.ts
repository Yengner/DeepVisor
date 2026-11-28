/**
 * A client business's Meta connection that points at the operator's stored token. It exists for one
 * linked ad account, so nothing that reads everything the Facebook login can see (Pages, WhatsApp
 * portfolios) or changes ads may use it.
 */
export const SHARED_FROM_KEY = 'shared_from_business_id';

/** The operator business a connection borrows its token from, or null for a business's own. */
export function sharedFromBusiness(details: unknown): string | null {
  const value = details && typeof details === 'object' ? (details as Record<string, unknown>)[SHARED_FROM_KEY] : null;
  return typeof value === 'string' && value ? value : null;
}
