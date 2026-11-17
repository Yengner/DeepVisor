/**
 * "Needs attention" items shown at the top of Overview and Alerts. Pure: no I/O.
 * Urgent: Meta reports something that stops or threatens delivery (billing, review, rejection).
 * Soon: an active ad set's scheduled run ends within two calendar days.
 */
import type { IssueEvidence } from './model';
import { endingLabel, endingSoon, type AdSchedule } from '@/lib/shared/performance/schedule';

export type AttentionItem = {
  key: string;
  tone: 'urgent' | 'soon';
  title: string;
  detail: string;
  action?: { label: string; href: string };
  note?: string;
};

const STALE_MS = 24 * 3600_000;
const shortDate = (at: string, zone: string) => {
  try {
    return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: zone }).format(new Date(at));
  } catch {
    return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(at));
  }
};

export function issueAttention(issue: IssueEvidence & { observedAt: string }, now: string, zone: string): AttentionItem {
  const stale = Date.parse(now) - Date.parse(issue.observedAt) > STALE_MS;
  return {
    key: `issue:${issue.key}`,
    tone: 'urgent',
    title: issue.title,
    detail: issue.explanation,
    action: { label: issue.action, href: issue.href },
    note: stale ? `Last reported by Meta on ${shortDate(issue.observedAt, zone)}` : undefined,
  };
}

export function endingAttention(
  adset: { id: string; name: string; delivery: string; schedule?: AdSchedule },
  action?: { label: string; href: string },
): AttentionItem | null {
  if (adset.delivery !== 'ACTIVE' || !endingSoon(adset.schedule)) return null;
  const when = endingLabel(adset.schedule)!;
  return {
    key: `ending:${adset.id}`,
    tone: 'soon',
    title: `${adset.name} ${when.charAt(0).toLowerCase()}${when.slice(1)}`,
    detail: 'To keep it running, extend its schedule in Meta.',
    action,
  };
}

/** Urgent first, then the soonest endings; the order within each group is kept. */
export function attentionItems(
  issues: Array<IssueEvidence & { observedAt: string }>,
  adsets: Array<{ id: string; name: string; delivery: string; schedule?: AdSchedule }>,
  options: { now: string; zone: string; endingAction?: { label: string; href: string } },
): AttentionItem[] {
  const seen = new Set<string>();
  const urgent = issues.map((issue) => issueAttention(issue, options.now, options.zone))
    .filter((item) => (seen.has(item.title) ? false : (seen.add(item.title), true)));
  const ending = adsets
    .map((adset) => ({ adset, item: endingAttention(adset, options.endingAction) }))
    .filter((entry): entry is { adset: typeof entry.adset; item: AttentionItem } => entry.item !== null)
    .sort((a, b) => (a.adset.schedule!.daysLeft ?? 0) - (b.adset.schedule!.daysLeft ?? 0))
    .map((entry) => entry.item);
  return [...urgent, ...ending];
}
