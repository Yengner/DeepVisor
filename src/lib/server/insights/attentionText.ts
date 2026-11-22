import { getLocale, getTranslations } from 'next-intl/server';
import type { AttentionText } from '@/lib/shared/insights/attention';
import { issueWords, type IssueTranslate } from '@/lib/shared/insights/issueText';

/** Wording for `attentionItems` in the signed-in person's language (Overview and Notifications). */
export async function attentionText(): Promise<AttentionText> {
  const [t, locale] = await Promise.all([getTranslations('issueText'), getLocale()]);
  const say = t as unknown as IssueTranslate;
  return {
    words: (issue) => issueWords(issue, say),
    staleNote: (day) => say('staleNote', { day }),
    ending: (name, daysLeft) => ({
      title: daysLeft <= 0 ? say('ending.today', { name }) : daysLeft === 1 ? say('ending.tomorrow', { name }) : say('ending.days', { name, days: String(daysLeft) }),
      detail: say('ending.detail'),
    }),
    locale: locale === 'es' ? 'es-US' : 'en-US',
  };
}
