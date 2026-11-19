'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { WeekTotals } from '@/lib/shared/bookings/checkin';
import { pendingCheckinAction } from '@/app/(root)/dashboard/checkinActions';
import CheckinAsk from './CheckinAsk';
import classes from './PopupCheckin.module.css';

/**
 * The weekly appointments question inside the Insights popup, while a week with ad spend is
 * unanswered (owners/admins only). Read live, not saved in the popup's history, so once it is
 * answered here or on Overview it is never asked again. Renders nothing otherwise.
 */
export default function PopupCheckin() {
  const t = useTranslations('checkin');
  const [ask, setAsk] = useState<WeekTotals | null>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    let live = true;
    void pendingCheckinAction().then(result => { if (live) setAsk(result?.ask ?? null); });
    return () => { live = false; };
  }, []);
  if (saved) return <section className={classes.card} role="status"><p>{t('thanks')}</p></section>;
  if (!ask) return null;
  return (
    <section className={classes.card} aria-labelledby="popup-checkin">
      <CheckinAsk ask={ask} headingId="popup-checkin" onSaved={() => { setSaved(true); window.dispatchEvent(new Event('deepvisor:checkin-saved')); }} />
    </section>
  );
}
