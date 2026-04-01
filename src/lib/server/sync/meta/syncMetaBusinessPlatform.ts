import 'server-only';

import type { RepositoryClient } from '@/lib/server/repositories/utils';
import { syncMetaAdAccounts } from './syncMetaAdAccounts';
import { syncMetaAdCreatives } from './syncMetaAdCreatives';
import { syncMetaAds } from './syncMetaAds';
import { syncMetaAdsets } from './syncMetaAdsets';
import { syncMetaCampaigns } from './syncMetaCampaigns';
import { syncMetaPerformance } from './syncMetaPerformance';

export async function syncMetaBusinessPlatform(input: {
  supabase: RepositoryClient;
  businessId: string;
  platformId: string;
  platformIntegrationId: string;
  accessToken: string;
  backfillDays: number;
  syncedAt: string;
  primaryExternalAccountId: string;
}) {
  const adAccounts = await syncMetaAdAccounts({
    supabase: input.supabase,
    businessId: input.businessId,
    platformId: input.platformId,
    accessToken: input.accessToken,
    syncedAt: input.syncedAt,
    primaryExternalAccountId: input.primaryExternalAccountId,
  });

  const campaigns = await syncMetaCampaigns({
    supabase: input.supabase,
    adAccounts: adAccounts.rows,
    accessToken: input.accessToken,
    syncedAt: input.syncedAt,
  });

  const adsets = await syncMetaAdsets({
    supabase: input.supabase,
    adAccounts: adAccounts.rows,
    campaignsByExternalId: campaigns.byExternalId,
    accessToken: input.accessToken,
    syncedAt: input.syncedAt,
  });

  const ads = await syncMetaAds({
    supabase: input.supabase,
    adAccounts: adAccounts.rows,
    campaignsByExternalId: campaigns.byExternalId,
    adsetsByExternalId: adsets.byExternalId,
    accessToken: input.accessToken,
    syncedAt: input.syncedAt,
  });

  const creatives = await syncMetaAdCreatives({
    supabase: input.supabase,
    businessId: input.businessId,
    platformIntegrationId: input.platformIntegrationId,
    adAccounts: adAccounts.rows,
    ads: ads.rows,
    adsetsByExternalId: adsets.byExternalId,
    campaignsByExternalId: campaigns.byExternalId,
    accessToken: input.accessToken,
    syncedAt: input.syncedAt,
  });

  const performance = await syncMetaPerformance({
    supabase: input.supabase,
    adAccounts: adAccounts.rows,
    campaignsByExternalId: campaigns.byExternalId,
    adsetsByExternalId: adsets.byExternalId,
    adsByExternalId: ads.byExternalId,
    accessToken: input.accessToken,
    backfillDays: input.backfillDays,
    syncedAt: input.syncedAt,
  });

  return {
    adAccounts: adAccounts.count,
    campaignDims: campaigns.count,
    adsetDims: adsets.count,
    adDims: ads.count,
    ...creatives,
    ...performance,
  };
}
