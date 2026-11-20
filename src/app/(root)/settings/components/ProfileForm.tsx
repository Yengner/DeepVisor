'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Alert, Button, TextInput } from '@mantine/core';
import { requestOwnEmailChange, updateOwnProfile } from '@/lib/server/actions/user/settingsProfile';
import classes from '../SettingsSurface.module.css';

type Props = { initial: { first_name: string; last_name: string; phone_number: string | null; email: string } };
type Feedback = { success: boolean; message: string } | null;

/** Name and phone (one Save), then the sign-in email (its own button: it needs confirmation). */
export default function ProfileForm({ initial }: Props) {
  const t = useTranslations('settingsPage');
  const router = useRouter();
  const start = { first_name: initial.first_name, last_name: initial.last_name, phone_number: initial.phone_number ?? '' };
  const [values, setValues] = useState(start);
  const [saved, setSaved] = useState(start);
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [emailSaving, setEmailSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [emailFeedback, setEmailFeedback] = useState<Feedback>(null);
  const dirty = (Object.keys(start) as (keyof typeof start)[]).some(key => values[key].trim() !== saved[key].trim());
  const nextEmail = email.trim().toLowerCase();
  const set = (key: keyof typeof start, value: string) => { setValues(current => ({ ...current, [key]: value })); setFeedback(null); };

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!dirty || saving) return;
    setSaving(true); setFeedback(null);
    try {
      const result = await updateOwnProfile(values);
      setFeedback(result.success ? { success: true, message: t('saved') } : result);
      if (result.success) { setSaved(values); router.refresh(); }
    } catch { setFeedback({ success: false, message: t('profile.error') }); }
    finally { setSaving(false); }
  }

  async function changeEmail(event: FormEvent) {
    event.preventDefault();
    if (!nextEmail || emailSaving) return;
    setEmailSaving(true); setEmailFeedback(null);
    try {
      const result = await requestOwnEmailChange(nextEmail);
      // The action answers in English; show our own words for the two success cases.
      const message = !result.success ? result.message : result.message === 'Email updated.' ? t('profile.emailUpdated') : t('profile.emailCheck');
      setEmailFeedback({ success: result.success, message });
      if (result.success) { setEmail(''); router.refresh(); }
    } catch { setEmailFeedback({ success: false, message: t('profile.error') }); }
    finally { setEmailSaving(false); }
  }

  return (
    <div className={classes.formStack}>
      <form onSubmit={save} className={classes.group} aria-labelledby="profile-personal">
        <h3 id="profile-personal" className={classes.groupTitle}>{t('profile.personal')}</h3>
        <div className={classes.fieldGrid}>
          <TextInput label={t('profile.firstName')} autoComplete="given-name" required maxLength={100} disabled={saving} value={values.first_name} onChange={event => set('first_name', event.currentTarget.value)} />
          <TextInput label={t('profile.lastName')} autoComplete="family-name" required maxLength={100} disabled={saving} value={values.last_name} onChange={event => set('last_name', event.currentTarget.value)} />
        </div>
        <TextInput label={t('profile.phone')} description={t('profile.phoneHint')} inputWrapperOrder={['label', 'input', 'description', 'error']} type="tel" autoComplete="tel" maxLength={40} disabled={saving} value={values.phone_number} onChange={event => set('phone_number', event.currentTarget.value)} />
        {feedback && <Alert color={feedback.success ? 'green' : 'red'} variant="light" role="status">{feedback.message}</Alert>}
        <div className={classes.actions}>
          {dirty && <Button type="button" variant="default" disabled={saving} onClick={() => { setValues(saved); setFeedback(null); }}>{t('reset')}</Button>}
          <Button type="submit" loading={saving} disabled={!dirty}>{t('save')}</Button>
        </div>
      </form>

      <form onSubmit={changeEmail} className={classes.group} aria-labelledby="profile-email">
        <h3 id="profile-email" className={classes.groupTitle}>{t('profile.email')}</h3>
        <p className={classes.groupLead}>{t.rich('profile.emailNow', { email: initial.email, strong: chunk => <strong>{chunk}</strong> }) ?? null}</p>
        <TextInput label={t('profile.emailNew')} description={t('profile.emailHint')} inputWrapperOrder={['label', 'input', 'description', 'error']} type="email" autoComplete="email" maxLength={254} disabled={emailSaving} value={email} onChange={event => { setEmail(event.currentTarget.value); setEmailFeedback(null); }} />
        {emailFeedback && <Alert color={emailFeedback.success ? 'green' : 'red'} variant="light" role="status">{emailFeedback.message}</Alert>}
        <div className={classes.actions}>
          <Button type="submit" variant="default" loading={emailSaving} disabled={!nextEmail || nextEmail === initial.email.toLowerCase()}>{t('profile.emailButton')}</Button>
        </div>
      </form>
    </div>
  );
}
