'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Alert, Button, FileInput, NumberInput, Textarea } from '@mantine/core';
import { IconPhoto } from '@tabler/icons-react';
import { createClient } from '@/lib/client/supabase/browser';
import { QUICK_AD_MAX_IMAGE_MB, QUICK_AD_MAX_VIDEO_MB, QUICK_AD_MEDIA_TYPES, quickAdMediaProblem } from '@/lib/shared/quickAd/media';
import type { QuickAdSummary } from '@/lib/server/quickAd/service';
import classes from './QuickAd.module.css';

const ACCEPT = QUICK_AD_MEDIA_TYPES.join(',');
const LIMITS = { image: QUICK_AD_MAX_IMAGE_MB, video: QUICK_AD_MAX_VIDEO_MB };
const SERVER_ERRORS = ['NO_SOURCE', 'MISSING_FACTS', 'DAILY_LIMIT', 'INVALID_INPUT', 'UPLOAD_MISSING', 'UNAVAILABLE'] as const;
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
  const [pending, setPending] = useState<false | 'uploading' | 'creating'>(false);
  // One key per form session: a double submit returns the same draft.
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const blocked = summary.missing.length > 0 || summary.remainingToday <= 0;
  const money = (amount: number, currency: string) =>
    new Intl.NumberFormat(locale === 'es' ? 'es-US' : 'en-US', { style: 'currency', currency }).format(amount);

  /** POST JSON; returns the data on success, or shows the matching message and returns null. */
  async function post<T>(url: string, payload: Record<string, unknown>): Promise<T | null> {
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const result = await response.json().catch(() => null);
    if (response.ok && result?.success) return result.data as T;
    if (result?.code === 'MISSING_FACTS') router.refresh();
    const code: unknown = result?.code;
    setError(code === 'TOO_LARGE' ? t('error.tooLarge', LIMITS) : isServerError(code) ? t(`error.${code}`) : result?.error ?? t('error.UNAVAILABLE'));
    return null;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!file) return setError(t('error.chooseFile'));
    const problem = quickAdMediaProblem(file.type, file.size);
    if (problem) return setError(problem === 'size' ? t('error.tooLarge', LIMITS) : t('error.wrongType'));
    setError(null);
    const plan = { adAccountId: accountId, dailyBudget: budget === '' ? null : Number(budget), days: days === '' ? null : Number(days) };
    try {
      // 1. A one-time link, then the file goes straight to private storage (a fresh upload per attempt).
      setPending('uploading');
      const upload = await post<{ bucket: string; mediaId: string; path: string; token: string }>('/api/campaigns/quick-ad/upload', { ...plan, type: file.type, size: file.size });
      if (!upload) return setPending(false);
      const { error: uploadError } = await createClient().storage.from(upload.bucket)
        .uploadToSignedUrl(upload.path, upload.token, file, { contentType: file.type });
      if (uploadError) {
        setError(t('error.uploadFailed'));
        return setPending(false);
      }
      // 2. DeepVisor checks the stored file and prepares the paused draft.
      setPending('creating');
      const draft = await post<{ href: string }>('/api/campaigns/quick-ad', {
        ...plan, mediaId: upload.mediaId, type: file.type, name: file.name, note, idempotencyKey,
      });
      if (!draft) return setPending(false);
      router.push(draft.href);
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

      <FileInput label={t('file')} description={t('fileHelp', LIMITS)} accept={ACCEPT} leftSection={<IconPhoto size={16} />}
        value={file} onChange={setFile} clearable required disabled={blocked || !!pending} />
      <Textarea label={t('note')} placeholder={t('notePlaceholder')} maxLength={300} autosize minRows={2}
        value={note} onChange={e => setNote(e.currentTarget.value)} disabled={blocked || !!pending} />
      <div className={classes.overrides}>
        <NumberInput label={t('dailyBudget')} min={1} decimalScale={2} value={budget} onChange={setBudget} disabled={blocked || !!pending}
          prefix={summary.dailyBudget?.currency === 'USD' ? '$' : undefined} />
        <NumberInput label={t('days')} min={1} max={90} allowDecimal={false} value={days} onChange={setDays} disabled={blocked || !!pending} />
      </div>
      {error && <Alert color="red" variant="light" role="alert">{error}</Alert>}
      <div className={classes.actions}>
        <Button type="submit" loading={!!pending} loaderProps={{ type: 'dots' }} disabled={blocked || !file}>{t('create')}</Button>
        {pending && <span role="status">{t(pending)}</span>}
        <span>{summary.remainingToday > 0 ? t('remaining', { remaining: summary.remainingToday, limit: summary.limit }) : t('limitReached')}</span>
      </div>
    </form>
  );
}
