import { createClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/lib/shared/types/supabase";
vi.mock("server-only", () => ({}));
vi.mock("../../supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("../../actions/app/context", () => ({
  getRequiredAppContext: vi.fn(),
}));
vi.mock("../../actions/app/selection", () => ({
  resolveCurrentSelection: vi.fn(),
}));
vi.mock("../../dashboard/cache", () => ({
  getCachedAdAccountShellData: vi.fn(),
  getCachedPlatformDetails: vi.fn(),
}));
vi.mock("../../dashboard/overview/load", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  loadOverviewContext: vi.fn(),
  loadOverviewHistory: vi.fn(),
  loadOverviewDecisions: vi.fn(),
}));
import { createAdminClient } from "../../supabase/admin";
import {
  loadOverviewContext,
  loadOverviewHistory,
  loadOverviewDecisions,
} from "../../dashboard/overview/load";
import { loadExploration } from "./load";
import {
  creativeFixture,
  dailyFixture,
  entityFixture,
  fixtureToday,
} from "./fixtures";
import { GET } from "@/app/api/campaigns/exploration/route";
import { NextRequest } from "next/server";

const transport = vi.fn<typeof fetch>();
const client = createClient<Database>("https://isolated.example.test", "test", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: transport },
});
let fail: string | null;
let records: Record<string, Array<Record<string, unknown>>>;
beforeEach(() => {
  vi.clearAllMocks();
  fail = null;
  vi.mocked(createAdminClient).mockReturnValue(client);
  vi.mocked(loadOverviewContext).mockResolvedValue({
    businessId: "business",
    account: {
      id: "account",
      external_account_id: "act_123",
      currency_code: "USD",
      name: "Account",
    },
    platform: { id: "integration", vendor: "meta" },
    today: fixtureToday,
    now: `${fixtureToday}T12:00:00Z`,
    zone: "America/New_York",
  } as Awaited<ReturnType<typeof loadOverviewContext>>);
  vi.mocked(loadOverviewDecisions).mockResolvedValue({
    snapshots: [],
    runs: [],
    proposals: [],
    executions: [],
    outcomes: [],
    shadowRunIds: [],
    autoRunIds: [],
    provenanceUnavailable: false,
    outcomesUnavailable: false,
    policy: null,
    policyUnavailable: false,
  });
  records = {
    ad_entities: [
      entityFixture("campaign", "campaign-1"),
      entityFixture("adset", "set-1", "campaign-1"),
      entityFixture("ad", "ad-1", "set-1"),
      entityFixture("ad", "ad-2", "set-1"),
    ],
    ad_creatives: [creativeFixture()],
    ad_entity_performance_daily: [
      "campaign-1",
      "set-1",
      "ad-1",
      "ad-2",
    ].flatMap((id) =>
      dailyFixture(id).map((r) => ({
        ...r,
        ad_account_id: "account",
        entity_level: id.startsWith("ad-")
          ? "ad"
          : id.startsWith("set-")
            ? "adset"
            : "campaign",
      })),
    ),
  };
  vi.mocked(loadOverviewHistory).mockResolvedValue(dailyFixture("set-1"));
  transport.mockImplementation(async (url, init) => {
    expect(init?.method ?? "GET").toBe("GET");
    const request = new URL(String(url)),
      params = request.searchParams;
    const table = request.pathname.split("/").at(-1)!;
    expect([
      "ad_entities",
      "ad_creatives",
      "ad_entity_performance_daily",
    ]).toContain(table);
    expect(params.get("ad_account_id")).toBe("eq.account");
    if (table !== "ad_entity_performance_daily") {
      expect(params.get("business_id")).toBe("eq.business");
      expect(params.get("platform_integration_id")).toBe("eq.integration");
    } else expect(params.get("entity_id")).toMatch(/^in\.\(/);
    if (fail === table)
      return new Response(JSON.stringify({ message: "Unavailable" }), {
        status: 503,
      });
    let rows = records[table].filter((row) =>
      [...params].every(([key, filter]) => {
        if (filter.startsWith("eq.")) return row[key] === filter.slice(3);
        if (filter.startsWith("in.("))
          return filter.slice(4, -1).split(",").includes(String(row[key]));
        if (filter.startsWith("gte."))
          return String(row[key]) >= filter.slice(4);
        if (filter.startsWith("lte."))
          return String(row[key]) <= filter.slice(4);
        return true;
      }),
    );
    rows = rows.slice(
      Number(params.get("offset") ?? 0),
      Number(params.get("offset") ?? 0) + Number(params.get("limit") ?? 100000),
    );
    return new Response(JSON.stringify(rows), {
      headers: { "Content-Type": "application/json" },
    });
  });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
describe("read-only exploration loading", () => {
  it("joins reused creatives to each scoped ad without merging their metrics", async () => {
    const view = await loadExploration("7d", "ad", "set-1");
    expect(view.items).toHaveLength(2);
    expect(view.items[0].media[0].creativeId).toBe("creative-1");
    expect(view.items[1].media[0].creativeId).toBe("creative-1");
    expect(view.items[0].metrics.results).toBe(25);
    expect(view.detail?.unit.name).toBe("Local colour appointments");
    expect(view.detail?.unit.state).toBe("Insufficient data");
    expect(view.detail?.budget).toBeNull(); // Ambiguous campaign/ad-set budgets.
  });
  it("rejects unscoped parents before loading any daily metrics", async () => {
    await expect(
      loadExploration("7d", "ad", "other-account-set"),
    ).rejects.toThrow("Entity unavailable");
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it("rejects stale account selections at the endpoint", async () => {
    const response = await GET(
      new NextRequest(
        "http://localhost/api/campaigns/exploration?account=other&level=adset",
      ),
    );
    expect(response.status).toBe(409);
    expect(transport).not.toHaveBeenCalled();
  });
  it("validates level and period before reading data", async () => {
    expect(
      (
        await GET(
          new NextRequest(
            "http://localhost/api/campaigns/exploration?level=unknown",
          ),
        )
      ).status,
    ).toBe(400);
  });
  it("keeps performance usable after a media failure", async () => {
    fail = "ad_creatives";
    const view = await loadExploration("7d", "ad", "set-1");
    expect(view.items[0].metrics.results).toBe(25);
    expect(view.items[0].media).toEqual([]);
    expect(view.warnings).toContain(
      "Creative previews are temporarily unavailable.",
    );
  });
  it("keeps decision failures distinct from missing decisions", async () => {
    vi.mocked(loadOverviewDecisions).mockRejectedValue(new Error("failed"));
    const view = await loadExploration("7d", "ad", "set-1");
    expect(view.warnings).toContain(
      "Decision evidence is unavailable. Performance can still be explored.",
    );
    expect(view.detail?.unit.state).not.toBe("Healthy");
    expect(view.decisionEvidenceAvailable).toBe(false);
  });
  it("does not substitute identifiers for missing names", async () => {
    records.ad_entities.forEach((r) => {
      r.name = null;
    });
    const view = await loadExploration("7d", "ad", "set-1");
    expect(view.detail?.unit.name).toBe("Ad set unavailable");
    expect(view.items[0].name).toBe("Ad unavailable");
  });
  it("paginates beyond database page limits", async () => {
    records.ad_entities = Array.from({ length: 501 }, (_, i) =>
      entityFixture("campaign", `campaign-${i}`),
    );
    const view = await loadExploration("today", "campaign");
    expect(view.items).toHaveLength(501);
  });
  it("bounds Overview cards and pulse, without serving raw metadata", async () => {
    const view = await loadExploration("7d", "adset", null, true);
    expect(view.items.length).toBeLessThanOrEqual(5);
    expect(view.pulse.length).toBeLessThanOrEqual(2);
    expect(view.pulse[0].item.leader).toBe(true);
    expect(JSON.stringify(view)).not.toContain("daily_budget");
    expect(view.detail).toBeNull();
  });
  it("fails rather than presenting missing daily data as zero", async () => {
    fail = "ad_entity_performance_daily";
    await expect(loadExploration("7d", "ad", "set-1")).rejects.toBeTruthy();
  });
  it("uses the strongest measured ad media without replacing ad-set totals", async () => {
    records.ad_entities.find((r) => r.id === "ad-2")!.creative_external_id =
      "creative-2";
    records.ad_creatives.push(
      creativeFixture({
        id: "row-2",
        platform_creative_id: "creative-2",
        image_url: "https://images.example.test/strongest.jpg",
      }),
    );
    records.ad_entity_performance_daily.forEach((r) => {
      if (r.entity_id === "ad-2") r.leads = 20;
    });
    const view = await loadExploration("7d", "adset", null, true);
    expect(view.items[0].media[0].creativeId).toBe("creative-2");
    expect(view.items[0].metrics.results).toBe(25);
    expect(view.items[0].level).toBe("adset");
    expect(view.board?.activeFeaturedLabel).toBe("Active now");
  });
  it("uses today's ad-set metrics without importing historical ad totals", async () => {
    const view = await loadExploration("today", "adset", null, true);
    expect(view.items[0].metrics).toMatchObject({
      results: 1,
      spend: 6,
      clicks: 60,
      impressions: 1200,
      reach: 800,
      ctr: 5,
    });
    expect(view.board?.activeIds).toEqual(["set-1"]);
  });
  it("keeps active sets with no selected-period delivery but omits them from highlights", async () => {
    vi.mocked(loadOverviewHistory).mockResolvedValue(
      dailyFixture("set-1").filter((r) => r.day < fixtureToday),
    );
    const view = await loadExploration("today", "adset", null, true);
    expect(view.board?.activeIds).toEqual(["set-1"]);
    expect(view.board?.highlightIds).toEqual([]);
    expect(view.items[0].metrics.results).toBeNull();
  });
  it('excludes active children of a paused campaign despite recorded performance', async () => {
    records.ad_entities.find(r => r.id === 'campaign-1')!.status = 'paused';
    const view = await loadExploration('today', 'adset', null, true);
    expect(view.board?.activeIds).toEqual([]);
    expect(view.board?.highlightIds).toEqual(['set-1']);
    expect(view.items[0].delivery).toBe('CAMPAIGN_PAUSED');
  });
  it('excludes completed schedules from active while preserving historical highlights', async () => {
    records.ad_entities.find(r => r.id === 'set-1')!.raw = { end_time: `${fixtureToday}T11:59:59Z` };
    const view = await loadExploration('today', 'adset', null, true);
    expect(view.board?.activeIds).toEqual([]);
    expect(view.board?.highlightIds).toEqual(['set-1']);
    expect(view.items[0].delivery).toBe('COMPLETED');
  });
  it('does not show a set as active when every child ad is paused', async () => {
    for (const entity of records.ad_entities) {
      if (entity.entity_level === 'ad') entity.status = 'paused';
    }
    const view = await loadExploration('today', 'adset', null, true);
    expect(view.board?.activeIds).toEqual([]);
    expect(view.items[0].delivery).toBe('NO_ACTIVE_ADS');
  });
  it('recognizes the lowercase effective statuses written by real Meta sync', async () => {
    records.ad_entities.find(r => r.id === 'set-1')!.status = 'active';
    const active = await loadExploration('today', 'adset', null, true);
    expect(active.board?.activeIds).toEqual(['set-1']);
    expect(active.items[0].delivery).toBe('ACTIVE');
    records.ad_entities.find(r => r.id === 'set-1')!.status = 'paused';
    const paused = await loadExploration('today', 'adset', null, true);
    expect(paused.board?.activeIds).toEqual([]);
    expect(paused.board?.highlightIds).toEqual(['set-1']);
    expect(paused.items[0].delivery).toBe('PAUSED');
    expect(paused.items[0].state).toBe('Paused');
  });
});
