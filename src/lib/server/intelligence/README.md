# server/intelligence

Older account intelligence. **No sync, schedule or page load runs its engines**
(stopped November 2026). The owner chose to **keep** the assessment, signal and trend
engines for future use.

Dead-code tools will report most of them as unused. That is expected: **do not delete
them without asking the owner**, and do not wire them back into sync without that
decision.

The current pipeline is elsewhere: `features` → `decisions` → policy → `advertising`,
with `insights`, `lifecycle` and `dashboard/insights` for what owners see.

## Active

| Path | Used by |
| --- | --- |
| `assistant/` | Ask DeepVisor (behind `DEEPVISOR_ASSISTANT`) |
| `repositories/notifications.ts` | bell and Notifications page reads; trend engine writes |
| `repositories/notificationPreferences.ts`, `reportSubscriptions.ts` | alert settings, hidden (`ALERT_PREFERENCES_AVAILABLE`) |
| `repositories/trendFindings.ts` | trend engine storage. Decisions, Reports and the assistant stop reading it while `STORED_FINDINGS_AVAILABLE` is off |

## Kept engines

| Path | What it can do | Entry point today |
| --- | --- | --- |
| `assessments/`, `repositories/assessments.ts` | account digest, state and maturity classification, creative fatigue, optional OpenAI summary | none |
| `service.ts` | business-wide assessment orchestration and selection | none |
| `signals/`, `repositories/signals.ts` | deterministic account signals from an assessment | none |
| `trends/` | best-time, daily trend and stale-delivery findings, with notifications | manual `POST api/intelligence/findings/run` |

`api/intelligence/findings` and its `dismiss` route also remain, without any UI.

Before reusing the assessments, paginate
`repositories/ad_accounts/getAdAccountPerformance.ts`, which only they use. It reads
every campaign day in one request, so a large account's totals can be silently cut at
the API row limit.

## Calendar (deleted)

The calendar, campaign review reports and archived report pages were removed in
November 2026; their old links redirect. Git history has the code. Preserved and
untouched: the `calendar_queue_*` tables and database functions, the paused cron job
(migration `20261119211138`), and the private `report-archive-pdfs` storage bucket.
The `process_calendar_queue` Edge Function may still be deployed although its source
is gone; the route it forwarded to no longer exists.
