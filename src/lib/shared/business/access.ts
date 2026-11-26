export type BusinessRole = 'owner' | 'admin' | 'member';

/** Owners and admins manage a business: its Meta connection, ad account and settings. */
export function canManageBusiness(role: BusinessRole): boolean {
  return role === 'owner' || role === 'admin';
}
