import type { ReportPayload } from '@/lib/server/reports/types';
import classes from './Workspace.module.css';
import { coverageLabel } from '@/lib/shared/reports/coverage';

export function ReportDataStatus({ payload, snapshots = false }: { payload: ReportPayload; snapshots?: boolean }) {
  if (snapshots) return <div role="note">
    <p>Audience and delivery snapshots have their own measurement windows, independent of the selected report dates.</p>
    <dl>{Object.entries(payload.surface.coverage ?? {}).map(([dimension, coverage]) => <div key={dimension}>
      <dt>{dimension.replaceAll('_', ' ')}</dt><dd>{coverageLabel(coverage)}
        {coverage.state === 'mixed' && <span>: {coverage.windows?.map(w => `${w.dateFrom}–${w.dateTo}`).join('; ')}</span>}
      {Object.keys(payload.surface.unavailableMetrics?.[dimension] ?? {}).filter(key => !['reach', 'frequency'].includes(key)).length > 0 &&
        <span> · Unavailable metrics: {Object.keys(payload.surface.unavailableMetrics?.[dimension] ?? {}).filter(key => !['reach', 'frequency'].includes(key)).join(', ')}</span>}
      </dd>
    </div>)}</dl>
    <p>Placement and device results and cost per result are unavailable from the current delivery-only source.</p>
  </div>;
  const messages = [...(payload.meta.warnings ?? [])];
  if (payload.meta.coverage && payload.meta.coverage.state !== 'available') {
    messages.push(`Performance: ${coverageLabel(payload.meta.coverage)}. Missing records are not zero.`);
  }
  if (payload.comparison.disabledReason) messages.push(payload.comparison.disabledReason);
  if (!messages.length) return null;
  return <div role="status" className={classes.notice}>{[...new Set(messages)].join(' ')}</div>;
}
