# Initial Jira backlog — proposal for review

Prepared 2026-11-12 from repository inspection. All IDs below are local proposal IDs,
not Jira keys. The user approved KAN (My Software Team) as the destination.
The six tasks below were created as To Do, unassigned, without sprint or estimate.
Existing issues and project configuration were not changed.

## Jira discovery and approval

The user confirmed project KAN on 2026-11-12. Project metadata verified Task and
High/Medium/Low priorities. A complete `project = KAN` search returned only
KAN-1–KAN-3 with generic summaries and empty descriptions; no duplicate candidates
were found. Creation responses verified each new task's project, priority,
acceptance criteria, To Do status and empty assignee.

| Proposal | Created issue |
| --- | --- |
| DOC-01 | [KAN-4](https://deepvisor.atlassian.net/browse/KAN-4) |
| DOC-02 | [KAN-5](https://deepvisor.atlassian.net/browse/KAN-5) |
| DOC-03 | [KAN-6](https://deepvisor.atlassian.net/browse/KAN-6) |
| DOC-04 | [KAN-7](https://deepvisor.atlassian.net/browse/KAN-7) |
| DOC-05 | [KAN-8](https://deepvisor.atlassian.net/browse/KAN-8) |
| DOC-06 | [KAN-9](https://deepvisor.atlassian.net/browse/KAN-9) |

Document upload remains blocked: Atlassian reported Artifacts is not enabled for
this site/request. No artifact was published. Task creation does not claim any
candidate implementation or acceptance criteria are complete.

| ID | Suggested type / priority | Candidate and evidence | Acceptance criteria | Dependency |
| --- | --- | --- | --- | --- |
| DOC-01 | Task / High | Verify development runtime inventory. Source diagram cannot establish hosted schedules or execution enablement. | Document approved development target, deployed revision, worker schedule evidence and each independent execution gate using redacted metadata; label unknowns; make no configuration changes. | Approved read-only environment access |
| DOC-02 | Task / Medium | Reconcile handbook with current assistant and resource-refresh paths. `assistant/freshness.ts` requests gated background jobs; older handbook claims have drifted. | Trace manual/automatic/resource requests through coordinator and worker; update flow/map and source evidence; distinguish saved response coverage from requested refresh. | None |
| DOC-03 | Task / Medium | Define private assistant media retention. Assistant README explicitly leaves account-deletion storage cleanup policy unresolved. | Agree retention/deletion policy, document ownership and recovery; propose scoped implementation with orphan, saved-draft and cross-tenant tests before adding any job. | Product/operator policy decision |
| DOC-04 | Task / Medium | Remove shared report-fixture dependency on server demo builder. Exact retained edge in `scripts/architecture/baseline.json`. | Characterize fixture outputs, move browser-safe fixture inputs to an appropriate shared owner, preserve callers, remove resolved baseline entry, pass architecture/report tests. | None |
| DOC-05 | Task / Low | Remove deprecated Benefits runtime cycle. Exact retained cycle in architecture baseline. | Isolate shared animation constants without visual redesign; remove resolved baseline entry; pass architecture checks and relevant build validation. | None |
| DOC-06 | Task / Medium | Document schema prerequisites for safe development setup. Migration history is incremental and not a bootstrap. | Inventory prerequisite schemas/RPCs from migrations and fixture setup; separate local test fixtures from real development schema; document supported setup and recovery without production reconstruction or destructive reset. | Approved development schema evidence if remote verification needed |

These are bounded maintenance candidates, not a new product roadmap. Do not revive
Calendar, Reports or campaign publishing as part of documentation initialization.
DOC-01 is a verification task, not evidence of a production defect. Historical audit
items about the legacy assistant must not be filed as defects in the current route.
