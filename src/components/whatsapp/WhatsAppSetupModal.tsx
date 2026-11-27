'use client';

import { useCallback, useEffect, useState } from 'react';
import { Alert, Anchor, Badge, Button, Group, Loader, Modal, Paper, Radio, Stack, Text, TextInput } from '@mantine/core';
import { useTranslations } from 'next-intl';
import type { ApiResponse } from '@/lib/shared/types/api';
import {
  defaultWhatsAppChoice, formatWhatsAppNumber, normalizeWhatsAppNumber, sameWhatsAppNumber, savedNumberMismatch,
  type WhatsAppCandidate, type WhatsAppSetupData,
} from '@/lib/shared/whatsapp/setup';
import ConnectWhatsApp from './ConnectWhatsApp';
import classes from './WhatsAppSetup.module.css';

export async function fetchWhatsAppSetup(): Promise<WhatsAppSetupData> {
  const response = await fetch('/api/integrations/meta/whatsapp', { cache: 'no-store' });
  const body = (await response.json().catch(() => null)) as ApiResponse<WhatsAppSetupData> | null;
  if (!response.ok || !body?.success) throw new Error('WhatsApp setup unavailable');
  return body.data;
}

type Props = {
  opened: boolean;
  /** During first connection there is nothing to close back to, so the choices are the only exits. */
  firstRun?: boolean;
  initialData?: WhatsAppSetupData | null;
  /** `savedNumber` is the number on file when the screen closes. */
  onDone: (savedNumber: string | null) => void;
};

/**
 * Find the number the ads use, pick it (or enter one), then optionally turn on lead tracking.
 * A number that is found or selected is not a number whose chats are recorded.
 */
