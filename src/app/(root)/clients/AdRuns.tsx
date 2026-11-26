import { getTranslations } from 'next-intl/server';
import { ENDING_SOON_DAYS } from '@/lib/shared/clients/model';
import type { AdRun } from '@/lib/server/clients/load';
import styles from './Clients.module.css';

const SHOWN = 5;

/** Each ad set's schedule as saved at the last sync. No end date means no bar, never a guess. */
export default async function AdRuns({ runs, zone, locale }: { runs: AdRun[]; zone: string; locale: string }) {
  const t = await getTranslations('clients.runs');
  if (!runs.length) return <p className={styles.muted}>{t('none')}</p>;
  const date = (value: string) => new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', year: 'numeric', timeZone: zone }).format(new Date(value));
  const row = (run: AdRun) => {
    const dates = run.start && run.end ? t('range', { start: date(run.start), end: date(run.end) })
      : run.start ? t('startedOpen', { start: date(run.start) })
      : run.end ? t('endsOnly', { end: date(run.end) }) : t('noDates');
    const status = run.state === 'running' && run.daysLeft !== null ? t('daysLeft', { count: run.daysLeft })
      : run.state === 'running' && !run.end ? t('noEnd') : t(`state.${run.state}`);
    const soon = run.state === 'running' && run.daysLeft !== null && run.daysLeft <= ENDING_SOON_DAYS;
    return (
      <li key={run.id} className={styles.run} data-state={run.state} data-soon={soon ? '' : undefined}>
        <div className={styles.runTop}>
          <span className={styles.runName}>{run.name}</span>
          <span>{status}</span>
        </div>
        {run.progress !== null && (
          <div className={styles.track} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(run.progress * 100)} aria-label={t('progress', { name: run.name })}>
            <span className={styles.fill} style={{ width: `${run.progress * 100}%` }} />
          </div>
        )}
        <p className={styles.muted}>{dates} · {t('adCount', { count: run.ads })}</p>
      </li>
    );
  };
  return (
    <>
      <ul className={styles.runs}>{runs.slice(0, SHOWN).map(row)}</ul>
      {runs.length > SHOWN && (
        <details>
          <summary>{t('more', { count: runs.length - SHOWN })}</summary>
          <ul className={styles.runs}>{runs.slice(SHOWN).map(row)}</ul>
        </details>
      )}
    </>
  );
}
