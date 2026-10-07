import "server-only";
import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/shared/types/supabase";
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
import type { DecisionRecords } from "./types";

type Client = SupabaseClient<Database>;
export async function allPages<T>(
  query: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 500) {
    const result = await query(from, from + 499);
    if (result.error) throw result.error;
    if (!result.data) throw new Error("Overview data unavailable");
    rows.push(...result.data);
    if (result.data.length < 500) return rows;
  }
}
async function byIds<T>(
  ids: string[],
  query: (
    ids: string[],
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let i = 0; i < ids.length; i += 100)
    rows.push(
      ...(await allPages((from, to) => query(ids.slice(i, i + 100), from, to))),
    );
  return rows;
}
const nullable = async <T>(load: () => PromiseLike<T>) => {
  try {
    return { data: await load(), failed: false };
  } catch {
    return { data: null, failed: true };
  }
};

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

/** Read-only lineage loader: complete paginated counts, no provider/execution imports. */
export async function readOverviewDecisions(
  client: Client,
  businessId: string,
  accountId: string,
  policy: Awaited<ReturnType<typeof loadOverviewPolicy>>,
): Promise<DecisionRecords> {
  const ai = client.schema("ai");
  const headers = await allPages((from, to) =>
    ai
      .from("feature_snapshots")
      .select(
        "id,business_id,platform_integration_id,ad_account_id,entity_type,entity_id,feature_schema_version,created_at",
      )
      .eq("business_id", businessId)
      .eq("ad_account_id", accountId)
      .eq("entity_type", "adset")
      .order("id")
      .range(from, to),
  );
  const snapshots = headers.map((s) => ({ ...s, feature_json: {} }));
  const runs = await byIds(
    headers.map((s) => s.id),
    (ids, from, to) =>
      ai
        .from("decision_runs")
        .select(
          "id,business_id,feature_snapshot_id,provider,provider_model,provider_version,model_version,result:decision_json->result,shadow_outcome:decision_json->shadow->shadowPolicy->>outcome,confidence,status,created_at,updated_at",
        )
        .eq("business_id", businessId)
        .in("feature_snapshot_id", ids)
        .order("id")
        .range(from, to),
  );
  const proposals = await byIds(
    runs.map((r) => r.id),
    (ids, from, to) =>
      ai
        .from("action_proposals")
        .select(
          "id,business_id,decision_run_id,action_type,target_entity_type,target_entity_id,risk_level,policy_result_json,requires_approval,status,created_at,updated_at,current_budget:current_state_json->budgetMinor,target_budget:proposed_state_json->targetBudgetMinor,budget:proposed_state_json->budgetMinor",
        )
        .eq("business_id", businessId)
        .in("decision_run_id", ids)
        .order("id")
        .range(from, to),
  );
  const executions = await byIds(
    proposals.map((p) => p.id),
    (ids, from, to) =>
      ai
        .from("executed_actions")
        .select(
          "id,business_id,action_proposal_id,status,error_json,created_at,started_at,completed_at",
        )
        .eq("business_id", businessId)
        .in("action_proposal_id", ids)
        .order("id")
        .range(from, to),
  );
  // Keep bulk history lightweight; full feature windows are needed only for the
  // latest check per entity and outstanding attention, never provider payloads.
  const latestByEntity = new Map<string, string>();
  const snapshotById = new Map(headers.map((s) => [s.id, s]));
  for (const run of [...runs].sort(
    (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at),
  )) {
    const entity = snapshotById.get(run.feature_snapshot_id)?.entity_id;
    if (entity && !latestByEntity.has(entity))
      latestByEntity.set(entity, run.feature_snapshot_id);
  }
  const outstandingRuns = new Set(
    proposals
      .filter(
        (p) =>
          ["pending", "approved"].includes(p.status) ||
          executions.some(
            (e) => e.action_proposal_id === p.id && e.status === "failed",
          ),
      )
      .map((p) => p.decision_run_id),
  );
  const featureIds = [
    ...new Set([
      ...latestByEntity.values(),
      ...runs
        .filter((r) => outstandingRuns.has(r.id))
        .map((r) => r.feature_snapshot_id),
    ]),
  ];
  const [features, shadow, automatic, outcomes] = await Promise.all([
    byIds(featureIds, (ids, from, to) =>
      ai
        .from("feature_snapshots")
        .select("*")
        .eq("business_id", businessId)
        .eq("ad_account_id", accountId)
        .in("id", ids)
        .order("id")
        .range(from, to),
    ),
    nullable(() =>
      allPages((from, to) =>
        ai
          .from("shadow_evaluation_jobs")
          .select("decision_run_id")
          .eq("business_id", businessId)
          .eq("ad_account_id", accountId)
          .order("id")
          .range(from, to),
      ),
    ),
    nullable(() =>
      byIds(
        headers.map((s) => s.id),
        (ids, from, to) =>
          ai
            .from("limited_auto_evaluations")
            .select("decision_run_id")
            .eq("business_id", businessId)
            .in("source_snapshot_id", ids)
            .order("source_snapshot_id")
            .range(from, to),
      ),
    ),
    nullable(async () => {
      const columns =
        "id,executed_action_id,shadow_decision_run_id,source_kind,measurement_status,measured_at,measurement_horizon_hours" as const;
      const [actual, observed] = await Promise.all([
        byIds(
          executions.map((e) => e.id),
          (ids, from, to) =>
            ai
              .from("action_outcomes")
              .select(columns)
              .eq("business_id", businessId)
              .in("executed_action_id", ids)
              .eq("measurement_status", "complete")
              .order("id")
              .range(from, to),
        ),
        byIds(
          runs.map((r) => r.id),
          (ids, from, to) =>
            ai
              .from("action_outcomes")
              .select(columns)
              .eq("business_id", businessId)
              .in("shadow_decision_run_id", ids)
              .eq("measurement_status", "complete")
              .order("id")
              .range(from, to),
        ),
      ]);
      return [...actual, ...observed];
    }),
  ]);
  const full = new Map(features.map((s) => [s.id, s]));
  return {
    snapshots: snapshots.map((s) => full.get(s.id) ?? s),
    runs: runs.map(({ result, shadow_outcome, ...r }) => ({
      ...r,
      decision_json: {
        result,
        shadow: { shadowPolicy: { outcome: shadow_outcome } },
      },
      provider_response_json: null,
    })),
    proposals: proposals.map(
      ({ current_budget, target_budget, budget, ...p }) => ({
        ...p,
        current_state_json: { budgetMinor: current_budget },
        proposed_state_json: {
          targetBudgetMinor: target_budget,
          budgetMinor: budget,
        },
      }),
    ),
    executions,
    outcomes: outcomes.data ?? [],
    outcomesUnavailable: outcomes.failed,
    shadowRunIds: (shadow.data ?? []).map((j) => j.decision_run_id),
    autoRunIds: (automatic.data ?? []).flatMap((j) =>
      j.decision_run_id ? [j.decision_run_id] : [],
    ),
    provenanceUnavailable: shadow.failed || automatic.failed,
    policy: policy.data,
    policyUnavailable: policy.failed,
  };
}
export const loadOverviewDecisions = cache(
  async (businessId: string, accountId: string) =>
    readOverviewDecisions(
      createAdminClient(),
      businessId,
      accountId,
      await loadOverviewPolicy(businessId),
    ),
);
