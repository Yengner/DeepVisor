'use client';
import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { ActionIcon, Alert, Button, NumberInput, SegmentedControl } from '@mantine/core';
import { CalendarDays, Eye, Minus, Plus, TriangleAlert } from 'lucide-react';
import { MediaImage } from '@/components/campaigns/exploration/AdvertisingExplorer';
import ProjectionChart from '@/components/insights/ProjectionChart';
import { prepareRestartDraftAction } from '@/lib/server/actions/suggestions/restart';
import { STATS_DAYS } from '@/lib/shared/suggestions/idle';
import { USUAL_DAYS } from '@/lib/shared/suggestions/lastRun';
import { RERUN_DAY_CHOICES, RERUN_MAX_DAYS, RERUN_MIN_DAILY, RERUN_MIN_DAYS, rerunPlan, type RerunPlanData } from '@/lib/shared/suggestions/rerun';
import styles from './Rerun.module.css';

const OTHER = 'other';

/**
 * "Run this ad again": the ad, then the plan the owner controls (daily budget and days), with the
 * dates, total and an estimate that follow every change, then one main button that prepares a
 * paused draft. Rules only (`rerunPlan`), the owner's own history, nothing sent to Meta.
 */
export default function RerunPlanForm({ data, canPrepare }: { data: RerunPlanData; canPrepare: boolean }) {
  const t = useTranslations('rerun');
  const tSuggestion = useTranslations('suggestion');
  const tAll = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const intl = locale === 'es' ? 'es-US' : 'en-US';
  // Starts from what the ad did last time (`rerunDefaults`); the owner can change both.
  const [budget, setBudget] = useState<number>(data.start.dailyBudget);
  const [days, setDays] = useState<number>(data.start.days);
  const [customDays, setCustomDays] = useState(!(RERUN_DAY_CHOICES as readonly number[]).includes(data.start.days));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const plan = rerunPlan(data, budget, days);

  const money = (value: number, cents = !Number.isInteger(value)) => new Intl.NumberFormat(intl, {
    style: 'currency', currency: data.currency, minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0,
  }).format(value);
  const count = (value: number) => new Intl.NumberFormat(intl).format(value);
  const day = (value: string) => new Intl.DateTimeFormat(intl, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${value}T12:00:00Z`));
  const symbol = new Intl.NumberFormat(intl, { style: 'currency', currency: data.currency }).formatToParts(0).find(p => p.type === 'currency')?.value ?? data.currency;
  const step = budget >= 20 ? 5 : 1;
  const kind = data.resultKind;
  const dash = '—';

  const prepare = () => start(async () => {
    setError(null);
    const result = await prepareRestartDraftAction(data.adSetId, { dailyBudget: budget, days });
    if (!result.success) { setError(result.error?.userMessage ?? tSuggestion('error.failed')); return; }
    if (result.data) router.push(result.data.href);
  });

  const problem = plan.problem === 'budget-low' ? t('budgetLow', { min: money(RERUN_MIN_DAILY) })
    : plan.problem === 'budget-high' ? t('budgetHigh', { max: money(data.maxDaily) })
    : plan.problem === 'days' ? t('daysInvalid') : null;
  const blocked = plan.problem !== null;

  return (
    <>
      {/* The ad: owners recognise it by its picture, then its own numbers. */}
      <section className={styles.card} aria-labelledby="rerun-ad">
        <div className={styles.ad}>
          <div className={styles.media}>
            <MediaImage media={data.media ?? undefined} name={data.adSetName} labelPosition="top" dashboard />
          </div>
          <div className={styles.adBody}>
            <h2 id="rerun-ad" className={styles.adName}>{data.adSetName}</h2>
            <p className={styles.muted}>{tSuggestion('statsPeriod', { days: STATS_DAYS })}</p>
            {data.stats && (
              <dl className={styles.stats}>
                <div className={styles.lead}><dt>{tAll(`results.${kind}.short`)}</dt><dd>{data.stats.results === null ? dash : count(data.stats.results)}</dd></div>
                <div><dt>{tSuggestion('spent')}</dt><dd>{data.stats.spend === null ? dash : money(data.stats.spend)}</dd></div>
                <div><dt>{tAll(`results.${kind}.cost`)}</dt><dd>{data.stats.costPerResult === null ? dash : money(data.stats.costPerResult, true)}</dd></div>
              </dl>
            )}
            <div className={styles.lastTime}>
              <p>
                {data.run === null ? t('noRun', { days: STATS_DAYS })
                  : data.run.days === 1 ? t('lastRunOne', { start: day(data.run.firstDay), spend: money(data.run.spend) })
                  : t('lastRun', { days: data.run.days, start: day(data.run.firstDay), end: day(data.run.lastDay), spend: money(data.run.spend), perDay: money(data.run.perDay, true) })}
              </p>
              {data.setup.dailyBudget !== null ? <p>{t('setupDaily', { amount: money(data.setup.dailyBudget) })}</p>
                : data.setup.lifetimeBudget !== null ? <p>{data.setup.scheduledDays
                  ? t('setupLifetime', { amount: money(data.setup.lifetimeBudget), days: data.setup.scheduledDays, perDay: money(data.setup.lifetimeBudget / data.setup.scheduledDays, true) })
                  : t('setupLifetimeOpen', { amount: money(data.setup.lifetimeBudget) })}</p>
                : null}
            </div>
          </div>
        </div>
      </section>

      <section className={styles.card} aria-labelledby="rerun-plan">
        <div className={styles.planHead}>
          <h2 id="rerun-plan" className={styles.cardTitle}>{t('planTitle')}</h2>
          <p className={styles.startsFrom}>{t(`from.${data.start.budgetSource}`)}, {t(`fromDays.${data.start.daysSource}`)}</p>
        </div>

        <div className={styles.field}>
          <label htmlFor="rerun-budget" className={styles.label}>{t('budget')}</label>
          <div className={styles.stepper}>
            <ActionIcon size={48} variant="default" aria-label={t('less')} disabled={!canPrepare || budget - step < RERUN_MIN_DAILY}
              onClick={() => setBudget(b => Math.max(RERUN_MIN_DAILY, Math.round((b - step) * 100) / 100))}><Minus size={20} /></ActionIcon>
            <NumberInput id="rerun-budget" aria-label={t('budget')} value={budget} hideControls min={RERUN_MIN_DAILY} max={data.maxDaily} decimalScale={2}
              prefix={symbol.length === 1 ? symbol : undefined} suffix={symbol.length === 1 ? undefined : ` ${symbol}`} thousandSeparator="," inputMode="decimal"
              disabled={!canPrepare} onChange={value => setBudget(typeof value === 'number' ? value : Number.NaN)} classNames={{ input: styles.budgetInput }} />
            <ActionIcon size={48} variant="default" aria-label={t('more')} disabled={!canPrepare || budget + step > data.maxDaily}
              onClick={() => setBudget(b => Math.min(data.maxDaily, Math.round(((Number.isFinite(b) ? b : 0) + step) * 100) / 100))}><Plus size={20} /></ActionIcon>
          </div>
        </div>

        <div className={styles.field}>
          <span className={styles.label} id="rerun-days">{t('days')}</span>
          <SegmentedControl aria-labelledby="rerun-days" fullWidth disabled={!canPrepare}
            value={customDays ? OTHER : String(days)}
            data={[...RERUN_DAY_CHOICES.map(n => ({ value: String(n), label: t('dayChoice', { count: n }) })), { value: OTHER, label: t('other') }]}
            onChange={value => {
              if (value === OTHER) { setCustomDays(true); return; }
              setCustomDays(false); setDays(Number(value));
            }} />
          {customDays && (
            <NumberInput label={t('customDays')} value={days} min={RERUN_MIN_DAYS} max={RERUN_MAX_DAYS} allowDecimal={false} disabled={!canPrepare}
              onChange={value => setDays(typeof value === 'number' ? value : Number.NaN)} className={styles.customDays} />
          )}
        </div>

        {problem
          ? <p className={styles.problem} role="alert"><TriangleAlert size={18} aria-hidden="true" />{problem}</p>
          : <p className={styles.dates}><CalendarDays size={18} aria-hidden="true" />
              {plan.startDay === plan.lastDay ? t('runsOne', { start: day(plan.startDay) }) : t('runs', { start: day(plan.startDay), end: day(plan.lastDay) })}
            </p>}

        {!blocked || plan.problem === 'over-limit' ? (
          <div className={styles.plan}>
            <p className={styles.total}>{t('total', { total: money(plan.total) })}</p>
            <p className={styles.totalDetail}>{t('totalDetail', { budget: money(budget), days })}</p>
            <h3 className={styles.planHeading}>{t('estimateTitle')}</h3>
            {plan.forecast ? (
              <>
                <ProjectionChart low={plan.forecast.low} high={plan.forecast.high} days={days}
                  dayLabel={d => tSuggestion('day', { day: d })} rangeLabel={`${count(plan.forecast.low)}–${count(plan.forecast.high)}`}
                  ariaLabel={tSuggestion('forecastAria', { low: plan.forecast.low, high: plan.forecast.high, days })} />
                <p className={styles.estimate}>
                  <strong>{tSuggestion('estimate', { low: count(plan.forecast.low), high: count(plan.forecast.high) })}</strong>{' '}
                  {tSuggestion('estimateBasis', { costLow: money(plan.forecast.costLow, true), costHigh: money(plan.forecast.costHigh, true), weeks: plan.forecast.weeks })}
                </p>
              </>
            ) : <p className={styles.estimate}>{tSuggestion('noForecast')}</p>}
            {plan.bigJump && <p className={styles.note}>{t('bigJump')}</p>}
          </div>
        ) : null}

        {plan.overLimit && plan.limit !== null && (
          <div className={styles.limit} role="alert">
            <p>{t('overLimit', { total: money(plan.total), limit: money(Math.floor(plan.limit)) })}</p>
            <Link href="/settings#workspace" className={styles.limitLink}>{t('openSettings')}</Link>
          </div>
        )}

        {!canPrepare && <Alert color="gray" variant="light">{t('readOnly')}</Alert>}
        {error && <Alert color="red" variant="light" role="alert">{error}</Alert>}

        <div className={styles.actions}>
          <Button size="md" onClick={canPrepare && !blocked ? prepare : undefined} loading={pending} disabled={!canPrepare || blocked}>{t('prepare')}</Button>
          <Button size="md" variant="default" component={Link}
            href={`/campaigns/quick?days=${validQuickDays(days)}${Number.isFinite(budget) && budget >= RERUN_MIN_DAILY ? `&budget=${budget}` : ''}`}>
            {tSuggestion('newAd')}
          </Button>
        </div>
        <p className={styles.reassure}><Eye size={16} aria-hidden="true" />{tSuggestion('review')}</p>
      </section>
    </>
  );
}

/** Quick ad accepts 1–90 whole days in its link; fall back to the usual run length otherwise. */
function validQuickDays(days: number) {
  return Number.isInteger(days) && days >= RERUN_MIN_DAYS && days <= RERUN_MAX_DAYS ? days : USUAL_DAYS;
}
