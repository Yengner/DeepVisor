'use client';
import { useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Alert, Button, NumberInput } from '@mantine/core';
import type { WeekTotals } from '@/lib/shared/bookings/checkin';
import { saveBookingCheckinAction } from '@/app/(root)/dashboard/checkinActions';
import classes from './CheckinAsk.module.css';

/**
 * "Last week (Nov 10–16): your ads started 12 WhatsApp chats. About how many became
 * appointments?" Shared by the Overview card and the Insights popup so the question, limits and
 * "Not sure" behave the same. `onSaved` runs after the answer is stored.
 */
export default function CheckinAsk({ ask, onSaved, headingId }: { ask: WeekTotals; onSaved: () => void; headingId: string }) {
  const t = useTranslations('checkin');
  const tAll = useTranslations();
  const locale = useLocale();
  const [count, setCount] = useState<number | string>('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const intlLocale = locale === 'es' ? 'es-US' : 'en-US';
  const day = (d: string) => new Intl.DateTimeFormat(intlLocale, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`));
  const save = (bookings: number | null) => start(async () => {
    setError(null);
    const result = await saveBookingCheckinAction(ask.weekStart, bookings);
    if (!result.success) { setError(result.error?.userMessage ?? t('error.retry')); return; }
    onSaved();
  });
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const value = Number(count);
    if (count === '' || !Number.isInteger(value) || value < 0) return setError(t('error.wholeNumber'));
    save(value);
  };

  return (
    <form onSubmit={submit} className={classes.ask}>
      <h2 id={headingId}>{t('lastWeek', { range: `${day(ask.weekStart)}–${day(ask.weekEnd)}` })}</h2>
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
  );
}
