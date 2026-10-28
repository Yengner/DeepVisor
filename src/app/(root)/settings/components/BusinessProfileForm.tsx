'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Select, SimpleGrid, Stack, Textarea, TextInput } from '@mantine/core';
import { updateBusinessProfileData } from '@/lib/server/actions/business/onboarding';
import { MONTHLY_AD_BUDGET_OPTIONS, SALON_INDUSTRY_OPTIONS } from '@/lib/shared/onboarding/businessProfileOptions';
import classes from './ProfileForm.module.css';

type Values = { businessName: string; industry: string; website: string; monthlyBudget: string; description: string };
type Props = { initial: Values; canEdit: boolean };
const keys: (keyof Values)[] = ['businessName', 'industry', 'website', 'monthlyBudget', 'description'];

export default function BusinessProfileForm({ initial, canEdit }: Props) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [savedValues, setSavedValues] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ success: boolean; message: string } | null>(null);
  const changed = keys.filter(key => values[key].trim() !== savedValues[key].trim());
  const industryOptions = SALON_INDUSTRY_OPTIONS.some(option => option.value === initial.industry) || !initial.industry
    ? SALON_INDUSTRY_OPTIONS : [...SALON_INDUSTRY_OPTIONS, { value: initial.industry, label: initial.industry.replaceAll('_', ' ') }];
  const budgetOptions = MONTHLY_AD_BUDGET_OPTIONS.some(option => option.value === initial.monthlyBudget) || !initial.monthlyBudget
    ? MONTHLY_AD_BUDGET_OPTIONS : [...MONTHLY_AD_BUDGET_OPTIONS, { value: initial.monthlyBudget, label: `Current value: ${initial.monthlyBudget}` }];
  const setField = (key: keyof Values, value: string) => { setValues(current => ({ ...current, [key]: value })); setFeedback(null); };

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!canEdit || saving || !changed.length) return;
    setSaving(true); setFeedback(null);
    try {
      // Patch only changed fields, preserving legacy/unknown values and unrelated settings.
      const patch = Object.fromEntries(changed.map(key => [key, values[key].trim() || null]));
      const result = await updateBusinessProfileData(patch);
      setFeedback(result.success ? { success: true, message: 'Business details saved.' }
        : { success: false, message: result.error.userMessage || 'Business details could not be saved. Please try again.' });
      if (result.success) {
        const normalized = { ...values };
        for (const key of keys) normalized[key] = normalized[key].trim();
        setValues(normalized); setSavedValues(normalized);
        router.refresh();
      }
    } catch { setFeedback({ success: false, message: 'Business details could not be saved. Please try again.' }); }
    finally { setSaving(false); }
  }

  return <form onSubmit={save} className={classes.form}>
    <Stack gap="md">
      <div>
        <h2 className={classes.heading}>Business details</h2>
        <p className={classes.helper}>Keep the information DeepVisor uses to understand your business up to date.</p>
      </div>
      {!canEdit && <Alert color="gray">Only workspace owners and admins can edit business details.</Alert>}
      <fieldset disabled={!canEdit || saving} className={classes.fields}>
        <Stack gap="md">
          <TextInput label="Business name" required maxLength={200} autoComplete="organization" value={values.businessName} onChange={event => setField('businessName', event.currentTarget.value)} />
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <Select label="Industry" placeholder="Choose your industry" disabled={!canEdit || saving} data={industryOptions} value={values.industry || null} onChange={value => setField('industry', value ?? '')} />
            <Select label="Monthly advertising budget" placeholder="Not set" disabled={!canEdit || saving} clearable data={budgetOptions} value={values.monthlyBudget || null} onChange={value => setField('monthlyBudget', value ?? '')} inputWrapperOrder={['label', 'input', 'description', 'error']} description="Your planning range in DeepVisor; this does not change Meta budgets." />
          </SimpleGrid>
          <TextInput label="Business website" placeholder="https://your-business.com" type="url" autoComplete="url" maxLength={2048} value={values.website} onChange={event => setField('website', event.currentTarget.value)} />
          <Textarea label="Business description" placeholder="Describe your services and the customers you serve." autosize minRows={4} maxRows={8} maxLength={4000} value={values.description} onChange={event => setField('description', event.currentTarget.value)} />
        </Stack>
      </fieldset>
      {feedback && <Alert color={feedback.success ? 'green' : 'red'} role="status">{feedback.message}</Alert>}
      {canEdit && <div className={classes.actions}>
        {changed.length > 0 && <Button type="button" variant="default" disabled={saving} onClick={() => { setValues(initial); setSavedValues(initial); setFeedback(null); }}>Reset business details</Button>}
        <Button type="submit" className={classes.saveButton} loading={saving} disabled={!changed.length}>Save business details</Button>
      </div>}
    </Stack>
  </form>;
}
