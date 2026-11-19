'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import type { CheckinView } from '@/lib/server/bookings/checkins';
import CheckinAsk from '@/components/bookings/CheckinAsk';
import classes from './BookingCheckin.module.css';

/**
 * Weekly "how many became appointments?" check-in plus the owner-reported summary. The Insights
 * popup asks first; this card stays as the fallback until the week is answered or skipped.
 * Renders nothing when there is nothing to ask or report.
 */
export default function BookingCheckin({ view, currency, canAnswer }: { view: CheckinView; currency: string | null; canAnswer: boolean }) {
  const t = useTranslations('checkin');
  const locale = useLocale();
  const router = useRouter();
  // Answered in the popup: re-read so the card does not ask the same week again.
  useEffect(() => {
    const refresh = () => router.refresh();
    window.addEventListener('deepvisor:checkin-saved', refresh);
    return () => window.removeEventListener('deepvisor:checkin-saved', refresh);
  }, [router]);
  const { ask, summary } = view;
  const showAsk = ask !== null && canAnswer;
  if (!showAsk && !summary.weeksAnswered) return null;

  const intlLocale = locale === 'es' ? 'es-US' : 'en-US';
  const money = (v: number) => (currency ? new Intl.NumberFormat(intlLocale, { style: 'currency', currency }).format(v) : null);
  const cost = summary.costPerBooking !== null ? money(summary.costPerBooking) : null;

  return (
    <section className={classes.card} aria-labelledby="booking-checkin">
      {showAsk ? <CheckinAsk ask={ask} headingId="booking-checkin" onSaved={() => router.refresh()} /> : <h2 id="booking-checkin">{t('title')}</h2>}
      {summary.weeksAnswered > 0 && (
        <p className={classes.summary}>
          {t.rich('summary', { bookings: summary.bookings ?? 0, answered: summary.weeksAnswered, weeks: summary.weeksWithSpend, b: chunks => <strong>{chunks}</strong> })}
          {cost ? t.rich('cost', { cost, b: chunks => <strong>{chunks}</strong> }) : null}.
        </p>
      )}
    </section>
  );
}
