'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Divider, SimpleGrid, Stack, Text, TextInput } from '@mantine/core';
import { requestOwnEmailChange, updateOwnProfile } from '@/lib/server/actions/user/settingsProfile';
import classes from './ProfileForm.module.css';

type Props = { initial: { first_name: string; last_name: string; phone_number: string | null; email: string } };
type Feedback = { success: boolean; message: string } | null;

export default function ProfileForm({ initial }: Props) {
  const router = useRouter();
  const [values, setValues] = useState({ first_name: initial.first_name, last_name: initial.last_name, phone_number: initial.phone_number ?? '' });
  const [email, setEmail] = useState(initial.email);
  const [saving, setSaving] = useState(false);
  const [emailSaving, setEmailSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [emailFeedback, setEmailFeedback] = useState<Feedback>(null);
  const [requestedEmail, setRequestedEmail] = useState<string | null>(null);
  const dirty = values.first_name.trim() !== initial.first_name.trim()
    || values.last_name.trim() !== initial.last_name.trim()
    || values.phone_number.trim() !== (initial.phone_number ?? '').trim();
  const normalizedEmail = email.trim().toLowerCase();

  async function save(event: FormEvent) {
    event.preventDefault(); setSaving(true); setFeedback(null);
    try {
      const result = await updateOwnProfile(values); setFeedback(result);
      if (result.success) router.refresh();
    } catch { setFeedback({ success: false, message: 'Unable to save. Please try again.' }); }
    finally { setSaving(false); }
  }

  async function changeEmail(event: FormEvent) {
    event.preventDefault(); setEmailSaving(true); setEmailFeedback(null);
    try {
      const result = await requestOwnEmailChange(email); setEmailFeedback(result);
      if (result.success) { setRequestedEmail(normalizedEmail); router.refresh(); }
    } catch { setEmailFeedback({ success: false, message: 'Unable to request email change. Please try again.' }); }
    finally { setEmailSaving(false); }
  }

  return <Stack gap="xl" className={classes.form}>
    <form onSubmit={save}>
      <Stack gap="md">
        <div>
          <h2 className={classes.heading}>Personal details</h2>
          <p className={classes.helper}>Choose how your name and contact details appear in DeepVisor.</p>
        </div>
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <TextInput label="First name" autoComplete="given-name" required maxLength={100} disabled={saving} value={values.first_name} onChange={event => { setValues({ ...values, first_name: event.currentTarget.value }); setFeedback(null); }} />
          <TextInput label="Last name" autoComplete="family-name" required maxLength={100} disabled={saving} value={values.last_name} onChange={event => { setValues({ ...values, last_name: event.currentTarget.value }); setFeedback(null); }} />
        </SimpleGrid>
        <TextInput label="Phone number" type="tel" autoComplete="tel" maxLength={40} disabled={saving} value={values.phone_number} onChange={event => { setValues({ ...values, phone_number: event.currentTarget.value }); setFeedback(null); }} description="Optional. Include your country code, for example +1 202 555 0100." />
        {feedback && <Alert color={feedback.success ? 'green' : 'red'} role="status">{feedback.message}</Alert>}
        <div className={classes.actions}>
          {dirty && <Button type="button" variant="default" disabled={saving} onClick={() => {
            setValues({ first_name: initial.first_name, last_name: initial.last_name, phone_number: initial.phone_number ?? '' });
            setFeedback(null);
          }}>Reset</Button>}
          <Button type="submit" className={classes.saveButton} loading={saving} disabled={!dirty}>Save profile</Button>
        </div>
      </Stack>
    </form>
    <Divider />
    <form onSubmit={changeEmail}>
      <Stack gap="md">
        <div>
          <h2 className={classes.heading}>Sign-in email</h2>
          <p className={classes.helper}>Update the email address you use to access your account.</p>
        </div>
        <Text size="sm" className={classes.currentEmail}>Current email: <strong>{initial.email}</strong></Text>
        <TextInput label="Email address" type="email" autoComplete="email" required maxLength={254} disabled={emailSaving} value={email} onChange={event => { setEmail(event.currentTarget.value); setEmailFeedback(null); }} description="Changes require email verification and a sign-in within the last 10 minutes." />
        {emailFeedback && <Alert color={emailFeedback.success ? 'green' : 'red'} role="status">{emailFeedback.message}</Alert>}
        <div className={classes.actions}>
          <Button type="submit" variant="light" className={classes.emailButton} loading={emailSaving} disabled={normalizedEmail === initial.email.toLowerCase() || normalizedEmail === requestedEmail}>Change email</Button>
        </div>
      </Stack>
    </form>
  </Stack>;
}
