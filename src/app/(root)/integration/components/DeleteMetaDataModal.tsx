'use client';
import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Alert, Button, Group, List, Modal, Stack, Text, TextInput } from '@mantine/core';
import { deleteMetaDataAction } from '@/lib/server/actions/privacy/metaData';

/**
 * "Delete Meta data" confirmation: lists what is deleted and kept, requires typing DELETE, then
 * shows the confirmation code. Closing after success reloads so every page reflects the deletion.
 */
export default function DeleteMetaDataModal({ integrationId, opened, onClose }: { integrationId: string | null; opened: boolean; onClose: () => void }) {
  const t = useTranslations('metaDeletion');
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const close = () => {
    if (pending) return;
    if (code) { window.location.reload(); return; }
    setTyped(''); setError(null); onClose();
  };
  const remove = () => start(async () => {
    setError(null);
    const result = await deleteMetaDataAction(integrationId, typed);
    if (!result.success) { setError(result.error?.userMessage ?? t('error.failed')); return; }
    if (result.data) setCode(result.data.code);
  });

  return (
    <Modal opened={opened} onClose={close} title={t('title')} centered closeOnClickOutside={!pending} closeOnEscape={!pending} withCloseButton={!pending}>
      {code ? (
        <Stack gap="sm">
          <Text size="sm" role="status">{t('done')}</Text>
          <Text size="sm">{t('codeLabel')} <strong style={{ fontFamily: 'ui-monospace, monospace', letterSpacing: '0.08em' }}>{code}</strong></Text>
          <Text size="sm" c="dimmed">{t.rich('codeHelp', { link: chunks => <Link href={`/data-deletion?code=${code}`}>{chunks}</Link> })}</Text>
          <Group justify="flex-end"><Button onClick={close}>{t('close')}</Button></Group>
        </Stack>
      ) : (
        <Stack gap="sm">
          <Text size="sm">{t('intro')}</Text>
          <List size="sm" spacing={4}>
            <List.Item>{t('deletes1')}</List.Item>
            <List.Item>{t('deletes2')}</List.Item>
            <List.Item>{t('deletes3')}</List.Item>
          </List>
          <Text size="sm" c="dimmed">{t('keeps')}</Text>
          <TextInput label={t('typeDelete')} value={typed} onChange={event => setTyped(event.currentTarget.value)} autoComplete="off" disabled={pending} data-autofocus />
          {error && <Alert color="red" variant="light" role="alert">{error}</Alert>}
          <Group justify="flex-end">
            <Button variant="default" onClick={close} disabled={pending}>{t('cancel')}</Button>
            <Button color="red" onClick={remove} loading={pending} disabled={typed !== 'DELETE' || !integrationId}>{t('confirm')}</Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}
