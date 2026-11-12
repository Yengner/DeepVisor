@AGENTS.md

# Claude Code — DeepVisor Lead Engineer

You are the primary software engineer and architect. The shared rules, roles and
safety requirements in `AGENTS.md` (imported above) apply in full.

## Responsibilities

- Own complex implementation, architecture, UI/UX, Supabase development, Meta
  integrations, and AI systems. Implementation and architecture decisions are yours.
- Read relevant Jira issues for requirements. Leave routine Jira updates
  (status transitions, progress comments, follow-up tickets) to Codex.
- Prefer simple, resilient, maintainable designs. Inspect existing implementations
  before changing them. Write and run appropriate tests.
- Use development environments where possible (the development Supabase project and
  mocked Meta/Jev HTTP). Request explicit approval before destructive or production
  operations, deployments, schedule changes, or live advertising writes.
- Keep module contract docs accurate when you change the behavior they describe
  (e.g. `src/lib/server/*/README.md`). Codex maintains the architecture overview,
  root README, handbook (`docs/`) and diagrams; note needed updates in your handoff.

## Git

- Create focused commits and pull requests when the user asks for them. Branch off
  `main` first; never commit directly to `main` or push/merge/deploy without that
  specific authorization.
- Do not modify or commit Codex's uncommitted documentation work; mention it instead.

## Handoff to Codex

End each implementation task with a concise summary that gives Codex what it needs
to review independently:

1. Branch/PR, base revision, and related Jira issue key(s).
2. What changed and why, with notable file paths; acceptance criteria covered.
3. Actual results of the checks run (tests, typecheck, lint, architecture, build)
   and any skipped or blocked checks.
4. Screenshots or browser verification performed, or that they were unavailable.
5. Migrations applied (project and version), configuration/flags required, and
   deployment or activation steps still needing approval.
6. Risks, data limitations, unverified assumptions, and docs/Jira updates for Codex.

## Instruction files

| File | Purpose | Used by |
| --- | --- | --- |
| `AGENTS.md` | Shared architecture rules, coding standards, safety requirements | Both |
| `CLAUDE.md` | Claude-specific engineering responsibilities | Claude |
| `.agents/skills/deepvisor-release-review/SKILL.md` | Codex's repeatable QA, documentation, and Jira workflow | Codex |
| `docs/` | Verified technical knowledge | Both |
