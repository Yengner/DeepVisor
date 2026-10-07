import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/shared/types/supabase";
vi.mock("server-only", () => ({}));
vi.mock("../../actions/app/context", () => ({
  getRequiredAppContext: vi.fn(),
}));
vi.mock("../../actions/app/selection", () => ({
  resolveCurrentSelection: vi.fn(),
}));
vi.mock("../cache", () => ({
  getCachedAdAccountShellData: vi.fn(),
  getCachedPlatformDetails: vi.fn(),
}));
vi.mock("../../supabase/admin", () => ({ createAdminClient: vi.fn() }));
import { createAdminClient } from "../../supabase/admin";
import { loadOverviewHistory } from "./load";
import {
  dailyFixture,
  entityFixture,
  fixtureToday,
} from "../../campaigns/exploration/fixtures";

const transport = vi.fn<typeof fetch>();
const client = createClient<Database>("https://isolated.example.test", "test", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: transport },
});
let failOlder = false;
beforeEach(() => {
  failOlder = false;
  vi.clearAllMocks();
  vi.mocked(createAdminClient).mockReturnValue(client);
  transport.mockImplementation(async (url, init) => {
    expect(init?.method ?? "GET").toBe("GET");
    const request = new URL(String(url)),
      p = request.searchParams;
    expect(p.get("ad_account_id")).toBe("eq.account");
    const table = request.pathname.split("/").at(-1);
    if (table === "ad_entities") {
      expect(p.get("business_id")).toBe("eq.business");
      expect(p.get("entity_level")).toBe("eq.adset");
      return new Response(JSON.stringify([entityFixture("adset", "set-1")]));
    }
    expect(table).toBe("ad_entity_performance_daily");
    expect(p.get("entity_id")).toBe("in.(set-1)");
    expect(p.get("entity_level")).toBe("eq.adset");
    const filters = p.getAll("day");
    const start = filters.find((f) => f.startsWith("gte."))!.slice(4);
    const end = filters.find((f) => f.startsWith("lte."))!.slice(4);
    if (failOlder && start === "2026-08-08")
      return new Response(JSON.stringify({ message: "failed" }), {
        status: 503,
      });
    return new Response(
      JSON.stringify([
        ...dailyFixture("set-1").filter((r) => r.day >= start && r.day <= end),
        ...dailyFixture("foreign").slice(-1),
      ]),
    );
  });
});
describe("account history for dashboard comparisons", () => {
  it("reads 61 non-overlapping days from scoped ad sets only", async () => {
    const rows = await loadOverviewHistory("business", "account", fixtureToday);
    expect(rows).toHaveLength(61);
    expect(new Set(rows.map((r) => r.day)).size).toBe(61);
    expect(rows.every((r) => r.entity_id === "set-1")).toBe(true);
    expect(rows[0].day).toBe("2026-08-08");
    expect(rows.at(-1)?.day).toBe(fixtureToday);
  });
  it("does not present a failed historical read as a valid comparison", async () => {
    failOlder = true;
    await expect(
      loadOverviewHistory("business", "account", fixtureToday),
    ).rejects.toBeDefined();
  });
});
