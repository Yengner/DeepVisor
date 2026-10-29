import { beforeEach, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  requireUser: vi.fn(), context: vi.fn(), update: vi.fn(), scope: vi.fn(),
  businessResult: vi.fn(), orgResult: vi.fn(), tag: vi.fn(), path: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidateTag: m.tag, revalidatePath: m.path }));
vi.mock('@/lib/server/actions/user/session', () => ({ requireUserId: m.requireUser }));
vi.mock('@/lib/server/actions/business/context', () => ({ getOrCreateOrganizationBusinessContext: m.context }));
vi.mock('@/lib/server/supabase/server', () => ({ createServerClient: async () => ({
  from: (table: string) => {
    const q = {
      update: (value: unknown) => { m.update(table, value); return q; },
      eq: (field: string, value: string) => { m.scope(table, field, value); return q; },
      select: () => q,
      maybeSingle: () => table === 'business_profiles' ? m.businessResult() : m.orgResult(),
      single: () => m.businessResult(),
      then: (resolve: (value: { error: null }) => unknown) => Promise.resolve({ error: null }).then(resolve),
    };
    return q;
  },
}) }));

import { updateBusinessProfileData, updateOnboardingProgress } from './onboarding';

beforeEach(() => {
  vi.clearAllMocks();
  m.requireUser.mockResolvedValue('self');
  m.context.mockResolvedValue({ userId: 'self', businessId: 'own-business', organizationId: 'own-org', organizationType: 'business', role: 'owner' });
  m.businessResult.mockResolvedValue({ data: { id: 'own-business' }, error: null });
  m.orgResult.mockResolvedValue({ data: { id: 'own-org' }, error: null });
});

it('persists allowed business fields in authenticated scope and refreshes the profile and workspace name', async () => {
  expect((await updateBusinessProfileData({ businessName: ' Salon ', industry: 'hair_salon', website: 'https://salon.example', monthlyBudget: '500_1000', description: ' Hair and beauty. ' })).success).toBe(true);
  expect(m.update).toHaveBeenCalledWith('business_profiles', { business_name: 'Salon', industry: 'hair_salon', website: 'https://salon.example', monthly_budget: '500_1000', description: 'Hair and beauty.', updated_at: expect.any(String) });
  expect(m.scope).toHaveBeenCalledWith('business_profiles', 'id', 'own-business');
  expect(m.scope).toHaveBeenCalledWith('organizations', 'id', 'own-org');
  expect(m.tag).toHaveBeenCalledWith('business-context:self', { expire: 0 });
  expect(m.path).toHaveBeenCalledWith('/', 'layout');
});
it('accepts admin edits and only updates provided fields', async () => {
  m.context.mockResolvedValueOnce({ businessId: 'own-business', organizationId: 'own-org', organizationType: 'business', role: 'admin', userId: 'self' });
  expect((await updateBusinessProfileData({ description: 'Updated description.' })).success).toBe(true);
  expect(m.update).toHaveBeenCalledTimes(1);
  expect(m.update).toHaveBeenCalledWith('business_profiles', { description: 'Updated description.', updated_at: expect.any(String) });
});
it('allows clearing optional stored values without changing onboarding blank-string validation', async () => {
  expect((await updateBusinessProfileData({ website: null, monthlyBudget: null, description: null })).success).toBe(true);
  expect(m.update).toHaveBeenCalledWith('business_profiles', { website: null, monthly_budget: null, description: null, updated_at: expect.any(String) });
  expect((await updateBusinessProfileData({ description: ' ' })).success).toBe(false);
});
it('rejects member edits before writing and rejects unauthenticated requests', async () => {
  m.context.mockResolvedValueOnce({ role: 'member' });
  const result = await updateBusinessProfileData({ businessName: 'Unauthorized' });
  expect(result.success).toBe(false); expect(m.update).not.toHaveBeenCalled();
  m.requireUser.mockRejectedValueOnce(new Error('Not authenticated'));
  expect((await updateBusinessProfileData({ businessName: 'Unauthorized' })).success).toBe(false);
  expect(m.update).not.toHaveBeenCalled();
});
it('ignores forged scope fields and always targets the authenticated business', async () => {
  const input = { businessName: 'Salon', businessId: 'foreign', organizationId: 'foreign-org' };
  expect((await updateBusinessProfileData(input)).success).toBe(true);
  expect(m.scope.mock.calls).toEqual([['business_profiles', 'id', 'own-business'], ['organizations', 'id', 'own-org']]);
});
it('does not claim a save when RLS allows no update rows', async () => {
  m.businessResult.mockResolvedValueOnce({ data: null, error: null });
  expect((await updateBusinessProfileData({ businessName: 'Salon' })).success).toBe(false);
  expect(m.update).toHaveBeenCalledTimes(1); expect(m.path).not.toHaveBeenCalled();
});
it('reports partial workspace-name failure truthfully', async () => {
  m.orgResult.mockResolvedValueOnce({ data: null, error: null });
  const result = await updateBusinessProfileData({ businessName: 'Salon' });
  expect(result.success).toBe(false);
  if (!result.success) expect(result.error.userMessage).toContain('Business details were saved');
  expect(m.path).toHaveBeenCalled();
});
it.each(['javascript:alert(1)', 'ftp://example.com', '/relative', 'https://user:password@example.com'])('rejects unsafe/malformed website %s', async website => {
  expect((await updateBusinessProfileData({ website })).success).toBe(false); expect(m.update).not.toHaveBeenCalled();
});
it.each([
  { monthlyBudget: 'unknown' }, { industry: 'invalid' }, { businessName: ' ' },
  { businessName: 'x'.repeat(201) }, { description: 'x'.repeat(4001) }, { bookingLink: 'invalid' },
])('rejects invalid profile inputs', async input => {
  expect((await updateBusinessProfileData(input)).success).toBe(false); expect(m.update).not.toHaveBeenCalled();
});

const completeEssentials = {
  business_name: 'Synthetic Nail Studio', industry: 'nail_salon',
  business_location: 'New York, NY', customer_radius: 'within_5_miles',
  preferred_contact_method: 'phone_calls',
};
it('advances with a saved profession and no legacy service selection', async () => {
  m.businessResult.mockResolvedValueOnce({ data: completeEssentials, error: null });
  expect((await updateOnboardingProgress({ step: 1 })).success).toBe(true);
  expect(m.update).toHaveBeenCalledWith('business_profiles', expect.objectContaining({ onboarding_step: 1 }));
  expect(m.scope).toHaveBeenCalledWith('business_profiles', 'id', 'own-business');
});
it.each([
  { industry: null }, { industry: 'invented' }, { business_location: '' },
  { business_name: 'Business setup' }, { customer_radius: null }, { preferred_contact_method: null },
])('still rejects genuinely incomplete essentials: %o', async missing => {
  m.businessResult.mockResolvedValueOnce({ data: { ...completeEssentials, ...missing }, error: null });
  expect((await updateOnboardingProgress({ step: 1 })).success).toBe(false);
  expect(m.update).not.toHaveBeenCalled();
});
