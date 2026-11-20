'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Alert, Button, Modal, TextInput } from '@mantine/core';
import { deleteOwnAccount } from '@/lib/server/actions/user/settingsProfile';
import classes from '../SettingsSurface.module.css';

/** The only red button on the page. The confirmation word stays DELETE in every language (the server checks it). */
export default function DeleteAccount() {
  const t = useTranslations('settingsPage.danger');
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
    } catch { setError(t('error')); }
    setDeleting(false);
  }

  return (
    <>
      <div className={classes.actions} style={{ justifyContent: 'flex-start' }}>
        <Button color="red" variant="outline" onClick={() => { setOpened(true); setConfirmation(''); setError(null); }}>{t('button')}</Button>
      </div>
      <Modal opened={opened} onClose={() => { if (!deleting) setOpened(false); }} title={t('modalTitle')} centered size="lg"
        closeOnClickOutside={!deleting} closeOnEscape={!deleting} withCloseButton={!deleting}
        classNames={{ title: classes.modalTitle, body: classes.modalBody }}>
        <form onSubmit={submit} className={classes.formStack}>
          <p>{t('modalBody')}</p>
          <p>{t('modalShared')}</p>
          <p className={classes.hint}>{t('modalNote')}</p>
          <TextInput label={t('type')} value={confirmation} onChange={event => setConfirmation(event.currentTarget.value)} autoComplete="off" autoCapitalize="characters" disabled={deleting} data-autofocus />
          {error && <Alert color="red" variant="light" role="alert">{error}</Alert>}
          <div className={classes.actions}>
            <Button variant="default" disabled={deleting} onClick={() => setOpened(false)}>{t('cancel')}</Button>
            <Button type="submit" color="red" loading={deleting} disabled={confirmation !== 'DELETE'}>{t('confirm')}</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
