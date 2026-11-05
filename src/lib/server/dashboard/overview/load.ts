import "server-only";
import { allPages, readPagesByIds as byIds } from '../../repositories/pagination';
import { readOverviewDecisions, nullable } from './decisionRecords';
import { cache } from "react";
import { getRequiredAppContext } from "../../actions/app/context";
import { resolveCurrentSelection } from "../../actions/app/selection";
import { createAdminClient } from "../../supabase/admin";
import {
  getCachedAdAccountShellData,
  getCachedPlatformDetails,
} from "../cache";
import { getAdAccountSyncCoverage } from "../../repositories/ad_accounts/syncState";
import { getAutonomyPolicy } from "../../decisions/repository";
import { dayInZone, shiftDay } from "./model";

// Compatibility for callers of the former combined loader.
export { allPages } from "../../repositories/pagination";
export { readOverviewDecisions } from "./decisionRecords";

export const loadOverviewContext = cache(async () => {
  const context = await getRequiredAppContext();
  const client = createAdminClient();
  const [selection, profile] = await Promise.all([
    resolveCurrentSelection(context.businessId),
    client
      .from("business_profiles")
      .select("business_name,target_cost_per_lead")
      .eq("id", context.businessId)
      .single(),
  ]);
  const [platform, account] = await Promise.all([
    selection.selectedPlatformId
      ? getCachedPlatformDetails(
          context.user.id,
          selection.selectedPlatformId,
          context.businessId,
        )
      : null,
    selection.selectedPlatformId && selection.selectedAdAccountId
      ? getCachedAdAccountShellData(
          context.user.id,
          selection.selectedAdAccountId,
          selection.selectedPlatformId,
          context.businessId,
        )
      : null,
  ]);
  const now = new Date().toISOString();
  let zone = account?.timezone ?? "UTC";
  let timezoneUnavailable = !account?.timezone;
  try {
    dayInZone(now, zone);
  } catch {
    zone = "UTC";
    timezoneUnavailable = true;
  }
  return {
    businessId: context.businessId,
    businessName: profile.data?.business_name || "Your business",
    target: profile.data?.target_cost_per_lead ?? null,
    profileUnavailable: !!profile.error,
    account,
    platform,
    now,
    zone,
    timezoneUnavailable,
    today: dayInZone(now, zone),
  };
});
export type OverviewContext = Awaited<ReturnType<typeof loadOverviewContext>>;

export const loadOverviewEntities = cache(
  async (businessId: string, accountId: string) =>
    allPages((from, to) =>
      createAdminClient()
        .from("ad_entities")
        .select("id,external_id,name,status")
        .eq("business_id", businessId)
        .eq("ad_account_id", accountId)
        .eq("entity_level", "adset")
        .order("id")
        .range(from, to),
    ),
);
export const loadOverviewDaily = cache(
  async (businessId: string, accountId: string, today: string) => {
    // Only dimension IDs from the authorized account can enter the performance model.
    const entities = await loadOverviewEntities(businessId, accountId);
    const rows = await byIds(
      entities.map((e) => e.id),
      (ids, from, to) =>
        createAdminClient()
          .from("ad_entity_performance_daily")
          .select(
            "entity_id,day,currency_code,spend,leads,messages,calls,impressions,clicks,reach,inline_link_clicks",
          )
          .eq("ad_account_id", accountId)
          .in("entity_id", ids)
          .eq("entity_level", "adset")
          .gte("day", shiftDay(today, -29))
          .lte("day", today)
          .order("day")
          .order("entity_id")
          .range(from, to),
    );
    const ids = new Set(entities.map((e) => e.id));
    return rows.filter((row) => ids.has(row.entity_id));
  },
);
export const loadOverviewPolicy = cache((businessId: string) =>
  nullable(() => getAutonomyPolicy(createAdminClient(), businessId)),
);

/** Shared daily history for account comparisons and the bounded advertising board. */
export const loadOverviewHistory = cache(async (businessId: string, accountId: string, today: string) => {
  const entities = await loadOverviewEntities(businessId, accountId);
  const [recent, older] = await Promise.all([
    loadOverviewDaily(businessId, accountId, today),
    byIds(entities.map(e => e.id), (ids, from, to) => createAdminClient()
      .from('ad_entity_performance_daily')
      .select('entity_id,day,currency_code,spend,leads,messages,calls,impressions,clicks,reach,inline_link_clicks')
      .eq('ad_account_id', accountId).eq('entity_level', 'adset').in('entity_id', ids)
      .gte('day', shiftDay(today, -60)).lte('day', shiftDay(today, -30))
      .order('day').order('entity_id').range(from, to)),
  ]);
  const ids = new Set(entities.map(e => e.id));
  return [...older, ...recent].filter(r => ids.has(r.entity_id));
});
export const loadOverviewSync = cache((businessId: string, accountId: string) =>
  nullable(async () => {
    const client = createAdminClient();
    const account = await client
      .from("ad_accounts")
      .select("id")
      .eq("business_id", businessId)
      .eq("id", accountId)
      .single();
    if (account.error) throw account.error;
    return getAdAccountSyncCoverage(client, accountId);
  }),
);

export const loadOverviewDecisions = cache(
  async (businessId: string, accountId: string) =>
    readOverviewDecisions(
      createAdminClient(),
      businessId,
      accountId,
      await loadOverviewPolicy(businessId),
    ),
);
