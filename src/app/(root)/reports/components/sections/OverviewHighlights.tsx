'use client';
import { IconChevronRight, IconPhoto, IconSpeakerphone, IconStack2 } from '@tabler/icons-react';
import type { ReportPayload } from '@/lib/server/reports/types';
import { formatReportMetric } from '@/lib/shared/reports/metrics';
import { WEEKDAYS } from '@/lib/shared/reports/timeAnalysis';
import { busiestHour, snapshotShares, topAdvertising, type SnapshotHighlight } from '@/lib/shared/reports/highlights';
import { formatHour, formatSnapshotWindow, humanizeContext } from '@/lib/shared/reports/labels';
import { previewSources } from '@/lib/shared/media/preview';
import type { ReportSection } from '../layout/ReportSections';
import classes from '../Workspace.module.css';

/** Whole percent; a real but tiny share reads "<1%" rather than a misleading 0%. */
const pct = (share: number) => share > 0 && share < 0.005 ? '<1%' : `${Math.round(share * 100)}%`;
const barWidth = (share: number) => `${Math.max(share * 100, share > 0 ? 1 : 0)}%`;
const LEVEL = { campaign: 'Campaign', adset: 'Ad set', ad: 'Ad' } as const;

function Card({ title, target, onOpen, wide, children }: {
  title: string; target: ReportSection; onOpen: (section: ReportSection) => void; wide?: boolean; children: React.ReactNode;
}) {
  return (
    <article className={`${classes.highlight} ${wide ? classes.highlightWide : ''}`}>
      <div className={classes.highlightHeader}>
        <h3>{title}</h3>
        <button type="button" className={classes.highlightLink} onClick={() => onOpen(target)}>
          Details<IconChevronRight size={14} aria-hidden="true" />
        </button>
      </div>
      {children}
    </article>
  );
}

function Shares({ data, emptyText }: { data: SnapshotHighlight | null; emptyText: string }) {
  if (!data) return <p className={classes.highlightEmpty}>{emptyText}</p>;
  return <>
    <p className={classes.highlightMeta}>Share of spend · snapshot {formatSnapshotWindow(data.window)}</p>
    <ul className={classes.shares}>
      {data.segments.map(segment => (
        <li key={segment.label} className={classes.share}>
          <span>{segment.label}</span><strong>{pct(segment.share)}</strong>
          <span className={classes.shareTrack} aria-hidden="true"><span style={{ width: barWidth(segment.share) }} /></span>
        </li>
      ))}
    </ul>
  </>;
}

/**
 * One-glance summary of the other sections. Every number is selected from the same model the
 * linked section uses; when evidence is thin the card says so instead of naming a winner.
 */
export function OverviewHighlights({ payload, onOpen }: { payload: ReportPayload; onOpen: (section: ReportSection) => void }) {
  const currency = payload.meta.currencyCode;
  const top = topAdvertising(payload);
  const audience = snapshotShares(payload, 'age_gender');
  const platforms = snapshotShares(payload, 'publisher_platform');
  const countries = snapshotShares(payload, 'country', 1);
  const peak = busiestHour(payload);
  const metricLabel = top.metric === 'conversion' ? 'results' : 'spend';

  return (
    <section className={classes.highlights} aria-label="Report highlights">
      <Card title="Top advertising" target="advertising" onOpen={onOpen} wide>
        {top.rows.length ? <>
          <p className={classes.highlightMeta}>Ranked by {metricLabel} for the selected dates</p>
          <ol className={classes.rankList}>
            {top.rows.map(row => {
              const image = row.level === 'ad' ? previewSources(row.creativePreview ?? undefined, [])[0] : undefined;
              const context = [row.secondaryContext, row.primaryContext].map(humanizeContext).filter(v => v && v !== '—').join(' · ');
              return (
                <li key={`${row.level}:${row.id}`} className={classes.rankItem}>
                  <span className={classes.rankThumb} aria-hidden="true">
                    {/* eslint-disable-next-line @next/next/no-img-element -- server-resolved preview URL */}
                    {image ? <img src={image} alt="" loading="lazy" referrerPolicy="no-referrer" /> : row.level === 'campaign' ? <IconSpeakerphone size={18} /> : row.level === 'adset' ? <IconStack2 size={18} /> : <IconPhoto size={18} />}
                  </span>
                  <span className={classes.rankName}>
                    <strong title={row.name}>{row.name}</strong>
                    <span>{LEVEL[row.level]}{context ? ` · ${context}` : ''}</span>
                  </span>
                  <span className={classes.rankValue}>
                    <strong>{formatReportMetric(row, top.metric, currency)}</strong>
                    <span>{top.metric === 'conversion' ? `${formatReportMetric(row, 'costPerResult', currency)} each` : 'spend'}</span>
                  </span>
                </li>
              );
            })}
          </ol>
        </> : <p className={classes.highlightEmpty}>No advertising recorded activity in this period.</p>}
      </Card>

      <Card title="Audience" target="audience" onOpen={onOpen}>
        <Shares data={audience} emptyText="No audience breakdown is available for this selection." />
      </Card>

      <Card title="Placements" target="delivery" onOpen={onOpen}>
        <Shares data={platforms} emptyText="No placement breakdown is available for this selection." />
      </Card>

      <Card title="Busiest hours" target="time" onOpen={onOpen}>
        {peak ? (
          <p className={classes.statement}>
            {WEEKDAYS[peak.day]}s, {formatHour(peak.hour)}–{formatHour(peak.hour + 1)}
            <small>Most clicks on average ({peak.value.toLocaleString('en-US', { maximumFractionDigits: 1 })} per {WEEKDAYS[peak.day]}) across {peak.observations} observed days, account time</small>
          </p>
        ) : (
          <p className={classes.highlightEmpty}>
            {payload.meta.timezone ? 'Not enough hourly history yet — each hour needs at least two observed days.' : 'Needs a verified account timezone.'}
          </p>
        )}
      </Card>

      <Card title="Geography" target="geography" onOpen={onOpen}>
        {countries ? (
          <p className={classes.statement}>
            {countries.segments[0].share >= 0.995 ? `All spend in ${countries.segments[0].label}` : `${pct(countries.segments[0].share)} of spend in ${countries.segments[0].label}`}
            <small>Snapshot {formatSnapshotWindow(countries.window)}</small>
          </p>
        ) : <p className={classes.highlightEmpty}>No country breakdown is available for this selection.</p>}
      </Card>
    </section>
  );
}
