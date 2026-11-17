'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Alert, Button, NumberInput } from '@mantine/core';
import type { CheckinView } from '@/lib/server/bookings/checkins';
import { saveBookingCheckinAction } from '../checkinActions';
import classes from './BookingCheckin.module.css';

/**
 * Weekly "how many became appointments?" check-in plus the owner-reported summary.
 * Renders nothing when there is nothing to ask or report.
 */
export default function BookingCheckin({ view, currency, canAnswer }: { view: CheckinView; currency: string | null; canAnswer: boolean }) {
  const t = useTranslations('checkin');
  const tAll = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [count, setCount] = useState<number | string>('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const { ask, summary } = view;
  const showAsk = ask !== null && canAnswer;
  if (!showAsk && !summary.weeksAnswered) return null;

  const intlLocale = locale === 'es' ? 'es-US' : 'en-US';
  const day = (d: string) => new Intl.DateTimeFormat(intlLocale, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`));
  const money = (v: number) => (currency ? new Intl.NumberFormat(intlLocale, { style: 'currency', currency }).format(v) : null);
  const save = (bookings: number | null) => start(async () => {
    setError(null);
    const result = await saveBookingCheckinAction(ask!.weekStart, bookings);
    if (!result.success) { setError(result.error?.userMessage ?? t('error.retry')); return; }
    router.refresh();
  });
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const value = Number(count);
    if (count === '' || !Number.isInteger(value) || value < 0) return setError(t('error.wholeNumber'));
    save(value);
  };
  const cost = summary.costPerBooking !== null ? money(summary.costPerBooking) : null;

  return (
    <section className={classes.card} aria-labelledby="booking-checkin">
      {showAsk ? (
        <form onSubmit={submit} className={classes.ask}>
          <h2 id="booking-checkin">{t('lastWeek', { range: `${day(ask.weekStart)}–${day(ask.weekEnd)}` })}</h2>
          <p>
            {ask.results !== null ? t('started', { count: tAll(`results.${ask.result.kind}.count`, { count: ask.results }) }) : t('ran')} {t('question')}
          </p>
          <div className={classes.row}>
            <NumberInput aria-label={t('inputLabel')} placeholder={t('placeholder')} min={0} max={10000} allowDecimal={false} allowNegative={false}
              value={count} onChange={setCount} disabled={pending} className={classes.input} inputMode="numeric" />
            <Button type="submit" loading={pending}>{t('save')}</Button>
            <Button variant="subtle" color="gray" onClick={() => save(null)} disabled={pending}>{t('notSure')}</Button>
          </div>
          {error && <Alert color="red" variant="light" role="alert">{error}</Alert>}
        </form>
      ) : <h2 id="booking-checkin">{t('title')}</h2>}
      {summary.weeksAnswered > 0 && (
        <p className={classes.summary}>
          {t.rich('summary', { bookings: summary.bookings ?? 0, answered: summary.weeksAnswered, weeks: summary.weeksWithSpend, b: chunks => <strong>{chunks}</strong> })}
          {cost ? t.rich('cost', { cost, b: chunks => <strong>{chunks}</strong> }) : null}.
        </p>
      )}
    </section>
  );
}
