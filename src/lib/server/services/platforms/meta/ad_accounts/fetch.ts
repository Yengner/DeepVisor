import 'server-only';

import { AdAccount, FacebookAdsApi } from '@/lib/server/sdk/client';
import type { AdAccountDetails } from '../types';

type MetaAdAccountsResponse = {
  data?: AdAccountDetails[];
  paging?: {
    next?: string;
  };
  error?: {
    message?: string;
  };
};

async function fetchAllMetaAdAccountDetails(accessToken: string): Promise<AdAccountDetails[]> {
  let nextUrl: URL | null = new URL('https://graph.facebook.com/v23.0/me/adaccounts');
  nextUrl.searchParams.set('fields', [
    AdAccount.Fields.id,
    AdAccount.Fields.name,
    AdAccount.Fields.account_status,
    AdAccount.Fields.currency,
    AdAccount.Fields.timezone_name,
  ].join(','));
  nextUrl.searchParams.set('limit', '200');
  nextUrl.searchParams.set('access_token', accessToken);

  const rows: AdAccountDetails[] = [];

  while (nextUrl) {
    const response = await fetch(nextUrl);
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as MetaAdAccountsResponse;
      throw new Error(body.error?.message || 'Failed to fetch Meta ad accounts');
    }

    const body = (await response.json()) as MetaAdAccountsResponse;
    rows.push(...(body.data ?? []));
    nextUrl = body.paging?.next ? new URL(body.paging.next) : null;
  }

  return rows;
}

export async function fetchMetaAdAccounts(
  accessToken: string,
  adAccountId?: string
): Promise<AdAccountDetails | AdAccountDetails[]> {
  FacebookAdsApi.init(accessToken);

  if (adAccountId) {
    const account = await new AdAccount(adAccountId).read([
      'id',
      'name',
      'account_status',
      'currency',
      'timezone_name',
    ]);

    return account._data as AdAccountDetails;
  }

  return fetchAllMetaAdAccountDetails(accessToken);
}
