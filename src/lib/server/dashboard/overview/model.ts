import {
  aggregatePerformanceSummaryRows,
  deriveSummaryMetricFields,
} from "../../repositories/performanceSummary/shared";
import { record, toDecisionCard } from "../../decisions/surface";
import { TARGET_COST_PER_LEAD_OPTIONS } from "@/lib/shared/onboarding/businessProfileOptions";
import type {
  ActivityItem,
  AttentionItem,
  DailyRow,
  DecisionRecords,
  DecisionsView,
  Entity,
  Metrics,
  Mode,
  PerformanceView,
  Period,
  UnitState,
} from "./types";

export function dayInZone(at: string, zone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(at));
  return ["year", "month", "day"]
    .map((type) => parts.find((p) => p.type === type)!.value)
    .join("-");
}
export function shiftDay(day: string, amount: number) {
  return new Date(Date.parse(`${day}T12:00:00Z`) + amount * 86400000)
    .toISOString()
    .slice(0, 10);
}
export const parsePeriod = (value: unknown): Period =>
  value === "today" || value === "30d" ? value : "7d";
export function periodRange(period: Period, today: string) {
  return {
    since: shiftDay(
      today,
      period === "today" ? 0 : period === "30d" ? -29 : -6,
    ),
    until: today,
  };
}
export function modeLabel(mode: string | null, unavailable = false): Mode {
  if (unavailable) return "Unavailable";
  return mode === null || mode === "off"
    ? "OFF"
    : mode === "observe"
      ? "SHADOW"
      : mode === "approval_required"
        ? "REVIEW"
        : mode === "autonomous"
          ? "LIMITED AUTO"
          : "Unavailable";
}
const empty: Metrics = { spend: null, results: null, costPerResult: null };
export function metricsFor(rows: DailyRow[], currency: string | null): Metrics {
  if (
    !rows.length ||
    !currency ||
    rows.some(
      (row) =>
        row.currency_code !== currency ||
        [row.spend, row.leads, row.messages, row.calls].some(
          (value) =>
            typeof value !== "number" || !Number.isFinite(value) || value < 0,
        ),
    )
  )
    return { ...empty };
  const totals = aggregatePerformanceSummaryRows(rows);
  const derived = deriveSummaryMetricFields(totals);
  const results = totals.leads + totals.messages + totals.calls;
  return {
    spend: totals.spend,
    results,
    costPerResult: results > 0 ? derived.cost_per_result : null,
  };
}
function scoped(
  input: DecisionRecords,
  business: string,
  account: string,
): DecisionRecords {
  const snapshots = input.snapshots.filter(
    (s) =>
      s.business_id === business &&
      s.ad_account_id === account &&
      s.entity_type === "adset",
  );
  const snapshotIds = new Set(snapshots.map((s) => s.id));
  const runs = input.runs.filter(
    (r) => r.business_id === business && snapshotIds.has(r.feature_snapshot_id),
  );
  const runIds = new Set(runs.map((r) => r.id));
  const proposals = input.proposals.filter(
    (p) => p.business_id === business && runIds.has(p.decision_run_id),
  );
  const proposalIds = new Set(proposals.map((p) => p.id));
  const executions = input.executions.filter(
    (e) => e.business_id === business && proposalIds.has(e.action_proposal_id),
  );
  const executionIds = new Set(executions.map((e) => e.id));
  return {
    ...input,
    snapshots,
    runs,
    proposals,
    executions,
    outcomes: input.outcomes.filter((o) =>
      o.source_kind === "shadow"
        ? !!o.shadow_decision_run_id && runIds.has(o.shadow_decision_run_id)
        : !!o.executed_action_id && executionIds.has(o.executed_action_id),
    ),
  };
}
export function originatingMode(
  runId: string,
  data: DecisionRecords,
): Mode | null {
  if (data.autoRunIds.includes(runId)) return "LIMITED AUTO";
  if (data.shadowRunIds.includes(runId)) return "SHADOW";
  const shadow = record(
    record(record(data.runs.find((r) => r.id === runId)?.decision_json).shadow)
      .shadowPolicy,
  );
  if (["HOLD", "BLOCK", "SHADOW_ONLY"].includes(String(shadow.outcome)))
    return "SHADOW";
  const results = data.proposals
    .filter((p) => p.decision_run_id === runId)
    .map((p) => record(p.policy_result_json));
  if (results.some((r) => r.executionMode === "LIMITED_AUTO"))
    return "LIMITED AUTO";
  if (results.some((r) => r.shadowOnly === true || r.outcome === "SHADOW_ONLY"))
    return "SHADOW";
  if (results.some((r) => r.reason === "REVIEW_MODE")) return "REVIEW";
  return null;
}
export function decisionViews(input: {
  data: DecisionRecords;
  businessId: string;
  accountId: string;
  entities: Entity[];
  now: string;
  zone: string;
}) {
  const data = scoped(input.data, input.businessId, input.accountId);
  const today = dayInZone(input.now, input.zone);
  const isToday = (at: string | null) =>
    !!at &&
    Number.isFinite(Date.parse(at)) &&
    Date.parse(at) <= Date.parse(input.now) &&
    dayInZone(at, input.zone) === today;
  const snapshots = new Map(data.snapshots.map((s) => [s.id, s]));
  const runs = new Map(data.runs.map((r) => [r.id, r]));
  const entityFor = (runId: string) =>
    snapshots.get(runs.get(runId)?.feature_snapshot_id ?? "")?.entity_id;
  const nameFor = (runId: string) =>
    input.entities.find(
      (e) => e.external_id === entityFor(runId) || e.id === entityFor(runId),
    )?.name || "Ad set unavailable";
  const decision = (run: DecisionRecords["runs"][number]) =>
    record(record(run.decision_json).result).decision;
  const completed = data.runs
    .filter(
      (r) =>
        r.status === "completed" &&
        Date.parse(r.updated_at) <= Date.parse(input.now),
    )
    .sort(
      (a, b) =>
        Date.parse(b.updated_at) - Date.parse(a.updated_at) ||
        a.id.localeCompare(b.id),
    );
  const latest = new Map<string, DecisionRecords["runs"][number]>();
  for (const run of [...data.runs].sort(
    (a, b) =>
      Date.parse(b.created_at) - Date.parse(a.created_at) ||
      a.id.localeCompare(b.id),
  )) {
    const entity = entityFor(run.id);
    if (entity && !latest.has(entity)) latest.set(entity, run);
  }
  const todayRuns = completed.filter((r) => isToday(r.updated_at));
  const todayIds = new Set(todayRuns.map((r) => r.id));
  const attention: Array<
    AttentionItem & {
      priority: number;
      at: string;
      entityId: string | undefined;
    }
  > = [];
  const activity: ActivityItem[] = [];
  const approvalRuns = new Set<string>();
  const blockedRuns = new Set<string>();
  const nameSafeExecutions = data.executions.map((e) => ({
    ...e,
    updated_at: e.completed_at ?? e.created_at,
    request_metadata_json: {},
    state_before_json: null,
    state_after_json: null,
  }));
  for (const run of data.runs) {
    if (
      record(record(record(run.decision_json).shadow).shadowPolicy).outcome ===
      "BLOCK"
    )
      blockedRuns.add(run.id);
    const snapshot = snapshots.get(run.feature_snapshot_id);
    const card = toDecisionCard({
      run,
      snapshot,
      proposals: data.proposals,
      executions: nameSafeExecutions,
      policy: data.policy,
      entityName: nameFor(run.id),
    });
    const mode = originatingMode(run.id, data);
    const savedMetrics = record(
      record(record(record(snapshot?.feature_json).windows).recent7d).metrics,
    );
    const evidence =
      (typeof savedMetrics.results === "number" && savedMetrics.results > 0
        ? card.evidence.find((e) => e.label === "Cost per result")
        : undefined) ??
      card.evidence.find((e) => e.label === "Spend") ??
      card.evidence.find((e) => e.label === "Results");
    const base = {
      entity: nameFor(run.id),
      evidence: evidence ? `${evidence.label}: ${evidence.value}` : null,
      period: card.period,
      confidence:
        card.provider === "Sample evaluation"
          ? null
          : (card.probability ?? card.confidence),
      mode,
      entityId: entityFor(run.id),
      at: run.created_at,
    };
    const proposals = data.proposals.filter(
      (p) => p.decision_run_id === run.id,
    );
    const wasDismissed =
      proposals.length > 0 &&
      proposals.every((p) => ["rejected", "cancelled"].includes(p.status));
    for (const proposal of card.proposals) {
      if (proposal.canReview) approvalRuns.add(run.id);
      const stored = proposals.find((p) => p.id === proposal.id)!;
      if (record(stored.policy_result_json).outcome === "BLOCK")
        blockedRuns.add(run.id);
      const problem = ["Needs reconciliation", "Execution failed"].includes(
        proposal.status,
      );
      if (problem || proposal.canReview)
        attention.push({
          ...base,
          title: problem ? "A recent change needs checking" : proposal.title,
          reason: problem
            ? "Check the recorded action before making another change."
            : (proposal.reason ?? card.explanation),
          detail: proposal.detail,
          state: problem ? "Needs attention" : "Approval required",
          priority: problem ? 0 : 1,
        });
      const review = record(record(stored.policy_result_json).review);
      if (
        typeof review.reviewedAt === "string" &&
        isToday(review.reviewedAt) &&
        ["approve", "reject"].includes(String(review.choice))
      ) {
        activity.push({
          title:
            review.choice === "approve" ? "Change approved" : "Change rejected",
          entity: base.entity,
          at: review.reviewedAt,
          state: review.choice === "approve" ? "Approved" : "Rejected",
          mode,
        });
      }
    }
    if (
      run.status === "completed" &&
      decision(run) === "REVIEW_CREATIVE" &&
      latest.get(entityFor(run.id) ?? "")?.id === run.id &&
      !wasDismissed
    ) {
      attention.push({
        ...base,
        title: "Review your ad creative",
        reason: card.explanation,
        detail: null,
        state: mode === "SHADOW" ? "Shadow recommendation" : "Recommendation",
        priority: 2,
      });
    }
    if (isToday(run.updated_at) && run.status !== "pending")
      activity.push({
        entity: base.entity,
        at: run.updated_at,
        mode,
        title:
          run.status === "failed"
            ? "Account check could not finish"
            : decision(run) === "HOLD"
              ? "Keep things as they are"
              : decision(run) === "REVIEW_CREATIVE"
                ? "Creative review recommended"
                : decision(run) === "INSUFFICIENT_DATA"
                  ? "More performance data needed"
                  : "Ad set evaluated",
        state:
          run.status === "failed"
            ? "Check failed"
            : blockedRuns.has(run.id)
              ? "Blocked"
              : approvalRuns.has(run.id)
                ? "Approval required"
                : mode === "SHADOW"
                  ? "Shadow"
                  : decision(run) === "HOLD"
                    ? "HOLD"
                    : "Evaluation",
      });
  }
  for (const execution of data.executions) {
    const runId = data.proposals.find(
      (p) => p.id === execution.action_proposal_id,
    )?.decision_run_id;
    if (runId && isToday(execution.completed_at))
      activity.push({
        title:
          execution.status === "succeeded"
            ? "Advertising change completed"
            : "Advertising change needs checking",
        entity: nameFor(runId),
        at: execution.completed_at!,
        state:
          execution.status === "succeeded" ? "Executed" : "Needs attention",
        mode: originatingMode(runId, data),
      });
  }
  for (const outcome of data.outcomes) {
    if (
      outcome.measurement_status !== "complete" ||
      !isToday(outcome.measured_at)
    )
      continue;
    const runId =
      outcome.source_kind === "shadow"
        ? outcome.shadow_decision_run_id
        : data.proposals.find(
            (p) =>
              p.id ===
              data.executions.find((e) => e.id === outcome.executed_action_id)
                ?.action_proposal_id,
          )?.decision_run_id;
    if (runId)
      activity.push({
        title: `${outcome.measurement_horizon_hours}-hour performance observation recorded`,
        entity: nameFor(runId),
        at: outcome.measured_at!,
        state:
          outcome.source_kind === "shadow"
            ? "Shadow observation"
            : "Post-action observation",
        mode: originatingMode(runId, data),
      });
  }
  const attentionEntities = new Set(attention.map((a) => a.entityId));
  const states = new Map<string, UnitState>();
  for (const entity of input.entities) {
    const run = latest.get(entity.external_id) || latest.get(entity.id);
    const snapshot = run ? snapshots.get(run.feature_snapshot_id) : undefined;
    const features = record(snapshot?.feature_json);
    const evidence = record(record(features.windows).recent7d);
    const tracking = record(features.trackingConfidence).level;
    const fresh =
      run &&
      run.status === "completed" &&
      Date.parse(run.updated_at) <= Date.parse(input.now) &&
      Date.parse(input.now) - Date.parse(run.updated_at) <= 36 * 3600000 &&
      typeof features.asOfDay === "string" &&
      features.asOfDay >= shiftDay(today, -1) &&
      features.asOfDay <= today;
    const insufficient =
      !fresh ||
      decision(run!) === "INSUFFICIENT_DATA" ||
      record(evidence.dataSufficiency).status !== "sufficient" ||
      !["medium", "high"].includes(String(tracking));
    const conflicting = data.proposals.some(
      (p) =>
        p.target_entity_id === entity.external_id &&
        ["pending", "approved"].includes(p.status),
    );
    states.set(
      entity.id,
      entity.status === "PAUSED"
        ? "Paused"
        : attentionEntities.has(entity.external_id) ||
            attentionEntities.has(entity.id)
          ? "Needs attention"
          : insufficient
            ? "Insufficient data"
            : decision(run!) === "HOLD" &&
                !conflicting &&
                !data.policyUnavailable
              ? "Healthy"
              : "Watching",
    );
  }
  const view: DecisionsView = {
    counts: {
      evaluations: todayRuns.length,
      checked: new Set(todayRuns.map((r) => entityFor(r.id)).filter(Boolean))
        .size,
      holds: todayRuns.filter((r) => decision(r) === "HOLD").length,
      recommendations: todayRuns.filter(
        (r) => decision(r) === "REVIEW_CREATIVE",
      ).length,
      blocked: [...blockedRuns].filter((id) => todayIds.has(id)).length,
      approvals: data.policyUnavailable
        ? null
        : [...approvalRuns].filter((id) => todayIds.has(id)).length,
      shadow: data.provenanceUnavailable
        ? null
        : todayRuns.filter((r) => originatingMode(r.id, data) === "SHADOW")
            .length,
      executed: data.executions.filter(
        (e) => e.status === "succeeded" && isToday(e.completed_at),
      ).length,
    },
    attention: attention
      .sort(
        (a, b) =>
          a.priority - b.priority || Date.parse(b.at) - Date.parse(a.at),
      )
      .slice(0, 3)
      .map((item) => ({
        entity: item.entity,
        title: item.title,
        reason: item.reason,
        detail: item.detail,
        evidence: item.evidence,
        period: item.period,
        confidence: item.confidence,
        state: item.state,
        mode: item.mode,
      })),
    activity: activity
      .sort(
        (a, b) =>
          Date.parse(b.at) - Date.parse(a.at) || a.title.localeCompare(b.title),
      )
      .slice(0, 8),
    lastCheck: completed[0]?.updated_at ?? null,
    provenanceUnavailable: data.provenanceUnavailable,
    outcomesUnavailable: data.outcomesUnavailable,
  };
  // Retain complete, priority-ordered attention for the control center and board.
  // The legacy presentation above still exposes only its original three rows.
  return { view, states, allAttention: attention, allActivity: activity };
}

