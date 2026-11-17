'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, FileInput, NumberInput, Textarea } from '@mantine/core';
import { IconPhoto } from '@tabler/icons-react';
import type { QuickAdSummary } from '@/lib/server/quickAd/service';
import { LANGUAGE_LABELS } from '@/lib/shared/agent/factCopy';
import classes from './QuickAd.module.css';

const ACCEPT = 'image/jpeg,image/png,image/webp,video/mp4,video/webm';
const MAX_BYTES = 4 * 1024 * 1024;

function money(amount: number, currency: string) {
  return new Intl.NumberFormat('en', { style: 'currency', currency }).format(amount);
}

export default function QuickAdForm({ accountId, summary }: { accountId: string; summary: QuickAdSummary }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState('');
  const [budget, setBudget] = useState<number | string>('');
  const [days, setDays] = useState<number | string>('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // One key per form session: a double submit returns the same draft.
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const blocked = summary.missing.length > 0 || summary.remainingToday <= 0;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!file) return setError('Choose a photo or video first.');
    if (file.size > MAX_BYTES) return setError('Choose a file up to 4 MB.');
    setPending(true);
    setError(null);
    const body = new FormData();
    body.set('adAccountId', accountId);
    body.set('file', file);
    body.set('note', note);
    body.set('dailyBudget', String(budget));
    body.set('days', String(days));
    body.set('idempotencyKey', idempotencyKey);
    try {
      const response = await fetch('/api/campaigns/quick-ad', { method: 'POST', body });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) {
        if (result?.code === 'MISSING_FACTS') router.refresh();
        setError(result?.error ?? 'Quick ad is unavailable right now.');
        setPending(false);
        return;
      }
      router.push(result.data.href);
    } catch {
      setError('Quick ad is unavailable right now.');
      setPending(false);
    }
  }

  const plan = summary;
  return (
    <form className={classes.card} onSubmit={submit} aria-labelledby="quick-form">
      <h2 id="quick-form">Your ad</h2>
      <dl className={classes.plan}>
        <div><dt>Starts from</dt><dd>{plan.source?.name}<span>{plan.source?.reason}</span></dd></div>
        <div><dt>Budget</dt><dd>{plan.dailyBudget ? `${money(plan.dailyBudget.amount, plan.dailyBudget.currency)} a day` : '—'}</dd></div>
        <div><dt>Runs</dt><dd>{plan.days ? `${plan.days.value} days, starting tomorrow` : '—'}</dd></div>
        <div><dt>Ad text</dt><dd>{plan.languages ? plan.languages.map(l => LANGUAGE_LABELS[l]).join(' and ') : '—'}</dd></div>
        {plan.welcome && (
          <div><dt>{plan.welcome.kind === 'ice_breakers' ? 'Clients tap' : 'Clients send'}</dt>
            <dd>“{plan.welcome.clientMessage}”<span>{plan.welcome.fromAd ? 'Same WhatsApp welcome as your current ad' : 'Your saved greeting'}</span></dd></div>
        )}
      </dl>
      {plan.overMonthlyLimit && <Alert color="yellow" variant="light">This plan is above your monthly limit. You can lower the budget below.</Alert>}

      <FileInput label="Photo or video" description="JPEG, PNG, WebP, MP4 or WebM, up to 4 MB" accept={ACCEPT} leftSection={<IconPhoto size={16} />}
        value={file} onChange={setFile} clearable required disabled={blocked || pending} />
      <Textarea label="Anything to mention? (optional)" placeholder="e.g. Fall color special, Saturday openings" maxLength={300} autosize minRows={2}
        value={note} onChange={e => setNote(e.currentTarget.value)} disabled={blocked || pending} />
      <div className={classes.overrides}>
        <NumberInput label="Daily budget for this ad (optional)" min={1} decimalScale={2} value={budget} onChange={setBudget} disabled={blocked || pending}
          prefix={plan.dailyBudget?.currency === 'USD' ? '$' : undefined} />
        <NumberInput label="Days (optional)" min={1} max={90} allowDecimal={false} value={days} onChange={setDays} disabled={blocked || pending} />
      </div>
      {error && <Alert color="red" variant="light" role="alert">{error}</Alert>}
      <div className={classes.actions}>
        <Button type="submit" loading={pending} disabled={blocked || !file}>Create draft</Button>
        <span>{summary.remainingToday > 0 ? `${summary.remainingToday} of ${summary.limit} quick ads left today` : 'Daily limit reached. Try again tomorrow.'}</span>
      </div>
    </form>
  );
}
