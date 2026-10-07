import { describe, expect, it } from "vitest";
import {
  dayInZone,
  decisionViews,
  metricsFor,
  modeLabel,
  originatingMode,
  parsePeriod,
  performanceView,
  periodRange,
} from "./model";
import type { DailyRow, DecisionRecords, Entity } from "./types";

const now = "2026-10-07T16:00:00Z";
const entity: Entity = {
  id: "internal",
  external_id: "meta-id",
  name: "New clients",
  status: "ACTIVE",
};
const row = (overrides: Partial<DailyRow> = {}): DailyRow => ({
  entity_id: entity.id,
  day: "2026-10-07",
  currency_code: "USD",
  spend: 100,
  leads: 2,
  messages: 6,
  calls: 2,
  impressions: 1000,
  clicks: 30,
  reach: 800,
  inline_link_clicks: 20,
  ...overrides,
});
function records(): DecisionRecords {
  const common = { business_id: "business", created_at: now, updated_at: now };
  return {
    snapshots: [
      {
        ...common,
        id: "snapshot",
        ad_account_id: "account",
        platform_integration_id: "integration",
        entity_id: entity.external_id,
        entity_type: "adset",
        feature_schema_version: 1,
        feature_json: {
          asOfDay: "2026-10-07",
          deliveryUnit: { currency: "USD" },
          trackingConfidence: { level: "high" },
          windows: {
            recent7d: {
              sinceDay: "2026-10-01",
              untilDay: "2026-10-07",
              metrics: { spend: 100, results: 10, costPerResult: 10 },
              dataSufficiency: { status: "sufficient" },
            },
          },
        },
      },
    ],
    runs: [
      {
        ...common,
        id: "run",
        feature_snapshot_id: "snapshot",
        status: "completed",
        provider: "deepvisor-mock",
        provider_model: "rules",
        provider_version: "1",
        model_version: "1",
        confidence: 0.9,
        provider_response_json: { secret: "never serialize" },
        decision_json: { result: { decision: "HOLD" } },
      },
    ],
    proposals: [],
    executions: [],
    outcomes: [],
    shadowRunIds: ["run"],
    autoRunIds: [],
    provenanceUnavailable: false,
    outcomesUnavailable: false,
    policyUnavailable: false,
    policy: {
      ...common,
      id: "policy",
      mode: "approval_required",
      allowed_action_classes: ["REDUCE_BUDGET"],
      max_budget_change_percent: 10,
      budget_boundaries_json: {},
      cooldown_config_json: {},
      minimum_evidence_json: {},
    },
  };
}
function withProposal(data: DecisionRecords) {
  data.proposals.push({
    id: "proposal",
    business_id: "business",
    decision_run_id: "run",
    action_type: "REDUCE_BUDGET",
    target_entity_id: entity.external_id,
    target_entity_type: "adset",
    current_state_json: { budgetMinor: 10000 },
    proposed_state_json: { targetBudgetMinor: 9000 },
    risk_level: "low",
    policy_result_json: { outcome: "REQUIRE_APPROVAL", reason: "REVIEW_MODE" },
    requires_approval: true,
    status: "pending",
    created_at: now,
    updated_at: now,
  });
  return data;
}
const evaluate = (data = records(), entities = [entity]) =>
  decisionViews({
    data,
    entities,
    businessId: "business",
    accountId: "account",
    now,
    zone: "America/New_York",
  });
const performance = (rows: DailyRow[], entities = [entity]) =>
  performanceView({
    rows,
    entities,
    period: "7d",
    today: "2026-10-07",
    currency: "USD",
    target: "10_25",
  });

