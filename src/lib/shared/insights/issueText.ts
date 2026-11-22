/**
 * Wording for saved issues, in the reader's language.
 *
 * An issue is saved with English `title`/`explanation`/`action` (see `hierarchyIssues`,
 * `fatigueIssues`, `accountHealthIssues`), but it also has a stable `code`. Screens word it from the
 * code, so Spanish readers see Spanish, including for issues saved before this existed. Anything this
 * does not recognise keeps the saved English, so a new code never shows up blank.
 *
 * Changing what is saved would change `insight_issues.evidence`, which the database treats as a new
 * revision and so shows every open issue again. So the pieces a sentence needs (the ad's name, Meta's
 * own notice, the fatigue level) are read back from the saved sentence instead. The sentences are
 * written in `model.ts`; `issueText.test.ts` builds them there and parses them back, so the two
 * cannot drift apart unnoticed.
 */
import { causeFromCode } from './health';
import type { IssueEvidence } from './model';

/** A `useTranslations('issueText')` / `getTranslations('issueText')` translator, loosely typed. */
export type IssueTranslate = (key: string, values?: Record<string, string>) => string;
export type IssueWords = { title: string; explanation: string; action: string };

type Wordable = Pick<IssueEvidence, 'code' | 'title' | 'explanation' | 'action'>;

const NOTICE = 'Meta’s notice: “([\\s\\S]*?)”';

/** "{name} is reported as disapproved. Meta’s notice: “…”" (or the plain variant). */
export function parseDisapproved(explanation: string): { name: string; notice: string | null } | null {
  const m = new RegExp(`^([\\s\\S]*?) is reported as disapproved\\. (?:${NOTICE}|Review Meta’s explanation before making changes\\.)$`).exec(explanation);
  return m ? { name: m[1], notice: m[2] ?? null } : null;
}

/** "{name} has a delivery issue. Meta’s notice: “…”" (or the plain variant). */
export function parseDelivery(explanation: string): { name: string; notice: string | null } | null {
  const m = new RegExp(`^([\\s\\S]*?) has a delivery issue\\. (?:${NOTICE}|The saved data does not establish its cause\\.)$`).exec(explanation);
  return m ? { name: m[1], notice: m[2] ?? null } : null;
}

/** "Meta reports that {name} is showing creative fatigue (level). Meta’s notice: “…” A fresh creative may help; …" */
export function parseFatigue(explanation: string): { name: string; level: string | null; notice: string | null } | null {
  const m = new RegExp(`^Meta reports that ([\\s\\S]*?) is showing creative fatigue(?: \\(([^)]*)\\))?\\.(?: ${NOTICE})? A fresh creative may help; nothing has been changed\\.$`).exec(explanation);
  return m ? { name: m[1], level: m[2] ?? null, notice: m[3] ?? null } : null;
}

export function issueWords(issue: Wordable, t: IssueTranslate): IssueWords {
  const saved = { title: issue.title, explanation: issue.explanation, action: issue.action };

  const cause = causeFromCode(issue.code);
  if (cause) {
    return { title: t(`cause.${cause}.title`), explanation: t(`cause.${cause}.explanation`), action: t(`cause.${cause}.action`) };
  }

  switch (issue.code) {
    case 'REAUTH_REQUIRED':
      return { title: t('reauth.title'), explanation: t('reauth.explanation'), action: t('action.openConnections') };
    case 'DISAPPROVED': {
      const p = parseDisapproved(issue.explanation);
      if (!p) return saved;
      return {
        title: t('disapproved.title'),
        explanation: p.notice ? t('disapproved.withNotice', { name: p.name, notice: p.notice }) : t('disapproved.plain', { name: p.name }),
        action: t('action.reviewInCampaigns'),
      };
    }
    case 'WITH_ISSUES': {
      const p = parseDelivery(issue.explanation);
      if (!p) return saved;
      return {
        title: t('delivery.title'),
        explanation: p.notice ? t('delivery.withNotice', { name: p.name, notice: p.notice }) : t('delivery.plain', { name: p.name }),
        action: t('action.reviewInCampaigns'),
      };
    }
    case 'CREATIVE_FATIGUE': {
      const p = parseFatigue(issue.explanation);
      if (!p) return saved;
      const known = p.level && ['low', 'medium', 'high'].includes(p.level) ? t(`fatigue.level.${p.level}`) : p.level;
      return {
        title: t('fatigue.title'),
        explanation: t('fatigue.explanation', {
          name: p.name,
          level: known ? ` (${known})` : '',
          notice: p.notice ? ` ${t('fatigue.notice', { notice: p.notice })}` : '',
        }),
        action: t('action.reviewInCampaigns'),
      };
    }
    default:
      return saved;
  }
}
