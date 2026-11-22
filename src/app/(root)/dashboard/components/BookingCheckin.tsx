'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { CheckinView } from '@/lib/server/bookings/checkins';
import CheckinAsk from '@/components/bookings/CheckinAsk';
import classes from './BookingCheckin.module.css';

/**
 * The weekly "how many became appointments?" question. The Insights popup asks first; this card
 * stays as the fallback until the week is answered or skipped, and renders nothing when there is
 * nothing to ask. What was already reported is not repeated here: it sits in the Results help.
 */
export default function BookingCheckin({ view, canAnswer }: { view: CheckinView; canAnswer: boolean }) {
  const router = useRouter();
  // Answered in the popup: re-read so the card does not ask the same week again.
  useEffect(() => {
    const refresh = () => router.refresh();
    window.addEventListener('deepvisor:checkin-saved', refresh);
    return () => window.removeEventListener('deepvisor:checkin-saved', refresh);
  }, [router]);
  const { ask } = view;
  if (ask === null || !canAnswer) return null;

  return (
    <section className={classes.card} aria-labelledby="booking-checkin">
      <CheckinAsk ask={ask} headingId="booking-checkin" onSaved={() => router.refresh()} />
    </section>
  );
}
