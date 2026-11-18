'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Alert, Button, Select } from '@mantine/core';
import { addCallLeadAction } from './actions';
import classes from './Leads.module.css';

/** Calls don't reach the WhatsApp feed, so the owner logs them here. */
export default function CallLeadForm({ ads }: { ads: Array<{ value: string; label: string }> }) {
  const t = useTranslations('leads');
  const router = useRouter();
  const [ad, setAd] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const add = (booked: boolean) => start(async () => {
    setError(null);
    const result = await addCallLeadAction(ad, booked ? 'booked' : null);
    if (!result.success) { setError(result.error?.userMessage ?? t('error.failed')); return; }
    setAd(null);
    router.refresh();
  });

  return (
    <section className={classes.card} aria-labelledby="leads-call">
      <h2 id="leads-call">{t('callTitle')}</h2>
      <div className={classes.callRow}>
        <Select label={t('callAd')} placeholder={t('callAdNone')} data={ads} value={ad} onChange={setAd} clearable searchable
          disabled={pending} className={classes.callSelect} comboboxProps={{ withinPortal: true }} />
        <Button variant="default" onClick={() => add(false)} loading={pending}>{t('addCall')}</Button>
        <Button onClick={() => add(true)} disabled={pending}>{t('addBookedCall')}</Button>
      </div>
      {error && <Alert color="red" variant="light" role="alert">{error}</Alert>}
    </section>
  );
}
