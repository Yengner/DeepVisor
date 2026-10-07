import { createClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
import { allPages, readOverviewDecisions } from "./load";

const transport = vi.fn<typeof fetch>();
const client = createClient<Database>(
  "https://unit-test.supabase.co",
  "test-key",
  {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: transport },
  },
);
let failedTable: string | null = null;
beforeEach(() => {
  failedTable = null;
  transport.mockReset();
  transport.mockImplementation(async (url, init) => {
    const request = new URL(String(url));
    const table = request.pathname.split("/").pop()!;
    expect(init?.method ?? "GET").toBe("GET");
    expect(request.searchParams.get("business_id")).toBe("eq.business");
    if (table === failedTable)
      return new Response(JSON.stringify({ message: "Unavailable" }), {
        status: 503,
      });
    const common = {
      business_id: "business",
      created_at: "2026-10-07T12:00:00Z",
      updated_at: "2026-10-07T12:00:00Z",
    };
    const records: Record<string, unknown[]> = {
      feature_snapshots: [
        {
          ...common,
          id: "snapshot",
          ad_account_id: "account",
          entity_type: "adset",
          entity_id: "entity",
          feature_schema_version: 1,
          platform_integration_id: "integration",
          feature_json: {},
        },
      ],
      decision_runs: [
        {
          ...common,
          id: "run",
          feature_snapshot_id: "snapshot",
          status: "completed",
            result: { decision: "HOLD" },
            shadow_outcome: "HOLD",
          confidence: 0.9,
          provider: "deepvisor-mock",
          provider_model: "rules",
          provider_version: "1",
          model_version: "1",
        },
      ],
      action_proposals: [],
      executed_actions: [],
      action_outcomes: [],
      shadow_evaluation_jobs: [{ decision_run_id: "run" }],
      limited_auto_evaluations: [],
    };
    expect(Object.keys(records)).toContain(table);
    if (table === "feature_snapshots" || table === "shadow_evaluation_jobs")
      expect(request.searchParams.get("ad_account_id")).toBe("eq.account");
    if (table === "decision_runs")
      expect(request.searchParams.get("feature_snapshot_id")).toBe(
        "in.(snapshot)",
      );
    if (table === "action_proposals")
      expect(request.searchParams.get("decision_run_id")).toBe("in.(run)");
    return new Response(JSON.stringify(records[table]), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
});
describe("Overview persisted reads", () => {
  it("paginates beyond default limits without truncating counts", async () => {
    const rows = Array.from({ length: 1201 }, (_, id) => ({ id }));
    const query = vi.fn(async (from: number, to: number) => ({
      data: rows.slice(from, to + 1),
      error: null,
    }));
    expect(await allPages(query)).toHaveLength(1201);
    expect(query).toHaveBeenCalledTimes(3);
  });
  it("rejects partial pagination instead of reporting incomplete counts as totals", async () => {
    await expect(
      allPages(async (from) => ({
        data: from ? null : Array(500).fill({}),
        error: from ? new Error("failed") : null,
      })),
    ).rejects.toThrow("failed");
  });
  it("uses account snapshot lineage and only read requests to permitted V2 tables", async () => {
    const data = await readOverviewDecisions(client, "business", "account", {
      data: null,
      failed: false,
    });
    expect(data.runs).toHaveLength(1);
    expect(data.runs[0].decision_json).toMatchObject({result:{decision:'HOLD'},shadow:{shadowPolicy:{outcome:'HOLD'}}});
    expect(data.shadowRunIds).toEqual(["run"]);
    expect(data.policy).toBeNull();
    const requests = transport.mock.calls.map(([url]) => String(url));
    expect(
      requests.some((url) =>
        /hourly|breakdown|demographic|report|rpc|graph.facebook|jev/.test(url),
      ),
    ).toBe(false);
    expect(
      requests.some((url) =>
        decodeURIComponent(url).includes("provider_response_json"),
      ),
    ).toBe(false);
  });
  it("preserves decisions when optional provenance or outcome reads fail", async () => {
    failedTable = "shadow_evaluation_jobs";
    let data = await readOverviewDecisions(client, "business", "account", {
      data: null,
      failed: true,
    });
    expect(data.runs).toHaveLength(1);
    expect(data.provenanceUnavailable).toBe(true);
    expect(data.policyUnavailable).toBe(true);
    failedTable = "action_outcomes";
    data = await readOverviewDecisions(client, "business", "account", {
      data: null,
      failed: false,
    });
    expect(data.outcomesUnavailable).toBe(true);
    expect(data.runs).toHaveLength(1);
  });
  it("fails the decision section on core query failure instead of returning an empty feed", async () => {
    failedTable = "decision_runs";
    await expect(
      readOverviewDecisions(client, "business", "account", {
        data: null,
        failed: false,
      }),
    ).rejects.toBeDefined();
  });
});
