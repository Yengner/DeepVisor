import { beforeEach, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  requireUser: vi.fn(), context: vi.fn(), update: vi.fn(), scope: vi.fn(),
  businessResult: vi.fn(), orgResult: vi.fn(), sourcesResult: vi.fn(), tag: vi.fn(), path: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidateTag: m.tag, revalidatePath: m.path }));
vi.mock('@/lib/server/actions/user/session', () => ({ requireUserId: m.requireUser }));
vi.mock('@/lib/server/actions/business/context', () => ({ getOrCreateOrganizationBusinessContext: m.context }));
vi.mock('@/lib/server/supabase/server', () => ({ createServerClient: async () => ({
  from: (table: string) => {
    let columns = '';
    const q = {
      update: (value: unknown) => { m.update(table, value); return q; },
      eq: (field: string, value: string) => { m.scope(table, field, value); return q; },
      select: (selected = '') => { columns = selected; return q; },
      maybeSingle: () => table === 'business_profiles' ? m.businessResult() : m.orgResult(),
      single: () => columns === 'field_sources' ? m.sourcesResult() : m.businessResult(),
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
  m.sourcesResult.mockResolvedValue({ data: { field_sources: {} }, error: null });
});

const userSource = { source: 'user', updated_at: expect.any(String) };

it('persists allowed business fields in authenticated scope and refreshes the profile and workspace name', async () => {
  expect((await updateBusinessProfileData({ businessName: ' Salon ', industry: 'hair_salon', website: 'https://salon.example', monthlyBudget: '500_1000', description: ' Hair and beauty. ' })).success).toBe(true);
  expect(m.update).toHaveBeenCalledWith('business_profiles', {
    business_name: 'Salon', industry: 'hair_salon', website: 'https://salon.example', monthly_budget: '500_1000', description: 'Hair and beauty.',
    field_sources: { business_name: userSource, industry: userSource, website: userSource, monthly_budget: userSource, description: userSource },
    updated_at: expect.any(String),
  });
  expect(m.scope).toHaveBeenCalledWith('business_profiles', 'id', 'own-business');
  expect(m.scope).toHaveBeenCalledWith('organizations', 'id', 'own-org');
  expect(m.tag).toHaveBeenCalledWith('business-context:self', { expire: 0 });
  expect(m.path).toHaveBeenCalledWith('/', 'layout');
});
it('accepts admin edits and only updates provided fields', async () => {
  m.context.mockResolvedValueOnce({ businessId: 'own-business', organizationId: 'own-org', organizationType: 'business', role: 'admin', userId: 'self' });
  expect((await updateBusinessProfileData({ description: 'Updated description.' })).success).toBe(true);
  expect(m.update).toHaveBeenCalledTimes(1);
  expect(m.update).toHaveBeenCalledWith('business_profiles', { description: 'Updated description.', field_sources: { description: userSource }, updated_at: expect.any(String) });
});
it('allows clearing optional stored values without changing onboarding blank-string validation', async () => {
  expect((await updateBusinessProfileData({ website: null, monthlyBudget: null, description: null })).success).toBe(true);
  expect(m.update).toHaveBeenCalledWith('business_profiles', expect.objectContaining({ website: null, monthly_budget: null, description: null }));
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
  expect(m.scope.mock.calls).toEqual([['business_profiles', 'id', 'own-business'], ['business_profiles', 'id', 'own-business'], ['organizations', 'id', 'own-org']]);
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
  preferred_contact_method: 'phone_calls', onboarding_completed_at: null,
};
it('advances with a saved profession and no legacy service selection', async () => {
  m.businessResult.mockResolvedValueOnce({ data: completeEssentials, error: null });
  expect((await updateOnboardingProgress({ step: 1 })).success).toBe(true);
  expect(m.update).toHaveBeenCalledWith('business_profiles', expect.objectContaining({ onboarding_step: 1 }));
  expect(m.scope).toHaveBeenCalledWith('business_profiles', 'id', 'own-business');
});
it.each([
  { industry: null }, { industry: 'invented' }, { business_location: '' },
  { business_name: 'Business setup' }, { preferred_contact_method: null },
])('still rejects genuinely incomplete essentials: %o', async missing => {
  m.businessResult.mockResolvedValueOnce({ data: { ...completeEssentials, ...missing }, error: null });
  expect((await updateOnboardingProgress({ step: 1 })).success).toBe(false);
  expect(m.update).not.toHaveBeenCalled();
});

it('keeps earlier sources and stamps only newly written columns', async () => {
  m.sourcesResult.mockResolvedValueOnce({ data: { field_sources: { industry: { source: 'user', updated_at: '2026-11-01T00:00:00.000Z' } } }, error: null });
  expect((await updateBusinessProfileData({ website: 'https://bayside.example' })).success).toBe(true);
  expect(m.update).toHaveBeenCalledWith('business_profiles', expect.objectContaining({
    field_sources: { industry: { source: 'user', updated_at: '2026-11-01T00:00:00.000Z' }, website: userSource },
  }));
});
it('fails without writing when current sources cannot be read', async () => {
  m.sourcesResult.mockResolvedValueOnce({ data: null, error: { message: 'read failed' } });
  expect((await updateBusinessProfileData({ website: 'https://bayside.example' })).success).toBe(false);
  expect(m.update).not.toHaveBeenCalled();
});
it('saves a structured service-area location and rebuilds the display location', async () => {
  expect((await updateBusinessProfileData({
    industry: 'plumbing', locationMode: 'service_area', locationCity: ' Tampa ', locationRegion: 'FL', locationCountry: 'us',
  })).success).toBe(true);
  expect(m.update).toHaveBeenCalledWith('business_profiles', expect.objectContaining({
    industry: 'plumbing', location_mode: 'service_area', location_street: null, location_city: 'Tampa',
    location_region: 'FL', location_postal_code: null, location_country: 'US', business_location: 'Tampa, FL, US',
  }));
});
it('clears structured parts when only a free-text location is saved', async () => {
  expect((await updateBusinessProfileData({ businessLocation: '123 Main St, Tampa, FL' })).success).toBe(true);
  expect(m.update).toHaveBeenCalledWith('business_profiles', expect.objectContaining({
    business_location: '123 Main St, Tampa, FL', location_mode: null, location_city: null, location_country: null,
  }));
});
it.each([
  { locationMode: 'mobile', locationCity: 'Tampa', locationRegion: 'FL', locationCountry: 'US' },
  { locationMode: 'storefront', locationRegion: 'FL', locationCountry: 'US' },
  { locationMode: 'storefront', locationCity: 'Tampa', locationRegion: 'FL', locationCountry: 'USA' },
  { locationMode: 'storefront', locationCity: 'Tampa', locationRegion: 'FL', locationCountry: 'US', locationPostalCode: '9'.repeat(21) },
])('rejects invalid structured locations: %o', async input => {
  expect((await updateBusinessProfileData(input)).success).toBe(false); expect(m.update).not.toHaveBeenCalled();
});
it('advances a non-beauty business without a customer radius', async () => {
  m.businessResult.mockResolvedValueOnce({ data: { ...completeEssentials, industry: 'plumbing', customer_radius: null }, error: null });
  expect((await updateOnboardingProgress({ step: 1 })).success).toBe(true);
});
it('stamps the first completion time only once', async () => {
  m.businessResult.mockResolvedValueOnce({ data: completeEssentials, error: null });
  expect((await updateOnboardingProgress({ step: 2, completed: true })).success).toBe(true);
  expect(m.update).toHaveBeenLastCalledWith('business_profiles', expect.objectContaining({ onboarding_completed: true, onboarding_completed_at: expect.any(String) }));
  m.businessResult.mockResolvedValueOnce({ data: { ...completeEssentials, onboarding_completed_at: '2026-11-01T00:00:00.000Z' }, error: null });
  expect((await updateOnboardingProgress({ step: 2, completed: true })).success).toBe(true);
  expect(m.update.mock.lastCall?.[1]).not.toHaveProperty('onboarding_completed_at');
});
