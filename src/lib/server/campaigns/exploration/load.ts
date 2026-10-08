import "server-only";
import { cache } from "react";
import { createAdminClient } from "../../supabase/admin";
import {
  allPages,
  loadOverviewContext,
  loadOverviewHistory,
  loadOverviewDecisions,
} from "../../dashboard/overview/load";
import {
  decisionViews,
  periodRange,
  shiftDay,
} from "../../dashboard/overview/model";
import {
  aggregate,
  comparisons,
  complete,
  mediaFor,
  rank,
  trend,
} from "./model";
import type {
  Creative,
  Daily,
  ExplorationEntity,
  ExplorationView,
  Period,
  Summary,
} from "./types";
import type { OverviewContext } from "../../dashboard/overview/load";
import type { UnitState } from "../../dashboard/overview/types";
import { selectBoardAdvertising } from "../../dashboard/overview/controlModel";
import { deliveryStatuses } from "./delivery";

export class ExplorationNotFound extends Error {}
type Client = ReturnType<typeof createAdminClient>;
const entityFields =
  "id,external_id,name,status,entity_level,parent_external_id,creative_external_id,raw,updated_at";
type Entity = Pick<
  ExplorationEntity,
  | "id"
  | "external_id"
  | "name"
  | "status"
  | "entity_level"
  | "parent_external_id"
  | "creative_external_id"
  | "raw"
  | "updated_at"
>;
async function batches<T>(
  ids: string[],
  read: (ids: string[]) => Promise<T[]>,
): Promise<T[]> {
  const result: T[] = [];
  for (let i = 0; i < ids.length; i += 100)
    result.push(...(await read(ids.slice(i, i + 100))));
  return result;
}
function entities(client: Client, context: OverviewContext) {
  return client
    .from("ad_entities")
    .select(entityFields)
    .eq("business_id", context.businessId)
    .eq("ad_account_id", context.account!.id)
    .eq("platform_integration_id", context.platform!.id);
}
const daily = cache(
  async (
    context: OverviewContext,
    level: string,
    idsKey: string,
    until = context.today,
  ) => {
    const client = createAdminClient();
    return batches(idsKey ? idsKey.split(",") : [], (ids) =>
      allPages((from, to) =>
        client
          .from("ad_entity_performance_daily")
          .select(
            "entity_id,day,currency_code,spend,leads,messages,calls,impressions,clicks,reach,inline_link_clicks",
          )
          .eq("ad_account_id", context.account!.id)
          .eq("entity_level", level)
          .in("entity_id", ids)
          .gte("day", shiftDay(context.today, -60))
          .lte("day", until)
          .order("entity_id")
          .order("day")
          .range(from, to),
      ),
    );
  },
);
function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function budget(
  unit: Entity,
  campaign: Entity | null,
  currency: string | null,
) {
  if (!currency) return { budget: null, budgetAsOf: null };
  const owners = [campaign, unit].filter(
    (entity) =>
      entity &&
      ["daily_budget", "lifetime_budget"].some(
        (key) => Number(record(entity.raw)[key]) > 0,
      ),
  );
  if (owners.length !== 1) return { budget: null, budgetAsOf: null };
  for (const entity of [campaign, unit]) {
    if (!entity) continue;
    const raw = record(entity.raw);
    for (const key of ["daily_budget", "lifetime_budget"]) {
      const minor =
        typeof raw[key] === "string" && /^\d+$/.test(raw[key] as string)
          ? Number(raw[key])
          : raw[key];
      if (
        typeof minor !== "number" ||
        !Number.isSafeInteger(minor) ||
        minor <= 0
      )
        continue;
      // Meta budgets use currency minor units, including zero-decimal currencies.
      const formatter = new Intl.NumberFormat("en", {
        style: "currency",
        currency,
      });
      const digits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
      return {
        budget: `${formatter.format(minor / 10 ** digits)} ${key === "daily_budget" ? "daily" : "lifetime"} · ${entity === campaign ? "Campaign" : "Ad set"} budget`,
        budgetAsOf: entity.updated_at,
      };
    }
  }
  return { budget: null, budgetAsOf: null };
}

