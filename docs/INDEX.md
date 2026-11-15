# DeepVisor documentation

This handbook describes checked-in behavior. Module READMEs own detailed contracts.
Deployment, configuration and enabled execution require separate evidence.

| Read | Purpose |
| --- | --- |
| [Architecture](ARCHITECTURE.md) | Responsibilities, identity, data lineage and safety boundaries |
| [System diagram](SYSTEM_DIAGRAM.md) | Editable system view, source evidence and verification limits |
| [Codebase map](CODEBASE_MAP.md) | Directory ownership, routes and compatibility surfaces |
| [Flows](FLOWS.md) | Workflow sequences and entry points |
| [Development guide](DEVELOPMENT_GUIDE.md) | Setup, validation, configuration and migration process |
| [Architecture audit](ARCHITECTURE_AUDIT.md) | Historical findings; recheck before treating as current debt |
| [Jira backlog proposal](JIRA_BACKLOG_PROPOSAL.md) | Review-only candidates; no authority to create or change Jira issues |

## Maintenance

Update the owning module README with behavior changes, then update the map/flows
and diagram when entry points or boundaries change. Record verification scope and
date; distinguish source inspection, automated checks and live verification.
Keep operational credentials and customer data out of documentation. Keep generated
screenshots/logs in ignored local evidence; allowlist maintained documents explicitly.
Historical audits retain their dated results rather than claiming current test counts.

Jira proposals stay local until the user reviews the exact issues and explicitly
authorizes the destination project and mutations. Before applying, verify project
metadata and duplicates; do not infer a project from similarly named sample issues.