describe("Overview performance", () => {
  it("uses account-local calendar dates across UTC and daylight-saving boundaries", () => {
    expect(dayInZone("2026-10-07T01:00:00Z", "America/New_York")).toBe(
      "2026-10-06",
    );
    expect(
      periodRange("7d", dayInZone("2026-03-09T03:30:00Z", "America/New_York")),
    ).toEqual({ since: "2026-03-02", until: "2026-03-08" });
    expect(periodRange("30d", "2026-03-01").since).toBe("2026-01-31");
    expect(periodRange("today", "2026-10-07")).toEqual({
      since: "2026-10-07",
      until: "2026-10-07",
    });
    expect(parsePeriod(undefined)).toBe("7d");
    expect(parsePeriod("invalid")).toBe("7d");
  });
  it("calculates aggregate CPR using leads plus messages plus calls, not daily CPR averages", () => {
    expect(
      metricsFor(
        [row(), row({ spend: 50, leads: 0, messages: 1, calls: 0 })],
        "USD",
      ),
    ).toEqual({ spend: 150, results: 11, costPerResult: 150 / 11 });
  });
  it("distinguishes missing data from confirmed zero and never divides by zero", () => {
    expect(metricsFor([], "USD")).toEqual({
      spend: null,
      results: null,
      costPerResult: null,
    });
    expect(
      metricsFor([row({ spend: 0, leads: 0, messages: 0, calls: 0 })], "USD"),
    ).toEqual({ spend: 0, results: 0, costPerResult: null });
    expect(metricsFor([row({ currency_code: "EUR" })], "USD").spend).toBeNull();
    expect(metricsFor([row({ spend: NaN })], "USD").spend).toBeNull();
  });
  it("leaves missing days as gaps and never treats the saved range as an exact/comparable target", () => {
    const view = performance([row()]);
    expect(view.missingDays).toBe(6);
    expect(view.points[0].results).toBeNull();
    expect(view.points[6].current).toBe(true);
    expect(view.targetLabel).toBe("$10 - $25");
    expect(view.targetStatus).toBe("unavailable");
    const today = performanceView({
      rows: [row()],
      entities: [entity],
      period: "today",
      today: "2026-10-07",
      currency: "USD",
      target: null,
    });
    expect(today.points).toHaveLength(7);
    expect(today.targetStatus).toBe("not_configured");
  });
  it("ranks by results, CPR then spend, excluding rows from other accounts", () => {
    const entities = Array.from({ length: 7 }, (_, i) => ({
      ...entity,
      id: String(i),
      name: `Unit ${i}`,
    }));
    const rows = entities.map((e, i) =>
      row({
        entity_id: e.id,
        leads: 0,
        messages: i < 3 ? 10 : 0,
        calls: 0,
        spend: i === 0 ? 100 : i === 1 ? 50 : i === 2 ? 75 : i * 10,
      }),
    );
    const view = performance(
      [...rows, row({ entity_id: "foreign", spend: 99999 })],
      entities,
    );
    expect(view.units.map((u) => u.name)).toEqual([
      "Unit 1",
      "Unit 2",
      "Unit 0",
      "Unit 6",
      "Unit 5",
    ]);
    expect(view.metrics.spend).toBe(405);
  });
});
describe("Overview decisions", () => {
  it("counts persisted shadow blocks even when no proposal was created", () => {
    const data = records();
    data.shadowRunIds = [];
    data.runs[0].decision_json = {
      result: { decision: "INSUFFICIENT_DATA" },
      shadow: { shadowPolicy: { outcome: "BLOCK" } },
    };
    expect(evaluate(data).view.counts).toMatchObject({
      evaluations: 1,
      blocked: 1,
      shadow: 1,
      executed: 0,
    });
    expect(evaluate(data).view.activity[0].state).toBe("Blocked");
  });
  it("uses spend evidence when zero results make CPR unavailable", () => {
    const data = withProposal(records());
    data.snapshots[0].feature_json = {
      deliveryUnit: { currency: "USD" },
      windows: {
        recent7d: {
          metrics: { spend: 100, results: 0, costPerResult: 0 },
          sinceDay: "2026-10-01",
          untilDay: "2026-10-07",
        },
      },
    };
    expect(evaluate(data).view.attention[0].evidence).toBe("Spend: $100.00");
  });
  it("orders offset timestamps by actual time and excludes future events", () => {
    const data = withProposal(records());
    data.runs[0].updated_at = "2026-10-07T14:00:00Z";
    data.proposals[0].policy_result_json = {
      review: { choice: "approve", reviewedAt: "2026-10-07T11:00:00-04:00" },
    };
    expect(evaluate(data).view.activity[0].title).toBe("Change approved");
    data.proposals[0].policy_result_json = {
      review: { choice: "approve", reviewedAt: "2026-10-08T11:00:00Z" },
    };
    expect(evaluate(data).view.activity).toHaveLength(1);
  });
  it("distinguishes a missing policy from a failed policy read", () => {
    expect(modeLabel(null)).toBe("OFF");
    expect(modeLabel(null, true)).toBe("Unavailable");
    const data = records();
    data.policyUnavailable = true;
    data.policy = null;
    expect(evaluate(data).view.counts.approvals).toBeNull();
    expect(evaluate(data).states.get(entity.id)).not.toBe("Healthy");
  });
  it("shows healthy only with a fresh sufficient HOLD and preserves state precedence", () => {
    expect(evaluate().states.get(entity.id)).toBe("Healthy");
    const data = withProposal(records());
    expect(evaluate(data).states.get(entity.id)).toBe("Needs attention");
    expect(
      evaluate(data, [{ ...entity, status: "PAUSED" }]).states.get(entity.id),
    ).toBe("Paused");
    data.proposals = [];
    data.runs[0].updated_at = "2026-10-01T16:00:00Z";
    expect(evaluate(data).states.get(entity.id)).toBe("Insufficient data");
    data.runs[0].updated_at = now;
    data.snapshots[0].feature_json = {};
    expect(evaluate(data).states.get(entity.id)).toBe("Insufficient data");
  });
  it("retains old unresolved approvals and uses safe missing names without identifiers", () => {
    const data = withProposal(records());
    data.runs[0].created_at = data.runs[0].updated_at = "2026-09-01T10:00:00Z";
    const { view } = evaluate(data, []);
    expect(view.attention).toHaveLength(1);
    expect(view.attention[0].entity).toBe("Ad set unavailable");
    expect(view.attention[0].confidence).toBeNull();
    expect(view.counts.evaluations).toBe(0);
    expect(JSON.stringify(view)).not.toContain("meta-id");
    expect(JSON.stringify(view)).not.toContain("never serialize");
  });
  it("scopes runs through snapshots, not the latest business-wide page", () => {
    const data = records();
    data.snapshots.push({
      ...data.snapshots[0],
      id: "foreign",
      ad_account_id: "other",
    });
    data.runs.push({
      ...data.runs[0],
      id: "foreign-run",
      feature_snapshot_id: "foreign",
    });
    for (let i = 0; i < 600; i++)
      data.runs.push({ ...data.runs[0], id: `run-${i}` });
    const { view } = evaluate(data);
    expect(view.counts.evaluations).toBe(601);
    expect(view.counts.checked).toBe(1);
    expect(view.activity).toHaveLength(8);
  });
  it('retains the complete open-attention count beyond the legacy three-item presentation', () => {
    const data = withProposal(records());
    data.proposals = Array.from({ length: 6 }, (_, i) => ({ ...data.proposals[0], id: `proposal-${i}` }));
    const result = evaluate(data);
    expect(result.view.attention).toHaveLength(3);
    expect(result.allAttention).toHaveLength(6);
  });
  it("uses historical provenance, never the current policy mode as the originating mode", () => {
    const data = records();
    expect(originatingMode("run", data)).toBe("SHADOW");
    data.shadowRunIds = [];
    expect(originatingMode("run", data)).toBeNull();
    data.autoRunIds = ["run"];
    expect(originatingMode("run", data)).toBe("LIMITED AUTO");
    data.provenanceUnavailable = true;
    expect(evaluate(data).view.counts.shadow).toBeNull();
  });
  it("counts each run once per category and successful executions only", () => {
    const data = withProposal(records());
    data.proposals.push({ ...data.proposals[0], id: "p2" });
    expect(evaluate(data).view.counts.approvals).toBe(1);
    data.executions = [
      {
        id: "execution",
        business_id: "business",
        action_proposal_id: "proposal",
        status: "failed",
        error_json: {},
        created_at: now,
        started_at: now,
        completed_at: now,
      },
    ];
    expect(evaluate(data).view.counts.executed).toBe(0);
    expect(evaluate(data).view.attention[0].state).toBe("Needs attention");
    data.executions[0].status = "succeeded";
    expect(evaluate(data).view.counts.executed).toBe(1);
  });
  it("orders actual review/measurement events and distinguishes shadow versus executed observations", () => {
    const data = withProposal(records());
    data.proposals[0].status = "rejected";
    data.proposals[0].updated_at = "2026-10-07T15:00:00Z";
    expect(
      evaluate(data).view.activity.some((e) => e.title === "Change rejected"),
    ).toBe(false);
    data.proposals[0].policy_result_json = {
      review: { choice: "reject", reviewedAt: "2026-10-07T14:00:00Z" },
    };
    data.executions = [
      {
        id: "execution",
        business_id: "business",
        action_proposal_id: "proposal",
        status: "succeeded",
        error_json: null,
        created_at: now,
        started_at: now,
        completed_at: "2026-10-07T12:00:00Z",
      },
    ];
    data.outcomes = [
      {
        id: "o1",
        source_kind: "shadow",
        shadow_decision_run_id: "run",
        executed_action_id: null,
        measurement_status: "complete",
        measured_at: "2026-10-07T13:00:00Z",
        measurement_horizon_hours: 6,
      },
      {
        id: "o2",
        source_kind: "executed",
        shadow_decision_run_id: null,
        executed_action_id: "execution",
        measurement_status: "complete",
        measured_at: "2026-10-07T15:00:00Z",
        measurement_horizon_hours: 1,
      },
    ];
    const { activity } = evaluate(data).view;
    expect(activity.map((e) => e.at)).toEqual(
      [...activity.map((e) => e.at)].sort().reverse(),
    );
    expect(activity.map((e) => e.state)).toContain("Shadow observation");
    expect(activity.map((e) => e.state)).toContain("Post-action observation");
    expect(activity.find((e) => e.title === "Change rejected")?.at).toBe(
      "2026-10-07T14:00:00Z",
    );
  });
});
