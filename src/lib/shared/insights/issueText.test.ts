import { describe, expect, it } from 'vitest';
import en from '../../../../messages/en.json';
import es from '../../../../messages/es.json';
import { accountHealthIssues } from './health';
import { fatigueIssues, hierarchyIssues } from './model';
import type { Observation } from '@/lib/shared/lifecycle/model';
import { issueWords, parseDelivery, parseDisapproved, parseFatigue, type IssueTranslate } from './issueText';

const entity = (over: Partial<Observation>) => ({ id: 'ad1', name: 'Autumn promo', level: 'ad', effective: 'ACTIVE', ...over }) as Observation;

/** Looks keys up in a real catalog and fails on a missing key or an unfilled placeholder. */
function translatorFor(messages: typeof en): IssueTranslate {
  return (key, values = {}) => {
    const found = key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], messages.issueText);
    if (typeof found !== 'string') throw new Error(`Missing issueText.${key}`);
    return found.replace(/\{(\w+)\}/g, (_, name) => {
      if (!(name in values)) throw new Error(`issueText.${key} needs {${name}}`);
      return values[name];
    });
  };
}

describe('issue sentences parse back from what model.ts writes', () => {
  it('disapproved', () => {
    const [plain] = hierarchyIssues([entity({ effective: 'DISAPPROVED' })]);
    expect(parseDisapproved(plain.explanation)).toEqual({ name: 'Autumn promo', notice: null });
    const [noted] = hierarchyIssues([entity({ effective: 'DISAPPROVED' })], new Map([['ad1', { code: null, summary: 'Policy: "text" issue' }]]));
    expect(parseDisapproved(noted.explanation)).toEqual({ name: 'Autumn promo', notice: 'Policy: "text" issue' });
  });

  it('delivery issue, including a name with a period', () => {
    const [plain] = hierarchyIssues([entity({ effective: 'WITH_ISSUES', name: 'Spring v2. Final' })]);
    expect(parseDelivery(plain.explanation)).toEqual({ name: 'Spring v2. Final', notice: null });
    const [noted] = hierarchyIssues([entity({ effective: 'WITH_ISSUES' })], new Map([['ad1', { code: null, summary: 'Card declined' }]]));
    expect(parseDelivery(noted.explanation)).toEqual({ name: 'Autumn promo', notice: 'Card declined' });
  });

  it('creative fatigue with and without level and notice', () => {
    const cases = [
      { level: null, message: null },
      { level: 'HIGH', message: null },
      { level: null, message: 'Frequency is high' },
      { level: 'MEDIUM', message: 'Ad shown “a lot”' },
    ];
    for (const notice of cases) {
      const [issue] = fatigueIssues([entity({})], new Map([['ad1', notice]]));
      expect(parseFatigue(issue.explanation)).toEqual({
        name: 'Autumn promo',
        level: notice.level ? notice.level.toLowerCase() : null,
        notice: notice.message,
      });
    }
  });

  it('returns null for text it did not write', () => {
    expect(parseDisapproved('Something else entirely')).toBeNull();
    expect(parseDelivery('Something else entirely')).toBeNull();
    expect(parseFatigue('Something else entirely')).toBeNull();
  });
});

describe('issueWords', () => {
  const noted = new Map([['ad1', { code: null, summary: 'Card declined' }]]);
  const issues = [
    ...hierarchyIssues([entity({ effective: 'DISAPPROVED' })]),
    ...hierarchyIssues([entity({ effective: 'DISAPPROVED' })], noted),
    ...hierarchyIssues([entity({ effective: 'WITH_ISSUES' })]),
    ...hierarchyIssues([entity({ effective: 'WITH_ISSUES' })], noted),
    ...fatigueIssues([entity({})], new Map([['ad1', { level: 'HIGH', message: 'Seen too often' }]])),
    ...fatigueIssues([entity({})], new Map([['ad1', { level: 'odd', message: null }]])),
    { key: 'reauth', title: 'Reconnect Meta to keep data current', explanation: 'x', action: 'Open Connections', href: '/integration', entities: [], code: 'REAUTH_REQUIRED' },
    // every account cause, from real Meta status and reason codes
    ...[[3], [8], [2, 3], [2, 1], [7], [2, 15], [101], [2, 99]].flatMap(([status, reason]) => accountHealthIssues({ account_status: status, disable_reason: reason }, '1') ?? []),
  ];

  for (const [locale, messages] of [['en', en], ['es', es]] as const) {
    it(`words every issue in the ${locale} catalog without a missing key or placeholder`, () => {
      const t = translatorFor(messages);
      for (const issue of issues) {
        const words = issueWords(issue, t);
        expect(words.title && words.explanation && words.action).toBeTruthy();
      }
    });
  }

  it('words the English catalog exactly as it was saved', () => {
    const t = translatorFor(en);
    for (const issue of issues) {
      if (issue.code === 'REAUTH_REQUIRED') continue;
      const words = issueWords(issue, t);
      expect(words).toEqual({ title: issue.title, explanation: issue.explanation, action: issue.action });
    }
  });

  it('puts the ad name and Meta’s notice into the Spanish sentence', () => {
    const [issue] = hierarchyIssues([entity({ effective: 'DISAPPROVED' })], noted);
    expect(issueWords(issue, translatorFor(es)).explanation).toBe('Autumn promo aparece como no aprobado. Aviso de Meta: “Card declined”');
  });

  it('keeps the saved English for a code or sentence it does not know', () => {
    const t = translatorFor(es);
    const base = { title: 'T', explanation: 'E', action: 'A' };
    expect(issueWords({ ...base, code: 'SOMETHING_NEW' }, t)).toEqual(base);
    expect(issueWords({ ...base, code: 'DISAPPROVED' }, t)).toEqual(base);
  });
});
