'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Alert, Button, FileInput, NumberInput, Textarea } from '@mantine/core';
import { IconPhoto } from '@tabler/icons-react';
import type { QuickAdSummary } from '@/lib/server/quickAd/service';
import classes from './QuickAd.module.css';

const ACCEPT = 'image/jpeg,image/png,image/webp,video/mp4,video/webm';
const MAX_BYTES = 4 * 1024 * 1024;
const SERVER_ERRORS = ['NO_SOURCE', 'MISSING_FACTS', 'DAILY_LIMIT', 'INVALID_INPUT', 'UNAVAILABLE'] as const;
type ServerError = (typeof SERVER_ERRORS)[number];
const isServerError = (code: unknown): code is ServerError => SERVER_ERRORS.includes(code as ServerError);

export default function QuickAdForm({ accountId, summary }: { accountId: string; summary: QuickAdSummary }) {
  const t = useTranslations('quickAd');
  const tAll = useTranslations();
  const locale = useLocale();
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
  const money = (amount: number, currency: string) =>
    new Intl.NumberFormat(locale === 'es' ? 'es-US' : 'en-US', { style: 'currency', currency }).format(amount);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!file) return setError(t('error.chooseFile'));
    if (file.size > MAX_BYTES) return setError(t('error.tooLarge'));
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
        const code: unknown = result?.code;
        setError(isServerError(code) ? t(`error.${code}`) : result?.error ?? t('error.UNAVAILABLE'));
        setPending(false);
        return;
      }
      router.push(result.data.href);
    } catch {
      setError(t('error.UNAVAILABLE'));
      setPending(false);
    }
  }

  const languages = summary.languages?.map(l => tAll(`languages.${l}`));
  return (
    <form className={classes.card} onSubmit={submit} aria-labelledby="quick-form">
      <h2 id="quick-form">{t('formTitle')}</h2>
      <dl className={classes.plan}>
        <div><dt>{t('startsFrom')}</dt><dd>{summary.source?.name}{summary.source && <span>{t(`reason.${summary.source.reason}`)}</span>}</dd></div>
        <div><dt>{t('budget')}</dt><dd>{summary.dailyBudget ? t('perDay', { amount: money(summary.dailyBudget.amount, summary.dailyBudget.currency) }) : '—'}</dd></div>
        <div><dt>{t('runs')}</dt><dd>{summary.days ? t('runsValue', { days: summary.days.value }) : '—'}</dd></div>
        <div><dt>{t('adText')}</dt><dd>{languages ? (languages.length === 2 ? tAll('languages.list', { first: languages[0], second: languages[1] }) : languages.join(', ')) : '—'}</dd></div>
        {summary.welcome && (
          <div><dt>{summary.welcome.kind === 'ice_breakers' ? t('clientsTap') : t('clientsSend')}</dt>
            <dd>“{summary.welcome.clientMessage}”<span>{summary.welcome.fromAd ? t('sameWelcome') : t('savedGreeting')}</span></dd></div>
        )}
      </dl>
      {summary.overMonthlyLimit && <Alert color="yellow" variant="light">{t('overLimit')}</Alert>}

      <FileInput label={t('file')} description={t('fileHelp')} accept={ACCEPT} leftSection={<IconPhoto size={16} />}
        value={file} onChange={setFile} clearable required disabled={blocked || pending} />
      <Textarea label={t('note')} placeholder={t('notePlaceholder')} maxLength={300} autosize minRows={2}
        value={note} onChange={e => setNote(e.currentTarget.value)} disabled={blocked || pending} />
      <div className={classes.overrides}>
        <NumberInput label={t('dailyBudget')} min={1} decimalScale={2} value={budget} onChange={setBudget} disabled={blocked || pending}
          prefix={summary.dailyBudget?.currency === 'USD' ? '$' : undefined} />
        <NumberInput label={t('days')} min={1} max={90} allowDecimal={false} value={days} onChange={setDays} disabled={blocked || pending} />
      </div>
      {error && <Alert color="red" variant="light" role="alert">{error}</Alert>}
      <div className={classes.actions}>
        <Button type="submit" loading={pending} disabled={blocked || !file}>{t('create')}</Button>
        <span>{summary.remainingToday > 0 ? t('remaining', { remaining: summary.remainingToday, limit: summary.limit }) : t('limitReached')}</span>
      </div>
    </form>
  );
}