export default function WhatsAppSetupModal({ opened, firstRun = false, initialData = null, onDone }: Props) {
  const t = useTranslations('whatsappSetup');
  const [data, setData] = useState<WhatsAppSetupData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [choice, setChoice] = useState<string | null>(null);
  const [manual, setManual] = useState(false);
  const [typed, setTyped] = useState('');
  const [typedError, setTypedError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  /** Set once a number is saved here; shows the tracking step. */
  const [selected, setSelected] = useState<string | null>(null);

  const show = useCallback((next: WhatsAppSetupData) => {
    setData(next);
    setChoice(defaultWhatsAppChoice(next.saved.number, next.candidates));
    setManual(false);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      show(await fetchWhatsAppSetup());
    } catch {
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, [show]);

  useEffect(() => {
    if (!opened) return;
    setSelected(null);
    setTyped('');
    setTypedError(false);
    setSaveFailed(false);
    if (initialData) show(initialData);
    else {
      setData(null);
      void load();
    }
  }, [opened, initialData, load, show]);

  const savedNumber = selected ?? data?.saved.number ?? null;

  const save = async (number: string | null) => {
    setSaving(true);
    setSaveFailed(false);
    try {
      const response = await fetch('/api/integrations/meta/whatsapp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ number }),
      });
      if (!response.ok) throw new Error('not saved');
      if (number === null) onDone(null);
      else {
        setSelected(number);
        setData(current => current && { ...current, saved: { number, completed: true } });
      }
    } catch {
      setSaveFailed(true);
    } finally {
      setSaving(false);
    }
  };

  const found = data?.candidates ?? [];
  const entering = manual || (data !== null && found.length === 0);
  const account = data?.accountName ?? t('thisAccount');
  const mismatch = data ? savedNumberMismatch(data.saved.number, found) : false;

  const submit = () => {
    if (!entering) {
      if (choice) void save(choice);
      return;
    }
    const number = normalizeWhatsAppNumber(typed);
    setTypedError(!number);
    if (number) void save(number);
  };

  const details = (candidate: WhatsAppCandidate) => (
    <Stack gap={2}>
      <Group gap="xs">
        <span className={classes.number}>{formatWhatsAppNumber(candidate.number)}</span>
        {sameWhatsAppNumber(candidate.number, data?.saved.number) && <Badge variant="light" color="gray">{t('savedBadge')}</Badge>}
      </Group>
      {candidate.adSets > 0 && <Text size="xs" c="dimmed">{t('usedBy', { count: candidate.adSets, active: candidate.activeAdSets })}</Text>}
      {candidate.inPortfolio && <Text size="xs" c="dimmed">{t('inPortfolio')}</Text>}
      {candidate.name && <Text size="xs" c="dimmed">{t('portfolioName', { name: candidate.name })}</Text>}
    </Stack>
  );

  const numberStep = data && (
    <Stack gap="md">
      <Text size="sm" c="dimmed">{t('lead')}</Text>
      {mismatch && data.saved.number && (
        <Alert color="yellow" variant="light">{t('mismatch', { number: formatWhatsAppNumber(data.saved.number) })}</Alert>
      )}
      {data.adsCheck === 'saved' && <Text size="xs" c="dimmed">{t('fromSaved')}</Text>}

      {found.length === 0 && (
        <Stack gap="xs">
          <Text size="sm" fw={700}>
            {data.adsCheck === 'unavailable' ? t('unavailableTitle') : t('noneTitle', { account })}
          </Text>
          <Text size="sm" c="dimmed">{data.adsCheck === 'unavailable' ? t('unavailableBody') : t('noneBody')}</Text>
          {data.adsCheck !== 'unavailable' && (
            <ol className={classes.steps}><li>{t('stepApp')}</li><li>{t('stepPage')}</li><li>{t('stepEnter')}</li></ol>
          )}
          <Button variant="default" onClick={() => void load()} loading={loading}>{t('checkAgain')}</Button>
        </Stack>
      )}

      {found.length > 0 && !manual && (
        <Radio.Group
          value={choice ?? ''}
          onChange={setChoice}
          label={found.length === 1 ? t('foundOne', { account }) : t('foundMany', { account })}
        >
          <div className={classes.choices}>
            {found.map(candidate => (
              <Radio.Card key={candidate.number} value={candidate.number} className={classes.choice}>
                <Group gap="sm" wrap="nowrap" align="flex-start">
                  <Radio.Indicator mt={3} />
                  {details(candidate)}
                </Group>
              </Radio.Card>
            ))}
          </div>
        </Radio.Group>
      )}

      {entering && (
        <Stack gap={6}>
          <TextInput
            label={t('numberLabel')}
            placeholder="+1 813 555 1234"
            inputMode="tel"
            value={typed}
            onChange={event => { setTyped(event.currentTarget.value); setTypedError(false); }}
            error={typedError ? t('invalidNumber') : undefined}
            disabled={saving}
          />
          {data.pagePhone && (
            <Text size="xs" c="dimmed">
              <Anchor component="button" type="button" size="xs" onClick={() => { setTyped(data.pagePhone ?? ''); setTypedError(false); }}>
                {t('usePagePhone', { number: formatWhatsAppNumber(data.pagePhone) })}
              </Anchor>
              {'. '}{t('pagePhoneNote')}
            </Text>
          )}
        </Stack>
      )}

      {found.length > 0 && (
        <Anchor component="button" type="button" size="sm" ta="left" onClick={() => setManual(value => !value)}>
          {manual ? t('backToFound') : t('enterOther')}
        </Anchor>
      )}

      {saveFailed && <Alert color="red" variant="light" role="alert">{t('saveFailed')}</Alert>}

      <Stack gap="xs">
        <Button fullWidth onClick={submit} loading={saving} disabled={entering ? !typed.trim() : !choice}>{t('use')}</Button>
        {data.saved.number ? (
          <>
            <Button fullWidth variant="default" onClick={() => onDone(data.saved.number)} disabled={saving}>{t('keepSaved')}</Button>
            <Button fullWidth variant="subtle" color="gray" onClick={() => void save(null)} disabled={saving}>{t('remove')}</Button>
          </>
        ) : (
          // Skipping the first time is recorded so setup doesn't ask again; later it just closes.
          <Button variant="subtle" color="gray" disabled={saving}
            onClick={() => (firstRun || !data.saved.completed ? void save(null) : onDone(null))}>
            {t('skip')}
          </Button>
        )}
      </Stack>
    </Stack>
  );

  const tracking = data?.tracking;
  const selectedCandidate = found.find(candidate => sameWhatsAppNumber(candidate.number, selected));
  const trackedNumber = tracking?.status === 'on' ? normalizeWhatsAppNumber(tracking.phone) : null;

  const trackingStep = selected && tracking && (
    <Stack gap="md">
      <Paper withBorder radius="md" p="sm">
        <Stack gap="xs">
          <Group justify="space-between" gap="xs">
            <Text size="sm">{t('selected')}</Text>
            <Text size="sm" fw={800}>{formatWhatsAppNumber(selected)}</Text>
          </Group>
          <Group justify="space-between" gap="xs">
            <Text size="sm">{t('tracking')}</Text>
            <Badge color={tracking.status === 'on' ? 'green' : 'gray'} variant="light">
              {tracking.status !== 'on' ? t('trackingOff')
                : trackedNumber ? t('trackingOn', { number: formatWhatsAppNumber(trackedNumber) }) : t('trackingOnUnknown')}
            </Badge>
          </Group>
        </Stack>
      </Paper>

      {trackedNumber && trackedNumber !== selected && <Alert color="yellow" variant="light">{t('trackingOther')}</Alert>}
      {tracking.status === 'unavailable' && <Text size="sm" c="dimmed">{t('trackingUnavailable')}</Text>}
      {tracking.status === 'view_only' && <Text size="sm" c="dimmed">{t('trackingViewOnly')}</Text>}
      {tracking.status === 'available' && (selectedCandidate?.onPhoneApp === false ? (
        <Text size="sm" c="dimmed">{t('trackingNotApp')}</Text>
      ) : (
        <>
          <Text size="sm" fw={700}>{t('trackingOffer')}</Text>
          <Text size="sm" c="dimmed">{t('trackingApproval')}</Text>
          <ConnectWhatsApp appId={tracking.appId} configId={tracking.configId} onConnected={() => void fetchWhatsAppSetup()
            .then(next => setData(next)).catch(() => {})} />
        </>
      ))}

      <Button fullWidth variant={tracking.status === 'available' ? 'default' : 'filled'} onClick={() => onDone(savedNumber)}>
        {t('done')}
      </Button>
    </Stack>
  );

  return (
    <Modal
      opened={opened}
      onClose={() => onDone(savedNumber)}
      title={t('title')}
      centered
      withCloseButton={!firstRun}
      closeOnClickOutside={false}
      closeOnEscape={!firstRun}
      closeButtonProps={{ 'aria-label': t('close') }}
    >
      {trackingStep || numberStep || (
        <Stack gap="md" align="center" py="md">
          {loadFailed ? (
            <>
              <Text size="sm">{t('loadFailed')}</Text>
              <Button onClick={() => void load()}>{t('retry')}</Button>
              <Button variant="subtle" color="gray" onClick={() => onDone(null)}>{t('skip')}</Button>
            </>
          ) : (
            <>
              <Loader size="sm" />
              <Text size="sm" c="dimmed" role="status">{t('checking')}</Text>
            </>
          )}
        </Stack>
      )}
    </Modal>
  );
}
