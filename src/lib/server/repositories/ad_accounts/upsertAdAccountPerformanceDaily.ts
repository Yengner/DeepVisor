import { chunkArray, dedupeBy, type RepositoryClient } from '../utils';

export interface UpsertAdAccountPerformanceDailyInput {
  adAccountId: string;
  day: string;
  currencyCode: string | null;
  source: string | null;
  status: string | null;
  spend: number;
  reach: number;
  impressions: number;
  clicks: number;
  inlineLinkClicks: number;
  leads: number;
  messages: number;
  syncedAt: string;
}

export async function upsertAdAccountPerformanceDaily(
  supabase: RepositoryClient,
  inputs: UpsertAdAccountPerformanceDailyInput[]
): Promise<{ count: number }> {
  const rows = dedupeBy(
    inputs.filter((input) => input.adAccountId && input.day),
    (input) => `${input.adAccountId}::${input.day}`
  );

  if (rows.length === 0) {
    return { count: 0 };
  }

  const latestByAccount = new Map<
    string,
    { currencyCode: string | null; status: string | null; syncedAt: string }
  >();

  for (const row of rows) {
    const current = latestByAccount.get(row.adAccountId);

    if (!current || row.day >= current.syncedAt.slice(0, 10)) {
      latestByAccount.set(row.adAccountId, {
        currencyCode: row.currencyCode,
        status: row.status,
        syncedAt: row.syncedAt,
      });
    }
  }

  for (const chunk of chunkArray(Array.from(latestByAccount.entries()), 200)) {
    await Promise.all(
      chunk.map(([adAccountId, row]) =>
        supabase
          .from('ad_accounts')
          .update({
            currency_code: row.currencyCode ?? undefined,
            status: row.status ?? undefined,
            updated_at: row.syncedAt,
          })
          .eq('id', adAccountId)
      )
    ).then((results) => {
      const error = results.find((result) => result.error)?.error;
      if (error) {
        throw error;
      }
    });
  }

  return { count: rows.length };
}
