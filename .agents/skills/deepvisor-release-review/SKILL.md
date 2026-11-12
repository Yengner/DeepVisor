---
name: deepvisor-release-review
description: Independently review a completed DeepVisor feature or pull request, run regression checks, maintain verified affected documentation and Jira status, and produce an evidence-backed release handoff. Use when asked to review a completed feature, PR, or release handoff; not for feature implementation or deployment.
---

# DeepVisor release review

Claude is DeepVisor's lead engineer and owns implementation and architecture decisions.
Codex owns independent QA and regression testing, visual architecture documentation,
README and technical docs maintenance, routine Jira project management, and verified
release handoffs. Review completion claims against evidence and acceptance criteria.

## Establish scope

- Read repository `AGENTS.md`, inspect relevant existing skills, and check Git status
  before editing. Read affected module docs and relevant architecture/map/flows sections.
- Identify the feature/PR, acceptance criteria, base/head revisions, changed files,
  and related Jira issues. Use the PR base or merge-base; do not assume the last
  commit contains the feature. Inspect the diff, callers, tests, configuration,
  migrations, and dependency/lockfile changes.
- Distinguish committed changes from staged, unstaged, and untracked work. Never edit,
  format, stash, reset, overwrite, or commit Claude's uncommitted code. Review it
  read-only when relevant. Preserve work of uncertain ownership. Use an isolated
  checkout when checks would alter those files; state which revision it verifies.
- Report implementation defects with file/line evidence and reproduction steps for
  Claude. Do not modify application logic, production data, or Claude's uncommitted
  changes unless specifically authorized; application fixes require a separate request.
  Add focused regression tests only in new/untouched files without changing Claude's work.

## Verify behavior and risk

Use Node.js 24 and existing repository commands. Inspect scripts for side effects.
Run targeted tests first (`npm test -- <path>`), then the relevant gates required by
`AGENTS.md` and CI: typecheck, full tests, lint, architecture tests/checks, and build.
For documentation-only changes, validate links, diagrams, and claims instead of
unrelated application checks. Record actual commands, exit results, warnings, and
skipped/blocked checks. Passing tests alone do not prove acceptance criteria.

Review the changed behavior and affected dependencies for:

- **Correctness:** acceptance criteria, callers, failures/missing data, stale evidence,
  duplicate requests, time/currency/coverage, aggregate ratios, and entity levels.
- **Security:** authenticated business/selected-account scope, roles/RLS, input
  validation, server-only secrets, redacted logs, and fail-closed policy, approval,
  idempotency, execution-lock, and reconciliation boundaries.
- **Supabase/API integrations:** inspect affected schema/migration compatibility,
  RLS/grants and service-role access, generated types, request/response contracts,
  auth/session handling, timeouts, rate limits, retries, and partial/uncertain failures.
  Load the available Supabase skill when reviewing Supabase behavior; inspect the
  authorized development target only when remote evidence is necessary. Never apply
  migrations or exercise live writes as a verification shortcut.
- **Performance:** scoped queries/pagination, N+1 or repeated provider calls, cache
  freshness, payload size, and rendering/bundle impact where affected. Distinguish
  measured regressions from risks that still need measurement.
- **Dependencies:** necessity of changed packages, lockfile consistency, affected API
  compatibility, and relevant security advisories. Do not upgrade or auto-fix packages.

Use mocked Meta/Jev HTTP and isolated fixtures first. Verify negative and tenant
isolation cases where affected. Review rendered desktop/mobile UI when available,
including loading/errors, focus, contrast, real creative media, and reduced motion
where affected. Report unavailable browser/screenshot coverage explicitly.

Never modify production data or use customer accounts as fixtures. Do not invoke live
advertising writes. Review does not authorize commits, pushes, deployment, migrations,
production configuration, schedules, or execution-gate activation. A successful Meta
sync does not prove a completed decision evaluation.

## Maintain affected documentation

- Search existing README, module docs, architecture/flows, and diagram sources first.
  Prefer one authoritative architecture overview (`docs/ARCHITECTURE.md`) with focused
  links to module contracts and flows. Update existing explanations and navigation;
  avoid repetitive overview files, duplicate diagrams, and stale descriptions.
- Update only affected claims verified from code, tests, or inspected configuration.
  Clearly label proposed systems separately from implemented ones. Distinguish
  configured, deployed, enabled, and verified behavior; source code does not establish
  production state.
- Keep docs visual-first, concise, accurate, and navigable. Use Mermaid for inline
  source-controlled flows and draw.io for editable architecture visuals when affected diagrams need it.
  Reuse existing sources and the available drawio skill. Do not duplicate the same
  explanation in both formats without a concrete need. Check labels, boundaries,
  links, and rendered diagrams where tools permit.
- Preserve Claude's uncommitted documentation; report needed edits to those files.

## Keep Jira evidence-based

Update the corresponding Jira issue with the review outcome using connected tools
within the reviewed feature's scope. Read existing comments before posting so repeated
reviews add only new evidence.
Search by linked issue key, PR/reference, and distinctive feature terms before
creating issues. Read candidates and current status; reuse existing issues and avoid
duplicate defects, follow-ups, or comments. Inspect project requirements and available
transitions instead of guessing project keys, required fields, or status names.

Record verified scope, acceptance coverage, reproducible defects, and check results
with PR/revision and evidence links. Create issues only for concrete untracked findings,
with impact and reproduction/acceptance criteria. Never mark work Done without
verification of all applicable acceptance criteria and required gates. Failed, unrun,
or blocked checks prevent Done; honor project completion rules, including deployment
evidence if required. If Jira is unavailable or the target is ambiguous, provide a
proposed update and identify missing information; do not guess or claim it was posted.

## Handoff and resource discipline

Deliver a concise handoff containing the reviewed PR/revision and scope, findings by
severity with file/line evidence, actual test/typecheck/lint/architecture/build results,
desktop/mobile coverage, documentation/Jira changes and links, and remaining risks,
deployment/migration needs, or verification gaps. State whether evidence supports
release readiness; readiness is not deployment authorization. When Jira was changed,
name and link this skill in the handoff. Show the documentation diff and stop at the
requested review boundary.

Optimize tokens and MCP calls: inspect diff summaries first, use bounded `rg` searches
and targeted reads; do not scan the full repository for minor changes. Batch independent
read-only requests, reuse retrieved IDs/evidence, and fetch only needed fields/pages. Load specialized skills only when needed. Avoid
broad exports, repeated polling, redundant diagrams, and rerunning successful checks
unless relevant code or evidence changes.
