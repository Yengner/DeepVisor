'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Alert, Button, Checkbox, Group, Select, Stack, Text, TextInput, Textarea } from '@mantine/core';
import { createClientBusiness, linkClientAccount, saveEngagement, syncClientAccount, unlinkClientAccount, type ClientActionResult } from '@/lib/server/clients/actions';
import { BUSINESS_CATEGORY_OPTIONS } from '@/lib/shared/onboarding/businessProfileOptions';
import { SERVICE_LEVELS } from '@/lib/shared/clients/model';
import type { Engagement, LinkedAccount } from '@/lib/server/clients/load';

/** Runs an action and keeps its error beside the form it came from. */
function useClientAction() {
  const t = useTranslations('clients');
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (action: () => Promise<ClientActionResult>, done: (result: Extract<ClientActionResult, { ok: true }>) => void) => start(async () => {
    setError(null);
    const result = await action().catch((): ClientActionResult => ({ ok: false, error: 'failed' }));
    if (result.ok) done(result);
    else setError(t(`error.${result.error}`));
  });
  return { pending, error, run };
}

const FormError = ({ message }: { message: string | null }) => (message ? <Alert color="red" role="alert">{message}</Alert> : null);

export function NewBusinessForm() {
  const t = useTranslations('clients');
  const router = useRouter();
  const { pending, error, run } = useClientAction();
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [industry, setIndustry] = useState<string | null>(null);
  return (
    <form onSubmit={(event) => {
      event.preventDefault();
      run(() => createClientBusiness({ name, location, industry }), ({ businessId }) => router.push(`/clients/${businessId}`));
    }}>
      <Stack gap="md">
        <TextInput size="md" required maxLength={120} label={t('form.name')} value={name} onChange={(event) => setName(event.currentTarget.value)} />
        <TextInput size="md" maxLength={200} label={t('form.location')} placeholder="Tampa, FL" value={location} onChange={(event) => setLocation(event.currentTarget.value)} />
        <Select size="md" searchable clearable label={t('form.category')} data={BUSINESS_CATEGORY_OPTIONS.map(({ value, label }) => ({ value, label }))} value={industry} onChange={setIndustry} />
        <FormError message={error} />
        <Group><Button size="md" type="submit" loading={pending} disabled={!name.trim()}>{t('form.create')}</Button></Group>
      </Stack>
    </form>
  );
}

export function EngagementForm({ businessId, engagement }: { businessId: string; engagement: Engagement }) {
  const t = useTranslations('clients');
  const router = useRouter();
  const { pending, error, run } = useClientAction();
  const [saved, setSaved] = useState(false);
  const [serviceLevel, setServiceLevel] = useState<string>(engagement.serviceLevel);
  const [fee, setFee] = useState(engagement.monthlyFeeCents === null ? '' : String(engagement.monthlyFeeCents / 100));
  const [paidThrough, setPaidThrough] = useState(engagement.paidThrough ?? '');
  const [contentAddon, setContentAddon] = useState(engagement.contentAddon);
  const [note, setNote] = useState(engagement.note ?? '');
  return (
    <form onChange={() => setSaved(false)} onSubmit={(event) => {
      event.preventDefault();
      run(() => saveEngagement(businessId, { serviceLevel, fee, paidThrough, contentAddon, note }), () => { setSaved(true); router.refresh(); });
    }}>
      <Stack gap="md">
        <Select size="md" label={t('form.service')} allowDeselect={false} data={SERVICE_LEVELS.map((value) => ({ value, label: t(`service.${value}`) }))}
          value={serviceLevel} onChange={(value) => { setServiceLevel(value ?? 'managed'); setSaved(false); }} />
        <TextInput size="md" inputMode="decimal" label={t('form.fee', { currency: engagement.currency })} value={fee} onChange={(event) => setFee(event.currentTarget.value)} />
        <TextInput size="md" type="date" label={t('form.paidThrough')} description={t('form.paidThroughHint')} value={paidThrough} onChange={(event) => setPaidThrough(event.currentTarget.value)} />
        <Checkbox size="md" label={t('form.contentAddon')} checked={contentAddon} onChange={(event) => setContentAddon(event.currentTarget.checked)} />
        <Textarea size="md" autosize minRows={3} maxLength={2000} label={t('form.note')} value={note} onChange={(event) => setNote(event.currentTarget.value)} />
        <FormError message={error} />
        <Group gap="sm">
          <Button size="md" type="submit" loading={pending}>{t('form.save')}</Button>
          <Text size="sm" role="status">{saved ? t('form.saved') : ''}</Text>
        </Group>
      </Stack>
    </form>
  );
}

export type SyncState = { accountNumber: string; lastSynced: string | null; needsReconnect: boolean };

export function LinkedAccounts({ businessId, links, available, sync }: {
  businessId: string; links: Array<LinkedAccount & { href: string }>; available: LinkedAccount[];
  /** The account this business syncs now. `lastSynced` is already formatted. */
  sync: SyncState | null;
}) {
  const t = useTranslations('clients');
  const router = useRouter();
  const { pending, error, run } = useClientAction();
  const [choice, setChoice] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const label = (account: LinkedAccount) => `${account.name ?? t('unnamedAccount')} · …${account.externalAccountId.slice(-4)}`;
  const act = (action: () => Promise<ClientActionResult>) => {
    setWarning(null);
    run(action, (result) => {
      if (result.warning) setWarning(t(`error.${result.warning}`));
      setChoice(null);
      router.refresh();
    });
  };
  return (
    <Stack gap="md">
      {links.length === 0 && <Text c="dimmed">{t('accounts.none')}</Text>}
      {links.map((account) => {
        const current = sync?.accountNumber === account.externalAccountId ? sync : null;
        return (
          <Group key={account.externalAccountId} justify="space-between" gap="sm">
            <Stack gap={2}>
              <Text fw={700}>{label(account)}</Text>
              <Text size="sm" c="dimmed">
                {!current ? t('accounts.notSyncing') : current.needsReconnect ? t('reconnect')
                  : current.lastSynced ? t('lastSynced', { when: current.lastSynced }) : t('accounts.firstSync')}
              </Text>
            </Stack>
            <Group gap="xs">
              <Button variant={current ? 'default' : 'filled'} disabled={pending} onClick={() => act(() => syncClientAccount(businessId, account.externalAccountId))}>
                {current ? t('accounts.syncNow') : t('accounts.sync')}
              </Button>
              <Button component="a" href={account.href} target="_blank" rel="noreferrer" variant="default">{t('adsManager')}</Button>
              <Button variant="subtle" color="red" disabled={pending} onClick={() => act(() => unlinkClientAccount(businessId, account.externalAccountId))}>{t('accounts.unlink')}</Button>
            </Group>
          </Group>
        );
      })}
      <Group align="flex-end" gap="sm">
        <Select size="md" style={{ flex: 1, minWidth: 220 }} searchable label={t('accounts.add')} placeholder={t('accounts.choose')}
          nothingFoundMessage={t('accounts.noneLeft')} data={available.map((account) => ({ value: account.externalAccountId, label: label(account) }))} value={choice} onChange={setChoice} />
        <Button size="md" disabled={!choice} loading={pending} onClick={() => act(() => linkClientAccount(businessId, choice))}>{t('accounts.link')}</Button>
      </Group>
      {warning && <Alert color="yellow" role="alert">{warning}</Alert>}
      <FormError message={error} />
    </Stack>
  );
}
