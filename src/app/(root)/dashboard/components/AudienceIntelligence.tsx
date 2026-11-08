'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { AudienceObservation } from '@/lib/shared/reports/audience';
import type { HourlyObservation } from '@/lib/shared/reports/timeAnalysis';
import AudienceChart from './intelligence/AudienceChart';
import TimeChart from './intelligence/TimeChart';
import styles from './intelligence/Intelligence.module.css';

type Props = {
  audience: AudienceObservation[] | null; hourly: HourlyObservation[] | null; currency: string | null;
  zone: string; period: 'today' | '7d' | '30d'; platform: 'combined' | 'facebook' | 'instagram';
  fetchedAt: string; audienceFetchedAt?: string; hourlyFetchedAt?: string; audienceCombinedOnly: boolean; hourlyCombinedOnly: boolean; since: string; until: string;
};
export const dateLabel = (date: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
export default function AudienceIntelligence(props: Props) {
  const params = useSearchParams();
  const combined = new URLSearchParams(params.toString()); combined.delete('publisher');
  const name = props.platform === 'combined' ? 'Combined Meta' : props.platform === 'facebook' ? 'Facebook' : 'Instagram';
  const scope = `${name} · ${props.since === props.until ? dateLabel(props.until) : `${dateLabel(props.since)}–${dateLabel(props.until)}`}`;
  const unavailable = (combinedOnly: boolean) => <div className={styles.empty}><strong>This breakdown isn’t available</strong><p>{combinedOnly && props.platform !== 'combined' ? `Meta returned combined data only. It cannot be attributed to ${name}.` : 'No compatible observations were returned for this period and platform.'}</p>{combinedOnly && props.platform !== 'combined' ? <Link href={`?${combined}`} scroll={false}>View combined Meta data →</Link> : <Link href="/reports">Explore saved reports →</Link>}</div>;
  const footer = (dates: Array<string | null>, kind: string, fetchedAt: string) => {
    const observed = [...new Set(dates.filter((d): d is string => Boolean(d)))].sort();
    return <details className={styles.details}><summary>Source & coverage</summary><p>{scope}. {observed.length} observed date{observed.length === 1 ? '' : 's'}{observed.length ? ` (${dateLabel(observed[0])}–${dateLabel(observed[observed.length - 1])})` : ''}. Only returned observations are included; missing dates are not zero. Today is partial.</p><p>{props.zone}. {fetchedAt ? `Retrieved ${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: props.zone }).format(new Date(fetchedAt))}.` : 'Retrieval time unavailable.'} Meta reporting may be delayed or revised. {kind}</p></details>;
  };
  return <div className={styles.grid}>
    <section className={styles.panel} aria-labelledby="audience-title"><header className={styles.header}><span className={styles.eyebrow}>Who your ads reach</span><h2 id="audience-title">Audience breakdown</h2><p>{scope}</p></header>
      {props.audience?.length ? <AudienceChart rows={props.audience} currency={props.currency} /> : unavailable(props.audienceCombinedOnly)}
      {footer((props.audience ?? []).map(r => r.date), 'Delivery demographics are not verified customer demographics. Results count reported leads, conversations and calls separately from bookings.', props.audienceFetchedAt ?? props.fetchedAt)}
    </section>
    <section className={styles.panel} aria-labelledby="time-title"><header className={styles.header}><span className={styles.eyebrow}>When your ads deliver</span><h2 id="time-title">Performance by time</h2><p>{scope} · Advertiser time</p></header>
      {props.hourly?.length ? <TimeChart rows={props.hourly} currency={props.currency} today={props.period === 'today'} /> : unavailable(props.hourlyCombinedOnly)}
      {footer((props.hourly ?? []).map(r => r.dayKey), 'This hourly source contains delivery metrics. Attributed results and cost per result are unavailable; higher delivery does not identify an optimal hour.', props.hourlyFetchedAt ?? props.fetchedAt)}
    </section>
  </div>;
}
