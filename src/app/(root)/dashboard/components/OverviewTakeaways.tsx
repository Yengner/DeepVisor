import Link from 'next/link';
import { IconArrowUpRight, IconClockHour4, IconUsers } from '@tabler/icons-react';
import type { AudienceObservation } from '@/lib/shared/reports/audience';
import type { HourlyObservation } from '@/lib/shared/reports/timeAnalysis';
import { audienceTakeaway, hourTakeaway } from '@/lib/shared/performance/takeaways';
import board from './ControlCenter.module.css';
import classes from './OverviewTakeaways.module.css';

type Props = {
  audience: AudienceObservation[] | null;
  hourly: HourlyObservation[] | null;
  currency: string | null;
  platform: 'combined' | 'facebook' | 'instagram';
  audienceCombinedOnly: boolean;
  hourlyCombinedOnly: boolean;
};

const percent = (share: number) => `${Math.round(share * 100)}%`;
const hourLabel = (hour: number) => `${hour % 12 || 12} ${hour >= 12 ? 'PM' : 'AM'}`;

/** One line each for who responds and when, from the same rows Reports charts in full. */
export default function OverviewTakeaways({ audience, hourly, currency, platform, audienceCombinedOnly, hourlyCombinedOnly }: Props) {
  const who = audienceTakeaway(audience);
  const when = hourTakeaway(hourly);
  const money = (value: number) => currency && currency !== 'MIXED'
    ? new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value)
    : null;
  const missing = (combinedOnly: boolean) => combinedOnly && platform !== 'combined'
    ? 'Meta reports this for all of Meta only'
    : 'No data for this period yet';

  const rows = [
    {
      key: 'audience',
      href: '/reports#audience',
      icon: <IconUsers size={20} aria-hidden="true" />,
      label: who?.basis === 'cost' ? 'Lowest cost per result' : who ? 'Most spend' : 'Audience',
      value: who?.segment ?? 'Not available',
      detail: !who ? missing(audienceCombinedOnly)
        : who.basis === 'cost'
          ? [money(who.costPerResult) && `${money(who.costPerResult)} per result`, `${who.results} results`].filter(Boolean).join(' · ')
          : `${percent(who.share)} of spend`,
      link: 'Audience report',
    },
    {
      key: 'time',
      href: '/reports#time',
      icon: <IconClockHour4 size={20} aria-hidden="true" />,
      label: when?.basis === 'results' ? 'Most results' : when ? 'Most spend' : 'Time of day',
      value: when ? `Around ${hourLabel(when.hour)}` : 'Not available',
      detail: when ? `${percent(when.share)} of ${when.basis === 'results' ? 'results' : 'spend'} in that hour` : missing(hourlyCombinedOnly),
      link: 'Time report',
    },
  ];

  return (
    <section className={classes.section} aria-labelledby="takeaways-title">
      <div className={board.boardHeader}><h2 id="takeaways-title">Who and when</h2></div>
      <ul className={classes.list}>
        {rows.map((row) => (
          <li key={row.key}>
            <Link href={row.href} className={classes.row}>
              <span className={classes.icon}>{row.icon}</span>
              <span className={classes.copy}>
                <span className={classes.label}>{row.label}</span>
                <strong>{row.value}</strong>
                <span className={classes.detail}>{row.detail}</span>
              </span>
              <span className={classes.go}>{row.link}<IconArrowUpRight size={15} aria-hidden="true" /></span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
