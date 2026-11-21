'use client';
import { IconChevronRight, IconPhoto, IconSpeakerphone, IconStack2 } from '@tabler/icons-react';
import type { ReportPayload } from '@/lib/server/reports/types';
import { useLabels } from '@/lib/client/hooks/useLabels';
import { useReportFormat, type ReportFormat } from '../useReportFormat';
import { busiestHour, MIN_HOUR_OBSERVATIONS, snapshotShares, topAdvertising, type SnapshotHighlight } from '@/lib/shared/reports/highlights';
import { humanizeContext } from '@/lib/shared/reports/labels';
import { previewSources } from '@/lib/shared/media/preview';
import type { ReportSection } from '../layout/ReportSections';
import classes from '../Workspace.module.css';

/** Whole percent; a real but tiny share reads "<1%" rather than a misleading 0%. */
const pct = (share: number) => share > 0 && share < 0.005 ? '<1%' : `${Math.round(share * 100)}%`;
const barWidth = (share: number) => `${Math.max(share * 100, share > 0 ? 1 : 0)}%`;

function Card({ title, target, onOpen, wide, children, details }: {
  title: string; target: ReportSection; onOpen: (section: ReportSection) => void; wide?: boolean; children: React.ReactNode; details: string;
}) {
  return (
    <article className={`${classes.highlight} ${wide ? classes.highlightWide : ''}`}>
      <div className={classes.highlightHeader}>
        <h3>{title}</h3>
        <button type="button" className={classes.highlightLink} onClick={() => onOpen(target)}>
          {details}<IconChevronRight size={14} aria-hidden="true" />
        </button>
      </div>
      {children}
    </article>
  );
}

function Shares({ data, emptyText, f, dimension }: { data: SnapshotHighlight | null; emptyText: string; f: ReportFormat; dimension: string }) {
  if (!data) return <p className={classes.highlightEmpty}>{emptyText}</p>;
  return <>
    <p className={classes.highlightMeta}>{data.periodBased
      ? f.t('highlights.share', { window: f.snapshot(data.window) })
      : f.t('highlights.shareSnapshot')}</p>
    <ul className={classes.shares}>
      {data.segments.map(segment => (
        <li key={segment.label} className={classes.share}>
          <span>{f.segment(dimension, segment.label)}</span><strong>{pct(segment.share)}</strong>
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
  const f = useReportFormat(), t = f.t, labels = useLabels();
  const details = t('highlights.details');
  const formatReportMetric = f.value;
  const currency = payload.meta.currencyCode;
  const top = topAdvertising(payload);
  const audience = snapshotShares(payload, 'age_gender');
  const platforms = snapshotShares(payload, 'publisher_platform');
  const countries = snapshotShares(payload, 'country', 1);
  const peak = busiestHour(payload);

  return (
    <section className={classes.highlights} aria-label={t('highlights.label')}>
      <Card title={t('highlights.top')} target="advertising" onOpen={onOpen} wide details={details}>
        {top.rows.length === 1 ? <>
          {/* One entity is not a ranking: say what it is. */}
          <p className={classes.highlightMeta}>{t('highlights.selectedDates')}</p>
          <p className={classes.soleSource}>
            <span className={classes.soleLead}>{t.rich('highlights.allFrom', { metric: top.metric === 'conversion' ? 'conversion' : 'spend', name: top.rows[0].name, b: chunks => <strong>{chunks}</strong> })}</span>
            <span className={classes.soleValue}>{top.metric === 'conversion' ? t('highlights.resultsEach', { value: formatReportMetric(top.rows[0], top.metric, currency), cost: formatReportMetric(top.rows[0], 'costPerResult', currency) }) : t('highlights.spendValue', { value: formatReportMetric(top.rows[0], top.metric, currency) })}</span>
          </p>
        </> : top.rows.length ? <>
          <p className={classes.highlightMeta}>{t('highlights.ranked', { metric: top.metric === 'conversion' ? 'conversion' : 'spend' })}</p>
          <ol className={classes.rankList}>
            {top.rows.map(row => {
              const image = row.level === 'ad' ? previewSources(row.creativePreview ?? undefined, [])[0] : undefined;
              const context = [row.secondaryContext, row.primaryContext].map(v => v && /^[A-Z][A-Z0-9_]+$/.test(v) ? labels.objective(v) : humanizeContext(v)).filter(v => v && v !== '—').join(' · ');
              return (
                <li key={`${row.level}:${row.id}`} className={classes.rankItem}>
                  <span className={classes.rankThumb} aria-hidden="true">
                    {/* eslint-disable-next-line @next/next/no-img-element -- server-resolved preview URL */}
                    {image ? <img src={image} alt="" loading="lazy" referrerPolicy="no-referrer" /> : row.level === 'campaign' ? <IconSpeakerphone size={18} /> : row.level === 'adset' ? <IconStack2 size={18} /> : <IconPhoto size={18} />}
                  </span>
                  <span className={classes.rankName}>
                    <strong title={row.name}>{row.name}</strong>
                    <span>{t(`level.${row.level}`)}{context ? ` · ${context}` : ''}</span>
                  </span>
                  <span className={classes.rankValue}>
                    <strong>{formatReportMetric(row, top.metric, currency)}</strong>
                    <span>{top.metric === 'conversion' ? t('highlights.each', { cost: formatReportMetric(row, 'costPerResult', currency) }) : t('highlights.spend')}</span>
                  </span>
                </li>
              );
            })}
          </ol>
        </> : <p className={classes.highlightEmpty}>{t('highlights.none')}</p>}
      </Card>

      <Card title={t('highlights.audience')} target="audience" onOpen={onOpen} details={details}>
        <Shares data={audience} f={f} dimension="age_gender" emptyText={t('highlights.audienceEmpty')} />
      </Card>

      <Card title={t('highlights.placements')} target="delivery" onOpen={onOpen} details={details}>
        <Shares data={platforms} f={f} dimension="publisher_platform" emptyText={t('highlights.placementsEmpty')} />
      </Card>

      <Card title={t('highlights.busiest')} target="time" onOpen={onOpen} details={details}>
        <p className={classes.highlightMeta}>{t('highlights.busiestMeta')}</p>
        {peak ? (
          <p className={classes.statement}>
            {t('highlights.hourSpan', { day: f.weekday(peak.day), from: f.hour(peak.hour), to: f.hour(peak.hour + 1) })}
            <small>{t('highlights.busiestValue', { value: f.number(peak.value, 1), day: f.weekday(peak.day), days: peak.observations })}</small>
          </p>
        ) : (
          <p className={classes.highlightEmpty}>
            {payload.meta.timezone ? t('highlights.busiestThin', { min: MIN_HOUR_OBSERVATIONS }) : t('highlights.needsZone')}
          </p>
        )}
      </Card>

      <Card title={t('highlights.geography')} target="geography" onOpen={onOpen} details={details}>
        {countries ? <>
          <p className={classes.highlightMeta}>{countries.periodBased ? t('highlights.share', { window: f.snapshot(countries.window) }) : t('highlights.shareSnapshot')}</p>
          <p className={classes.statement}>
            {countries.segments[0].share >= 0.995 ? t('highlights.allIn', { place: f.segment('country', countries.segments[0].label) }) : t('highlights.shareIn', { pct: pct(countries.segments[0].share), place: f.segment('country', countries.segments[0].label) })}
          </p>
        </> : <p className={classes.highlightEmpty}>{t('highlights.geoEmpty')}</p>}
      </Card>
    </section>
  );
}
