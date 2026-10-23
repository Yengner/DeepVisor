import { expect, it } from 'vitest';
import { buildReportFixture } from '@/lib/shared/reports/fixtures';
import { updateReportParams } from './reportNavigation';

it('retains the server-resolved account when a range changes from the default URL', () => {
  const query = { ...buildReportFixture().query, adAccountIds: ['selected-account'], campaignIds: [], adsetIds: [], adIds: [] };
  const params = updateReportParams('', query, p => p.set('date_from', '2026-10-14'));
  expect(params.get('ad_account_id')).toBe('selected-account');
  expect(params.get('scope')).toBe('ad_account');
  expect(params.get('date_from')).toBe('2026-10-14');
});
it('allows explicit filter clearing and account switching after resolving the old scope', () => {
  const query = { ...buildReportFixture().query, platformIntegrationId: 'platform', adAccountIds: ['old-account'], campaignIds: ['old-campaign'], adsetIds: ['old-set'], adIds: ['old-ad'] };
  const params = updateReportParams('', query, p => {
    p.set('ad_account_id', 'new-account');
    ['platform_integration_id', 'campaign_id', 'adset_id', 'ad_id'].forEach(key => p.delete(key));
  });
  expect(params.get('ad_account_id')).toBe('new-account');
  expect(params.get('campaign_id')).toBeNull();
  expect(params.get('scope')).toBe('ad_account');
  const cleared = updateReportParams('', query, p => {
    ['platform_integration_id', 'ad_account_id', 'campaign_id', 'adset_id', 'ad_id'].forEach(key => p.delete(key));
  });
  expect(cleared.get('scope')).toBe('business');
});
