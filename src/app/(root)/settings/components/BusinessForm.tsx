'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Alert, Button, Select, Textarea, TextInput } from '@mantine/core';
import { updateBusinessProfileData } from '@/lib/server/actions/business/onboarding';
import {
  BUSINESS_CATEGORY_GROUPS,
  BUSINESS_CATEGORY_OPTIONS,
  CONTACT_METHOD_OPTIONS,
  CUSTOMER_RADIUS_OPTIONS,
  MONTHLY_AD_BUDGET_OPTIONS,
  SALON_MOST_VALUABLE_SERVICE_OPTIONS,
  SALON_SERVICE_OPTIONS,
  isAllowedOption,
  type OnboardingOption,
} from '@/lib/shared/onboarding/businessProfileOptions';
import classes from '../SettingsSurface.module.css';

export type BusinessValues = {
  businessName: string;
  industry: string;
  website: string;
  monthlyBudget: string;
  description: string;
  mainService: string;
  businessLocation: string;
  customerRadius: string;
  preferredContactMethod: string;
  bookingLink: string;
};

type Props = { initial: BusinessValues; promotedServices: string[]; canEdit: boolean };

const ABOUT = ['businessName', 'industry', 'website', 'monthlyBudget', 'description'] as const;
const FOR_ADS = ['mainService', 'businessLocation', 'customerRadius', 'preferredContactMethod', 'bookingLink'] as const;
const KEYS = [...ABOUT, ...FOR_ADS];

const mainServiceOptions = Array.from(
  new Map([...SALON_SERVICE_OPTIONS, ...SALON_MOST_VALUABLE_SERVICE_OPTIONS].map(option => [option.value, option])).values()
);

function isHttpUrl(value: string) {
  if (!value.trim()) return true;
  try { const url = new URL(value.trim()); return url.protocol === 'http:' || url.protocol === 'https:'; }
  catch { return false; }
}

/** Keeps a saved value that is no longer in the list visible instead of silently blanking it. */
function withCurrent(options: OnboardingOption[], current: string, label: (value: string) => string) {
  return !current || options.some(option => option.value === current) ? options : [...options, { value: current, label: label(current) }];
}

/**
 * Business details and the ad defaults in one form with one Save, so there is a single main
 * button. Only changed "about" fields are sent; the ad defaults go together (they are validated
 * together), and legacy values outside today's lists are preserved.
 */