/** Only authorized entity IDs enter daily or creative queries. No provider or execution imports. */
export const loadExploration = cache(
  async (
    period: Period,
    level: "campaign" | "adset" | "ad",
    parentId: string | null = null,
    overview = false,
  ): Promise<ExplorationView> => {
    const context = await loadOverviewContext();
    if (!context.account || context.platform?.vendor !== "meta")
      throw new ExplorationNotFound("Select a Meta account");
    const client = createAdminClient(),
      warnings: string[] = [];
    const pulse: ExplorationView["pulse"] = [];
    let parent: Entity | null = null;
    if (parentId) {
      const result = await entities(client, context)
        .eq("external_id", parentId)
        .eq("entity_level", level === "ad" ? "adset" : "campaign")
        .maybeSingle();
      if (result.error) throw result.error;
      if (!result.data) throw new ExplorationNotFound("Entity unavailable");
      parent = result.data;
    }
    if (level === "ad" && !parent)
      throw new ExplorationNotFound("Ad set required");
    const units = await allPages((from, to) => {
      let query = entities(client, context).eq("entity_level", level);
      if (parent) query = query.eq("parent_external_id", parent.external_id);
      return query.order("id").range(from, to);
    });
    const hierarchy = level === "campaign" ? units : await allPages((from, to) =>
      client.from("ad_entities")
        .select("external_id,parent_external_id,entity_level,status,raw")
        .eq("business_id", context.businessId)
        .eq("platform_integration_id", context.platform!.id)
        .eq("ad_account_id", context.account!.id)
        .order("id").range(from, to),
    );
    const delivery = deliveryStatuses(hierarchy, context.now);
    const [rows, decisions] = await Promise.all([
      overview
        ? loadOverviewHistory(
            context.businessId,
            context.account.id,
            context.today,
          ).then((rows) =>
            rows.filter((row) => units.some((u) => u.id === row.entity_id)),
          )
        : daily(
            context,
            level,
            units
              .map((u) => u.id)
              .sort()
              .join(","),
          ),
      level !== "campaign"
        ? loadOverviewDecisions(context.businessId, context.account.id).catch(
            (error) => {
              console.error("Exploration decision evidence unavailable", error);
              warnings.push(
                "Decision evidence is unavailable. Performance can still be explored.",
              );
              return null;
            },
          )
        : null,
    ]);
    const currency =
      context.account.currency_code &&
      /^[A-Z]{3}$/.test(context.account.currency_code)
        ? context.account.currency_code
        : null;
    const range = periodRange(period, context.today);
    const evaluatedEntities = level === "ad" ? [parent!] : units;
    const decisionView = decisions
      ? decisionViews({
          data: decisions,
          entities: evaluatedEntities,
          businessId: context.businessId,
          accountId: context.account.id,
          now: context.now,
          zone: context.zone,
        })
      : null;
    function summary(
      entity: Entity,
      facts: Daily[],
      state?: UnitState,
    ): Summary {
      const selected = facts.filter(
        (r) => r.day >= range.since && r.day <= range.until,
      );
      return {
        id: entity.external_id,
        name:
          entity.name ||
          (entity.entity_level === "adset"
            ? "Ad set unavailable"
            : entity.entity_level === "ad"
              ? "Ad unavailable"
              : "Campaign unavailable"),
        delivery: delivery.get(`${entity.entity_level}:${entity.external_id}`) ?? "UNKNOWN",
        level: entity.entity_level as Summary["level"],
        state:
          entity.entity_level === "adset"
            ? (state ??
              (entity.status?.trim().toUpperCase() === "PAUSED" ? "Paused" : "Insufficient data"))
            : null,
        metrics: aggregate(selected, currency),
        complete: complete(selected, range.since, range.until, currency),
        deltas: comparisons(facts, period, context.today, currency),
        media: [],
        leader: false,
        tied: false,
      };
    }
    let items = rank(
      units.map((u) =>
        summary(
          u,
          rows.filter((r) => r.entity_id === u.id),
          decisionView?.states.get(u.id),
        ),
      ),
    );
    let board: ExplorationView["board"];
    if (overview) {
      const attentionIds = (decisionView?.allAttention ?? []).flatMap((a) => {
        const unit = units.find(
          (u) => u.id === a.entityId || u.external_id === a.entityId,
        );
        return unit ? [unit.external_id] : [];
      });
      const selection = selectBoardAdvertising(
        items,
        attentionIds,
        rows,
        units,
        period,
        context.today,
      );
      items = selection.items;
      board = selection.board;
    }
    // Load media only for the visible hierarchy. Overview never loads every ad's daily history.
    try {
      let ads = level === "ad" ? units : [];
      if (level === "adset")
        ads = await batches(
          items.map((i) => i.id),
          (ids) =>
            allPages((from, to) =>
              entities(client, context)
                .eq("entity_level", "ad")
                .in("parent_external_id", ids)
                .order("id")
                .range(from, to),
            ),
        );
      if (level === "campaign") {
        const children = await batches(
          items.map((i) => i.id),
          (ids) =>
            allPages((from, to) =>
              entities(client, context)
                .eq("entity_level", "adset")
                .in("parent_external_id", ids)
                .order("id")
                .range(from, to),
            ),
        );
        const campaignBySet = new Map(
          children.map((c) => [c.external_id, c.parent_external_id]),
        );
        ads = (
          await batches(
            children.map((c) => c.external_id),
            (ids) =>
              allPages((from, to) =>
                entities(client, context)
                  .eq("entity_level", "ad")
                  .in("parent_external_id", ids)
                  .order("id")
                  .range(from, to),
              ),
          )
        ).map((ad) => ({
          ...ad,
          parent_external_id: campaignBySet.get(ad.parent_external_id!) ?? null,
        }));
      }
      const creativeIds = [
        ...new Set(
          ads.flatMap((a) =>
            a.creative_external_id ? [a.creative_external_id] : [],
          ),
        ),
      ];
      const creatives = await batches(creativeIds, (ids) =>
        allPages((from, to) =>
          client
            .from("ad_creatives")
            .select("*")
            .eq("business_id", context.businessId)
            .eq("ad_account_id", context.account!.id)
            .eq("platform_integration_id", context.platform!.id)
            .in("platform_creative_id", ids)
            .order("id")
            .range(from, to),
        ),
      );
      const byId = new Map<string, Creative>(
        creatives.map((c) => [c.platform_creative_id, c]),
      );
      items = items.map((item) => {
        const related = ads.filter((a) =>
          (level === "ad"
            ? a.external_id === item.id
            : a.parent_external_id === item.id) &&
          (!(overview && item.delivery === "ACTIVE") || delivery.get(`ad:${a.external_id}`) === "ACTIVE"),
        );
        const media = [
          ...new Set(related.map((a) => a.creative_external_id)),
        ].flatMap((id) =>
          id && byId.has(id) ? [mediaFor(byId.get(id)!)] : [],
        );
        return { ...item, media: media.slice(0, level === "ad" ? 1 : 3) };
      });
      // A bounded pulse, never an account-wide creative-library or history load.
      // Large sets are omitted rather than ranking an arbitrary incomplete sample.
      if (overview && ads.length > 0 && ads.length <= 50) {
        const pulseRows = await batches(
          ads.map((a) => a.id),
          (ids) =>
            allPages((from, to) =>
              client
                .from("ad_entity_performance_daily")
                .select(
                  "entity_id,day,currency_code,spend,leads,messages,calls,impressions,clicks,reach,inline_link_clicks",
                )
                .eq("ad_account_id", context.account!.id)
                .eq("entity_level", "ad")
                .in("entity_id", ids)
                .gte("day", range.since)
                .lte("day", range.until)
                .order("entity_id")
                .order("day")
                .range(from, to),
            ),
        );
        for (const unit of items) {
          const ranked = rank(
            ads
              .filter((a) => a.parent_external_id === unit.id &&
                (unit.delivery !== "ACTIVE" || delivery.get(`ad:${a.external_id}`) === "ACTIVE"))
              .map((ad) => ({
                ...summary(
                  ad,
                  pulseRows.filter((r) => r.entity_id === ad.id),
                ),
                media:
                  ad.creative_external_id && byId.has(ad.creative_external_id)
                    ? [mediaFor(byId.get(ad.creative_external_id)!)]
                    : [],
              })),
          );
          const leader = ranked.find(
            (ad) => ad.leader && ad.media.some((m) => m.image),
          );
          if (leader) {
            unit.media = [
              ...leader.media,
              ...unit.media.filter(
                (m) => m.creativeId !== leader.media[0]?.creativeId,
              ),
            ].slice(0, 3);
            unit.strongest = `${leader.tied ? "Joint most results" : "Most results"}: ${leader.name}`;
            pulse.push({ adsetId: unit.id, item: leader });
          }
        }
      }
    } catch (error) {
      console.error("Exploration media unavailable", error);
      warnings.push("Creative previews are temporarily unavailable.");
    }
    let detail: ExplorationView["detail"] = null;
    if (level === "ad" && parent) {
      const [unitRows, campaignResult] = await Promise.all([
        daily(context, "adset", parent.id),
        parent.parent_external_id
          ? entities(client, context)
              .eq("entity_level", "campaign")
              .eq("external_id", parent.parent_external_id)
              .maybeSingle()
          : null,
      ]);
      if (campaignResult?.error)
        warnings.push("Campaign context is temporarily unavailable.");
      const campaign = campaignResult?.data ?? null;
      // Limit recommendation presentation to this entity before applying the shared top-three policy.
      const entityData = decisions
        ? {
            ...decisions,
            snapshots: decisions.snapshots.filter((s) =>
              [parent.id, parent.external_id].includes(s.entity_id),
            ),
          }
        : null;
      const recommendations = entityData
        ? decisionViews({
            data: entityData,
            entities: [parent],
            businessId: context.businessId,
            accountId: context.account.id,
            now: context.now,
            zone: context.zone,
          }).view.attention
        : [];
      detail = {
        unit: summary(parent, unitRows, decisionView?.states.get(parent.id)),
        campaign: campaign?.name || "Campaign unavailable",
        ...(!campaign
          ? { budget: null, budgetAsOf: null }
          : budget(parent, campaign, currency)),
        points: trend(unitRows, period, context.today, currency),
        adPoints: Object.fromEntries(
          units.map((u) => [
            u.external_id,
            trend(
              rows.filter((r) => r.entity_id === u.id),
              period,
              context.today,
              currency,
            ),
          ]),
        ),
        recommendations,
      };
    }
    return {
      accountId: context.account.id,
      integrationId: context.platform.id,
      accountName: context.account.name || "Selected Meta account",
      currency,
      period,
      today: context.today,
      zone: context.zone,
      since: range.since,
      comparison:
        period === "today"
          ? null
          : `Changes: ${shiftDay(context.today, period === "7d" ? -7 : -30)} to ${shiftDay(context.today, -1)} vs previous ${period === "7d" ? "7" : "30"} completed days`,
      parent: parent
        ? { id: parent.external_id, name: parent.name || "Name unavailable" }
        : null,
      items,
      board,
      detail,
      warnings,
      decisionEvidenceAvailable:
        decisions !== null && !decisions.policyUnavailable,
      pulse: pulse
        .sort(
          (a, b) =>
            (b.item.metrics.results ?? 0) - (a.item.metrics.results ?? 0),
        )
        .slice(0, 2),
    };
  },
);
