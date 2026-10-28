'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Divider, SimpleGrid, Stack, Text, TextInput } from '@mantine/core';
import { requestOwnEmailChange, updateOwnProfile } from '@/lib/server/actions/user/settingsProfile';

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
      if (result.success) router.refresh();
    } catch { setEmailFeedback({ success: false, message: 'Unable to request email change. Please try again.' }); }
    finally { setEmailSaving(false); }
  }

  return <Stack gap="md">
    <form onSubmit={save}>
      <Stack gap="sm">
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <TextInput label="First name" autoComplete="given-name" required maxLength={100} value={values.first_name} onChange={event => setValues({ ...values, first_name: event.currentTarget.value })} />
          <TextInput label="Last name" autoComplete="family-name" required maxLength={100} value={values.last_name} onChange={event => setValues({ ...values, last_name: event.currentTarget.value })} />
        </SimpleGrid>
        <TextInput label="Phone number" type="tel" autoComplete="tel" maxLength={40} value={values.phone_number} onChange={event => setValues({ ...values, phone_number: event.currentTarget.value })} description="Optional contact number; this does not change your sign-in method." />
        {feedback && <Alert color={feedback.success ? 'green' : 'red'} role="status">{feedback.message}</Alert>}
        <Button type="submit" loading={saving} style={{ alignSelf: 'flex-start' }}>Save profile</Button>
      </Stack>
    </form>
    <Divider />
    <form onSubmit={changeEmail}>
      <Stack gap="sm">
        <Text size="sm" c="dimmed">Current email: {initial.email}</Text>
        <TextInput label="Email address" type="email" autoComplete="email" required maxLength={254} value={email} onChange={event => setEmail(event.currentTarget.value)} description="Changes require email verification and a sign-in within the last 10 minutes." />
        {emailFeedback && <Alert color={emailFeedback.success ? 'green' : 'red'} role="status">{emailFeedback.message}</Alert>}
        <Button type="submit" variant="light" loading={emailSaving} disabled={email.trim().toLowerCase() === initial.email.toLowerCase()} style={{ alignSelf: 'flex-start' }}>Change email</Button>
      </Stack>
    </form>
  </Stack>;
}
