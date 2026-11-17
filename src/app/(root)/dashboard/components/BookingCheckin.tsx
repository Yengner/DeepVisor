'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, NumberInput } from '@mantine/core';
import type { CheckinView } from '@/lib/server/bookings/checkins';
import { RESULT_LABELS } from '@/lib/shared/performance/resultChannel';
import { saveBookingCheckinAction } from '../checkinActions';
import classes from './BookingCheckin.module.css';

const range = (start: string, end: string) => {
  const f = (d: string) => new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`));
  return `${f(start)}–${f(end)}`;
};

/**
 * Weekly "how many became appointments?" check-in plus the owner-reported summary.
 * Renders nothing when there is nothing to ask or report.
 */
export default function BookingCheckin({ view, currency, canAnswer }: { view: CheckinView; currency: string | null; canAnswer: boolean }) {
  const router = useRouter();
  const [count, setCount] = useState<number | string>('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const { ask, summary } = view;
  const showAsk = ask !== null && canAnswer;
  if (!showAsk && !summary.weeksAnswered) return null;

  const save = (bookings: number | null) => start(async () => {
    setError(null);
    const result = await saveBookingCheckinAction(ask!.weekStart, bookings);
    if (!result.success) { setError(result.error?.userMessage ?? 'Please try again.'); return; }
    router.refresh();
  });
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const value = Number(count);
    if (count === '' || !Number.isInteger(value) || value < 0) return setError('Enter a whole number, like 0 or 5.');
    save(value);
  };
  const what = ask ? RESULT_LABELS[ask.result.kind].metric.toLowerCase().replace('whatsapp', 'WhatsApp') : '';
  const money = (v: number) => (currency ? new Intl.NumberFormat('en', { style: 'currency', currency }).format(v) : null);

  return (
    <section className={classes.card} aria-labelledby="booking-checkin">
      {showAsk ? (
        <form onSubmit={submit} className={classes.ask}>
          <h2 id="booking-checkin">Last week ({range(ask.weekStart, ask.weekEnd)})</h2>
          <p>
            {ask.results !== null ? <>Your ads started <strong>{ask.results}</strong> {what}.</> : <>Your ads ran.</>} About how many became appointments?
          </p>
          <div className={classes.row}>
            <NumberInput aria-label="Appointments from last week's ads" placeholder="e.g. 5" min={0} max={10000} allowDecimal={false} allowNegative={false}
              value={count} onChange={setCount} disabled={pending} className={classes.input} inputMode="numeric" />
            <Button type="submit" loading={pending}>Save</Button>
            <Button variant="subtle" color="gray" onClick={() => save(null)} disabled={pending}>Not sure</Button>
          </div>
          {error && <Alert color="red" variant="light" role="alert">{error}</Alert>}
        </form>
      ) : <h2 id="booking-checkin">Appointments from ads</h2>}
      {summary.weeksAnswered > 0 && (
        <p className={classes.summary}>
          You reported <strong>{summary.bookings}</strong> appointment{summary.bookings === 1 ? '' : 's'} in {summary.weeksAnswered} of the last {summary.weeksWithSpend} weeks with ads
          {summary.costPerBooking !== null && money(summary.costPerBooking) ? <> · about <strong>{money(summary.costPerBooking)}</strong> per appointment</> : null}.
        </p>
      )}
    </section>
  );
}