export function performanceView(input: {
  rows: DailyRow[];
  entities: Entity[];
  period: Period;
  today: string;
  currency: string | null;
  target: string | null;
  states?: Map<string, UnitState>;
}): PerformanceView {
  const { since, until } = periodRange(input.period, input.today);
  const currency =
    input.currency && /^[A-Z]{3}$/.test(input.currency) ? input.currency : null;
  const validIds = new Set(input.entities.map((e) => e.id));
  const rows = input.rows.filter((r) => validIds.has(r.entity_id));
  const selected = rows.filter((r) => r.day >= since && r.day <= until);
  const trendSince =
    input.period === "today" ? shiftDay(input.today, -6) : since;
  const points = [];
  for (let day = trendSince; day <= until; day = shiftDay(day, 1))
    points.push({
      day,
      current: day === input.today,
      ...metricsFor(
        rows.filter((r) => r.day === day),
        currency,
      ),
    });
  const days = new Set(selected.map((r) => r.day));
  const expected =
    input.period === "today" ? 1 : input.period === "7d" ? 7 : 30;
  const knownTarget = TARGET_COST_PER_LEAD_OPTIONS.find(
    (t) => t.value === input.target && t.value !== "recommend_for_me",
  );
  const units = input.entities.map((entity) => ({
    ...metricsFor(
      selected.filter((r) => r.entity_id === entity.id),
      currency,
    ),
    name: entity.name || "Ad set unavailable",
    state:
      input.states?.get(entity.id) ??
      (entity.status === "PAUSED" ? "Paused" : "Insufficient data"),
  }));
  units.sort(
    (a, b) =>
      (b.results ?? -1) - (a.results ?? -1) ||
      (a.costPerResult ?? Infinity) - (b.costPerResult ?? Infinity) ||
      (b.spend ?? -1) - (a.spend ?? -1) ||
      a.name.localeCompare(b.name),
  );
  return {
    metrics: metricsFor(selected, currency),
    currency,
    since,
    until,
    missingDays: expected - days.size,
    targetLabel: knownTarget?.label ?? null,
    targetStatus: knownTarget ? "unavailable" : "not_configured",
    points,
    units: units.slice(0, 5),
  };
}
