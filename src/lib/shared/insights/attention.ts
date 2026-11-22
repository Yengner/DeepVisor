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
const shortDate = (at: string, zone: string, locale = 'en') => {
  try {
    return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', timeZone: zone }).format(new Date(at));
  } catch {
    return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(at));
  }
};

/**
 * Optional wording for the list. Without it the English below is used. `words` is `issueWords`
 * bound to a translator; `staleNote` words "Last reported by Meta on {day}"; `ending` words an ad
 * set that is about to end ("{name} ends today").
 */
export type AttentionText = {
  words?: (issue: IssueEvidence) => { title: string; explanation: string; action: string };
  staleNote?: (day: string) => string;
  ending?: (name: string, daysLeft: number) => { title: string; detail: string };
  /** Intl locale for the date in the stale note, e.g. `es-US`. */
  locale?: string;
};

export function issueAttention(issue: IssueEvidence & { observedAt: string }, now: string, zone: string, text: AttentionText = {}): AttentionItem {
  const stale = Date.parse(now) - Date.parse(issue.observedAt) > STALE_MS;
  const words = text.words ? text.words(issue) : { title: issue.title, explanation: issue.explanation, action: issue.action };
  const day = shortDate(issue.observedAt, zone, text.locale);
  return {
    key: `issue:${issue.key}`,
    tone: 'urgent',
    title: words.title,
    detail: words.explanation,
    action: { label: words.action, href: issue.href },
    note: stale ? (text.staleNote ? text.staleNote(day) : `Last reported by Meta on ${day}`) : undefined,
  };
}

export function endingAttention(
  adset: { id: string; name: string; delivery: string; schedule?: AdSchedule },
  action?: { label: string; href: string },
  ending?: AttentionText['ending'],
): AttentionItem | null {
  if (adset.delivery !== 'ACTIVE' || !endingSoon(adset.schedule)) return null;
  const words = ending
    ? ending(adset.name, adset.schedule!.daysLeft ?? 0)
    : (() => {
        const when = endingLabel(adset.schedule)!;
        return {
          title: `${adset.name} ${when.charAt(0).toLowerCase()}${when.slice(1)}`,
          detail: 'To keep it running, extend its schedule in Meta.',
        };
      })();
  return { key: `ending:${adset.id}`, tone: 'soon', title: words.title, detail: words.detail, action };
}

/** Urgent first, then the soonest endings; the order within each group is kept. */
export function attentionItems(
  issues: Array<IssueEvidence & { observedAt: string }>,
  adsets: Array<{ id: string; name: string; delivery: string; schedule?: AdSchedule }>,
  options: { now: string; zone: string; endingAction?: { label: string; href: string } } & AttentionText,
): AttentionItem[] {
  const seen = new Set<string>();
  const urgent = issues.map((issue) => issueAttention(issue, options.now, options.zone, options))
    .filter((item) => (seen.has(item.title) ? false : (seen.add(item.title), true)));
  const ending = adsets
    .map((adset) => ({ adset, item: endingAttention(adset, options.endingAction, options.ending) }))
    .filter((entry): entry is { adset: typeof entry.adset; item: AttentionItem } => entry.item !== null)
    .sort((a, b) => (a.adset.schedule!.daysLeft ?? 0) - (b.adset.schedule!.daysLeft ?? 0))
    .map((entry) => entry.item);
  return [...urgent, ...ending];
}
