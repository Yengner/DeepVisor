import { IconInfoCircle } from '@tabler/icons-react';
import type { ReportPayload } from '@/lib/server/reports/types';
import classes from './Workspace.module.css';
import { useReportFormat } from './useReportFormat';

/**
 * Data-quality banner for the report period: coverage in plain words, source warnings and why a
 * requested comparison is unavailable. Missing records are described as gaps, never zero.
 */
export function ReportDataStatus({ payload, onUpdate }: { payload: ReportPayload; onUpdate?: (mutate: (params: URLSearchParams) => void) => void }) {
  const f = useReportFormat(), t = f.t;
  const coverage = f.coverageSentence(payload.meta.coverage);
  const messages = [...new Set([
    ...(coverage ? [coverage] : []),
    ...(payload.meta.warnings ?? []),
    ...(payload.comparison.disabledReason ? [payload.comparison.disabledReason] : []),
    ...(payload.comparison.basis === 'matched_days' && payload.comparison.matchedDays
      ? [t('status.matched', { count: payload.comparison.matchedDays, range: f.range(payload.comparison.previousDateFrom, payload.comparison.previousDateTo) })]
      : []),
  ])];
  if (!messages.length) return null;
  // Records start after the chosen start date: offer the recorded days in one click.
  const { coverage: cov } = payload.meta;
  const recordedFrom = cov?.state === 'partial' && cov.basis === 'period' && cov.dateFrom && payload.query.dateFrom && cov.dateFrom > payload.query.dateFrom && payload.query.rangeMode !== 'max'
    ? cov.dateFrom : null;
  const attention = payload.meta.coverage?.state === 'error' || payload.meta.coverage?.state === 'empty';
  return (
    <div role="status" className={classes.banner} data-tone={attention ? 'attention' : undefined}>
      <IconInfoCircle size={16} aria-hidden="true" />
      <div>
        {messages.map(message => <p key={message}>{message}</p>)}
        {recordedFrom && onUpdate ? (
          <button type="button" className={classes.bannerAction} onClick={() => onUpdate(params => {
            params.delete('range');
            params.delete('preset');
            params.set('date_from', recordedFrom);
            params.set('date_to', payload.query.dateTo);
          })}>
            {t('status.showFrom', { day: f.day(recordedFrom, false) })}
          </button>
        ) : null}
      </div>
    </div>
  );
}
