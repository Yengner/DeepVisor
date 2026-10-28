'use client';

import { useState, type FormEvent } from 'react';
import { Alert, Button, Group, Modal, Stack, Text, TextInput } from '@mantine/core';
import { deleteOwnAccount } from '@/lib/server/actions/user/settingsProfile';

export default function DeleteAccount() {
  const [opened, setOpened] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent) {
    event.preventDefault(); setDeleting(true); setError(null);
    try {
      const result = await deleteOwnAccount(confirmation);
      if (result.success) { window.location.replace('/login?account_deleted=1'); return; }
      setError(result.message);
    } catch { setError('Deletion could not be confirmed. Sign in again to check your account before retrying.'); }
    setDeleting(false);
  }
  return <>
    <Alert title="Delete account" color="red" radius="md">
      <Text size="sm">Permanently remove your account and any workspaces where you are the only member. Shared workspaces remain available to their other members.</Text>
      <Button color="red" variant="outline" mt="sm" onClick={() => { setOpened(true); setConfirmation(''); setError(null); }}>Delete my account</Button>
    </Alert>
    <Modal opened={opened} onClose={() => { if (!deleting) setOpened(false); }} title="Permanently delete your account?" centered closeOnClickOutside={!deleting} closeOnEscape={!deleting} withCloseButton={!deleting}>
      <form onSubmit={submit}><Stack>
        <Text size="sm">Your profile, memberships, and workspaces where you are the only member—including their saved advertising data and decisions—will be permanently deleted. This cannot be undone.</Text>
        <Text size="sm">Shared workspaces are kept. If you are their last owner, transfer ownership first. Your Meta advertising will not be changed.</Text>
        <Text size="sm" c="dimmed">You must have signed in within the last 10 minutes. Accounts with owned uploads or unresolved operations require cleanup first.</Text>
        <TextInput label="Type DELETE to confirm" value={confirmation} onChange={event => setConfirmation(event.currentTarget.value)} autoComplete="off" disabled={deleting} data-autofocus />
        {error && <Alert color="red" role="alert">{error}</Alert>}
        <Group justify="flex-end">
          <Button variant="default" disabled={deleting} onClick={() => setOpened(false)}>Cancel</Button>
          <Button type="submit" color="red" loading={deleting} disabled={confirmation !== 'DELETE'}>Permanently delete account</Button>
        </Group>
      </Stack></form>
    </Modal>
  </>;
}
