'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Group, Paper, Stack, Text } from '@mantine/core';
import { useTranslations } from 'next-intl';
import { formatWhatsAppNumber } from '@/lib/shared/whatsapp/setup';
import WhatsAppSetupModal from './WhatsAppSetupModal';

/** Saved state only; Meta is checked when the setup screen is opened. */
export default function WhatsAppCard({ number, trackingOn }: { number: string | null; trackingOn: boolean }) {
  const t = useTranslations('whatsappSetup');
  const router = useRouter();
  const [opened, setOpened] = useState(false);

  return (
    <Paper withBorder radius="lg" p="md">
      <Group justify="space-between" gap="sm">
        <Stack gap={2} flex="1 1 280px">
          <Text component="h2" fw={800} size="sm">{t('card.title')}</Text>
          <Text size="sm">{number ? t('card.number', { number: formatWhatsAppNumber(number) }) : t('card.noNumber')}</Text>
          <Text size="sm" c="dimmed">{t('card.tracking', { status: trackingOn ? t('trackingOnUnknown') : t('trackingOff') })}</Text>
          {!trackingOn && <Text size="sm" c="dimmed">{t('card.offHelp')}</Text>}
        </Stack>
        <Button variant={number ? 'default' : 'filled'} onClick={() => setOpened(true)}>
          {number ? t('card.change') : t('card.setUp')}
        </Button>
      </Group>
      <WhatsAppSetupModal opened={opened} onDone={() => { setOpened(false); router.refresh(); }} />
    </Paper>
  );
}
