import { IconInfoCircle } from '@tabler/icons-react';
import type { ReportPayload } from '@/lib/server/reports/types';
import { coverageSentence, formatReportRange } from '@/lib/shared/reports/labels';
import classes from './Workspace.module.css';

/**
 * Data-quality banner for the report period: coverage in plain words, source warnings and why a
 * requested comparison is unavailable. Missing records are described as gaps, never zero.
 */
export function ReportDataStatus({ payload }: { payload: ReportPayload }) {
  const coverage = coverageSentence(payload.meta.coverage);
  const messages = [...new Set([
    ...(coverage ? [coverage] : []),
    ...(payload.meta.warnings ?? []),
    ...(payload.comparison.disabledReason ? [payload.comparison.disabledReason] : []),
    ...(payload.comparison.basis === 'matched_days' && payload.comparison.matchedDays
      ? [`Changes compare only the ${payload.comparison.matchedDays} days with records in both periods (${formatReportRange(payload.comparison.previousDateFrom, payload.comparison.previousDateTo)} is the previous period).`]
      : []),
  ])];
  if (!messages.length) return null;
  const attention = payload.meta.coverage?.state === 'error' || payload.meta.coverage?.state === 'empty';
  return (
    <div role="status" className={classes.banner} data-tone={attention ? 'attention' : undefined}>
      <IconInfoCircle size={16} aria-hidden="true" />
      <div>{messages.map(message => <p key={message}>{message}</p>)}</div>
    </div>
  );
}