export default function BusinessForm({ initial, promotedServices, canEdit }: Props) {
  const t = useTranslations('settingsPage');
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ success: boolean; message: string } | null>(null);
  const changed = KEYS.filter(key => values[key].trim() !== saved[key].trim());
  const adsChanged = FOR_ADS.some(key => changed.includes(key));
  const locked = !canEdit || saving;
  const set = (key: keyof BusinessValues, value: string) => { setValues(current => ({ ...current, [key]: value })); setFeedback(null); };
  const current = (value: string) => t('business.currentValue', { value: value.replaceAll('_', ' ') });

  const categoryData = BUSINESS_CATEGORY_OPTIONS.some(option => option.value === initial.industry) || !initial.industry
    ? BUSINESS_CATEGORY_GROUPS
    : [...BUSINESS_CATEGORY_GROUPS, { group: '—', items: [{ value: initial.industry, label: current(initial.industry) }] }];

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!canEdit || saving || changed.length === 0) return;
    if (!values.businessName.trim()) { setFeedback({ success: false, message: t('business.needName') }); return; }
    if (adsChanged && (!values.mainService || !values.businessLocation.trim() || !values.preferredContactMethod)) {
      setFeedback({ success: false, message: t('business.needAds') }); return;
    }
    if (!isHttpUrl(values.bookingLink)) { setFeedback({ success: false, message: t('business.badLink') }); return; }

    const patch: Record<string, string | string[] | null> = {};
    for (const key of ABOUT) if (changed.includes(key)) patch[key] = values[key].trim() || null;
    if (adsChanged) {
      const services = Array.from(new Set([values.mainService, ...promotedServices].filter(service => isAllowedOption(service, SALON_SERVICE_OPTIONS))));
      Object.assign(patch, {
        businessLocation: values.businessLocation.trim(),
        customerRadius: values.customerRadius || null,
        mostValuableService: values.mainService,
        preferredContactMethod: values.preferredContactMethod,
        bookingLink: values.bookingLink.trim() || null,
        ...(services.length > 0 ? { promotedServices: services } : {}),
      });
    }

    setSaving(true); setFeedback(null);
    try {
      const result = await updateBusinessProfileData(patch as Parameters<typeof updateBusinessProfileData>[0]);
      if (!result.success) { setFeedback({ success: false, message: result.error.userMessage || t('business.error') }); return; }
      const trimmed = { ...values };
      for (const key of KEYS) trimmed[key] = trimmed[key].trim();
      setValues(trimmed); setSaved(trimmed);
      setFeedback({ success: true, message: t('saved') });
      router.refresh();
    } catch { setFeedback({ success: false, message: t('business.error') }); }
    finally { setSaving(false); }
  }

  return (
    <form onSubmit={save} className={classes.formStack}>
      {!canEdit && <Alert color="gray" variant="light">{t('business.readOnly')}</Alert>}

      <fieldset disabled={locked} className={classes.group} aria-labelledby="business-about">
        <h3 id="business-about" className={classes.groupTitle}>{t('business.about')}</h3>
        <TextInput label={t('business.name')} required maxLength={200} autoComplete="organization" value={values.businessName} onChange={event => set('businessName', event.currentTarget.value)} />
        <div className={classes.fieldGrid}>
          <Select label={t('business.category')} placeholder={t('business.categoryPlaceholder')} searchable nothingFoundMessage={t('business.noMatch')} disabled={locked} data={categoryData} value={values.industry || null} onChange={value => set('industry', value ?? '')} />
          <Select label={t('business.budget')} placeholder={t('business.budgetPlaceholder')} clearable disabled={locked} data={withCurrent(MONTHLY_AD_BUDGET_OPTIONS, initial.monthlyBudget, current)} value={values.monthlyBudget || null} onChange={value => set('monthlyBudget', value ?? '')} description={t('business.budgetHint')} inputWrapperOrder={['label', 'input', 'description', 'error']} />
        </div>
        <TextInput label={t('business.website')} placeholder="https://" type="url" autoComplete="url" maxLength={2048} value={values.website} onChange={event => set('website', event.currentTarget.value)} />
        <Textarea label={t('business.description')} placeholder={t('business.descriptionPlaceholder')} autosize minRows={3} maxRows={8} maxLength={4000} value={values.description} onChange={event => set('description', event.currentTarget.value)} />
      </fieldset>

      <fieldset disabled={locked} className={classes.group} aria-labelledby="business-for-ads">
        <h3 id="business-for-ads" className={classes.groupTitle}>{t('business.forAds')}</h3>
        <p className={classes.groupLead}>{t('business.forAdsLead')}</p>
        <div className={classes.fieldGrid}>
          <Select label={t('business.mainService')} placeholder={t('business.mainServicePlaceholder')} searchable disabled={locked} data={withCurrent(mainServiceOptions, initial.mainService, current)} value={values.mainService || null} onChange={value => set('mainService', value ?? '')} />
          <TextInput label={t('business.area')} placeholder={t('business.areaPlaceholder')} autoComplete="address-level2" value={values.businessLocation} onChange={event => set('businessLocation', event.currentTarget.value)} />
          <Select label={t('business.radius')} placeholder={t('business.radiusPlaceholder')} clearable disabled={locked} data={withCurrent(CUSTOMER_RADIUS_OPTIONS, initial.customerRadius, current)} value={values.customerRadius || null} onChange={value => set('customerRadius', value ?? '')} />
          <Select label={t('business.contact')} placeholder={t('business.contactPlaceholder')} disabled={locked} data={withCurrent(CONTACT_METHOD_OPTIONS, initial.preferredContactMethod, current)} value={values.preferredContactMethod || null} onChange={value => set('preferredContactMethod', value ?? '')} />
        </div>
        <TextInput label={t('business.booking')} description={t('business.bookingHint')} inputWrapperOrder={['label', 'input', 'description', 'error']} placeholder="https://" type="url" maxLength={2048} value={values.bookingLink} onChange={event => set('bookingLink', event.currentTarget.value)} />
      </fieldset>

      {feedback && <Alert color={feedback.success ? 'green' : 'red'} variant="light" role="status">{feedback.message}</Alert>}
      {canEdit && (
        <div className={classes.actions}>
          {changed.length > 0 && <p className={classes.unsaved}>{t('unsaved')}</p>}
          {changed.length > 0 && <Button type="button" variant="default" disabled={saving} onClick={() => { setValues(saved); setFeedback(null); }}>{t('reset')}</Button>}
          <Button type="submit" loading={saving} disabled={changed.length === 0}>{t('save')}</Button>
        </div>
      )}
    </form>
  );
}
