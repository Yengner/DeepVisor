// Synthetic, read-only fixtures. No credentials, provider calls, or execution helpers.
import type {
  Creative,
  Daily,
  ExplorationEntity,
  ExplorationView,
  Summary,
  Period,
} from "./types";
import { aggregate, comparisons, mediaFor, rank, trend } from "./model";
import { periodRange, shiftDay } from "../../dashboard/overview/model";
import {
  recordedActivity,
  selectAdvertising,
} from "../../dashboard/overview/controlModel";

export const fixtureToday = "2026-10-07";
export function dailyFixture(entity = "ad-1", results = 3): Daily[] {
  return Array.from({ length: 61 }, (_, index) => ({
    entity_id: entity,
    day: shiftDay(fixtureToday, -60 + index),
    currency_code: "USD",
    spend: index === 60 ? 6 : 24,
    leads: index === 60 ? 0 : results,
    messages: 1,
    calls: 0,
    impressions: 1200,
    reach: 800,
    clicks: 60,
    inline_link_clicks: 45,
  }));
}
export function creativeFixture(overrides: Partial<Creative> = {}): Creative {
  return {
    id: "creative-row",
    business_id: "business",
    ad_account_id: "account",
    platform_integration_id: "integration",
    platform_creative_id: "creative-1",
    name: "Fresh colour",
    creative_type: "image",
    image_url: "https://images.example.test/colour.jpg",
    thumbnail_url: "https://images.example.test/colour-thumb.jpg",
    video_id: null,
    headline: "Your next fresh start",
    primary_text: "Colour, care and a little time for you.",
    cta_type: "SEND_MESSAGE",
    description: null,
    link_url: null,
    image_hash: null,
    instagram_actor_id: null,
    page_id: null,
    object_story_id: null,
    object_story_spec: {},
    asset_feed_spec: {},
    raw: {},
    updated_at: `${fixtureToday}T12:00:00Z`,
    created_at: `${fixtureToday}T12:00:00Z`,
    ...overrides,
  };
}
export function entityFixture(
  level: "campaign" | "adset" | "ad",
  id: string,
  parent: string | null = null,
): ExplorationEntity {
  return {
    id,
    external_id: id,
    entity_level: level,
    parent_external_id: parent,
    parent_id: parent,
    business_id: "business",
    ad_account_id: "account",
    platform_integration_id: "integration",
    platform_id: "meta",
    name:
      level === "adset"
        ? "Local colour appointments"
        : level === "campaign"
          ? "New client appointments"
          : "Fresh colour",
    creative_external_id: level === "ad" ? "creative-1" : null,
    status: "ACTIVE",
    raw: { daily_budget: "5000" },
    created_at: `${fixtureToday}T12:00:00Z`,
    updated_at: `${fixtureToday}T12:00:00Z`,
    created_time: null,
    updated_time: null,
    objective: "OUTCOME_LEADS",
    optimization_goal: null,
    campaign_id: null,
    adset_id: null,
  };
}
export function explorationFixture(period: Period = "7d"): ExplorationView {
  const range = periodRange(period, fixtureToday);
  const item = (
    id: string,
    name: string,
    results: number,
    creative: Creative,
  ): Summary => {
    const rows = dailyFixture(id, results);
    return {
      id,
      name,
      level: "ad",
      delivery: "ACTIVE",
      state: null,
      metrics: aggregate(
        rows.filter((r) => r.day >= range.since),
        "USD",
      ),
      media: [mediaFor(creative)],
      deltas: comparisons(rows, period, fixtureToday, "USD"),
      complete: true,
      leader: false,
      tied: false,
    };
  };
  const items = rank([
    item("ad-1", "Fresh colour", 3, creativeFixture()),
    item(
      "ad-2",
      "A moment for you",
      1,
      creativeFixture({
        platform_creative_id: "creative-2",
        creative_type: "video",
        video_id: "video-2",
      }),
    ),
    item(
      "ad-3",
      "Weekend appointments",
      0,
      creativeFixture({
        platform_creative_id: "creative-3",
        image_url: null,
        thumbnail_url: null,
      }),
    ),
  ]);
  const unit: Summary = {
    ...items[0],
    id: "set-1",
    level: "adset",
    name: "Local colour appointments",
    state: "Watching",
    leader: false,
    media: items.flatMap((i) => i.media),
  };
  return {
    accountId: "account",
    integrationId: "integration",
    accountName: "Studio Meta account",
    currency: "USD",
    period,
    today: fixtureToday,
    zone: "America/New_York",
    since: range.since,
    comparison:
      period === "today" ? null : "Changes over completed days; today excluded",
    items,
    warnings: [],
    parent: { id: "set-1", name: unit.name },
    pulse: [{ adsetId: unit.id, item: items[0] }],
    detail: {
      unit,
      campaign: "New client appointments",
      budget: "$50.00 daily · Ad set budget",
      budgetAsOf: `${fixtureToday}T12:00:00Z`,
      points: trend(dailyFixture(), period, fixtureToday, "USD"),
      adPoints: Object.fromEntries(
        items.map((ad, i) => [
          ad.id,
          trend(dailyFixture(ad.id, 3 - i), period, fixtureToday, "USD"),
        ]),
      ),
      recommendations: [
        {
          entity: unit.name,
          title: "Review your ad creative",
          reason:
            "A recent persisted review recommends checking the creative rotation.",
          state: "Shadow recommendation",
          detail: "No action was executed by this observation.",
          mode: "SHADOW",
          confidence: null,
          evidence: "Results: 28",
          period: "Last seven completed days",
        },
      ],
    },
  };
}

export function advertisingBoardFixture(
  period: Period = "7d",
): ExplorationView {
  const detail = explorationFixture(period);
  const names = [
    "Balayage appointments",
    "Your next skin reset",
    "New client consultations",
    "Weekend colour",
    "A little time for you",
  ];
  const items: Summary[] = names.map((name, i) => {
    const rows = dailyFixture(`set-${i + 1}`, 8 - i);
    return {
      ...detail.detail!.unit,
      id: `set-${i + 1}`,
      name,
      state:
        i === 1
          ? "Needs attention"
          : i === 0
            ? "Healthy"
            : i === 2
              ? "Watching"
              : "Insufficient data",
      metrics: aggregate(
        rows.filter((r) => r.day >= detail.since),
        "USD",
      ),
      deltas: comparisons(rows, period, fixtureToday, "USD"),
      media: [
        mediaFor(
          creativeFixture({
            platform_creative_id: `creative-${i + 1}`,
            image_url: `https://images.example.test/creative-${i + 1}.jpg`,
            thumbnail_url: `https://images.example.test/creative-${i + 1}.jpg`,
            ...(i === 1 ? { video_id: "video-2" } : {}),
          }),
        ),
      ],
    };
  });
  const selection = selectAdvertising(
    items,
    ["set-2"],
    recordedActivity(
      names.flatMap((_, i) => dailyFixture(`set-${i + 1}`)),
      names.map((_, i) => entityFixture("adset", `set-${i + 1}`)),
      fixtureToday,
    ),
  );
  return {
    ...detail,
    items: selection.items,
    detail: null,
    parent: null,
    pulse: [],
    board: {
      featuredId: selection.featuredId,
      featuredLabel: selection.featuredLabel,
      highlightIds: selection.highlightIds,
      attentionIds: selection.attentionIds,
    },
  };
}
