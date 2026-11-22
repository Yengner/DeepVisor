'use client';

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { issueWords, type IssueTranslate } from '@/lib/shared/insights/issueText';

/** Words a saved issue in the reader's language (see `issueWords`); unknown codes keep the saved English. */
export function useIssueWords() {
  const t = useTranslations('issueText');
  return useCallback(
    (issue: Parameters<typeof issueWords>[0]) => issueWords(issue, t as unknown as IssueTranslate),
    [t]
  );
}
