# server/intelligence

Older account intelligence. **No sync, schedule or page load runs its engines any
more** (stopped November 2026). The engine code is kept until the owner decides what
DeepVisor will reuse. Do not wire it back into sync without that decision, and do not
delete it without asking.

The current pipeline is elsewhere: `features` → `decisions` → policy → `advertising`,
with `insights`, `lifecycle` and `dashboard/insights` for what owners see.

## Active

| Path | Used by |
| --- | --- |
| `assistant/` | Ask DeepVisor (behind `DEEPVISOR_ASSISTANT`) |
| `repositories/notifications.ts` | bell and Notifications page reads |
| `repositories/notificationPreferences.ts`, `reportSubscriptions.ts` | alert settings, hidden (`ALERT_PREFERENCES_AVAILABLE`) |
| `repositories/reportArchive.ts` | Settings "Saved reports" and archived report pages |
| `repositories/trendFindings.ts` (reads) | Decisions findings, Reports findings, assistant `getStoredFindings`. Nothing writes new findings, so these stay as they were |

## Dormant, kept

| Path | What it can do | Only remaining way to run it |
| --- | --- | --- |
| `assessments/` | account digest, state and maturity classification, creative fatigue, optional OpenAI summary | `api/calendar/queue/rebuild`; the business summary has no caller (`service.ts`) |
| `signals/` | deterministic account signals and staged workflow drafts | `api/calendar/queue/rebuild` |
| `trends/` | best-time and daily trend findings, stale delivery, finding notifications | `api/intelligence/findings/run`, calendar processor |
| `calendarQueueProcessor.ts`, `repositories/calendarQueue*.ts`, `readModel.ts`, `calendarMode.ts` | calendar scheduling, templates, due-item processing | `api/calendar/*` |
| `campaignReviews/` | campaign review reports | calendar processor |
| `service.ts` | business-wide assessment orchestration | nothing |

Those API routes have no UI. They still require a signed-in business or the internal
key and run only when called directly. The calendar database cron is paused
(migration `20261119211138`) and the `process_calendar_queue` Edge Function remains
deployed. Related: `shared/utils/calendarQueue.ts`.
