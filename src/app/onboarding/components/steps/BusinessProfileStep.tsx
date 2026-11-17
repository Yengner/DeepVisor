'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Button,
  Chip,
  Collapse,
  Input,
  Group,
  Radio,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
  UnstyledButton,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import {
  IconAlertCircle,
  IconArrowRight,
  IconBuilding,
  IconBuildingStore,
  IconCar,
  IconCategory,
  IconCheck,
  IconChevronDown,
  IconChevronLeft,
  IconCloudUpload,
  IconMapPin,
  IconWallet,
  IconWorld,
} from '@tabler/icons-react';
import toast from 'react-hot-toast';
import { updateBusinessProfileData } from '@/lib/server/actions/business/onboarding';
import {
  BUSINESS_CATEGORY_GROUPS,
  BUSINESS_CATEGORY_OPTIONS,
  CONTACT_METHOD_OPTIONS,
  CUSTOMER_RADIUS_OPTIONS,
  MONTHLY_AD_BUDGET_OPTIONS,
  isAllowedOption,
} from '@/lib/shared/onboarding/businessProfileOptions';
import { DEFAULT_COUNTRY_CODE, isCountryCode, type CountryOption } from '@/lib/shared/onboarding/countries';
import {
  NOT_SURE_CONTACT_METHOD,
  normalizeContactMethods,
  resolveContactSelection,
} from '@/lib/shared/onboarding/contactMethods';
import {
  isLocationMode,
  isPlaceholderBusinessName,
  normalizeBusinessName,
} from '@/lib/shared/onboarding/requirements';
import type { UserData } from '../types';
import styles from './OnboardingSteps.module.css';

type BusinessProfileStepProps = {
  /** Country options built on the server (see countries.ts). */
  countries: CountryOption[];
  onNext: () => void | Promise<void>;
  onPrev: () => void | Promise<void>;
  userData: UserData;
  updateUserData: (data: Partial<UserData>) => void;
  showBack?: boolean;
};

type FormValues = {
  businessName: string;
  industry: string;
  locationMode: string;
  locationStreet: string;
  locationCity: string;
  locationRegion: string;
  locationPostalCode: string;
  locationCountry: string;
  customerRadius: string;
  contactMethods: string[];
  preferredContactMethod: string;
  website: string;
  monthlyBudget: string;
  description: string;
};

type SaveState = 'idle' | 'saving' | 'saved' | 'pending' | 'error';
type ProfilePayload = Parameters<typeof updateBusinessProfileData>[0];

const LOCATION_KEYS = [
  'locationMode', 'locationStreet', 'locationCity', 'locationRegion', 'locationPostalCode', 'locationCountry',
] as const;
const AUTOSAVE_DELAY_MS = 800;

const comboboxProps = {
  withinPortal: false,
  position: 'bottom-start' as const,
  middlewares: { flip: true, shift: true },
};

function validateBusinessName(value: string): string | null {
  const normalized = normalizeBusinessName(value);
  if (!normalized) return 'Enter your business name';
  if (isPlaceholderBusinessName(normalized)) return 'Use your real business name';
  if (normalized.length > 200) return 'Keep the name under 200 characters';
  return null;
}

/** Accepts "bayside.com" and stores "https://bayside.com"; returns null when not a usable URL. */
function normalizeWebsite(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(candidate);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    if (!url.hostname.includes('.')) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function required(message: string) {
  return (value: string) => (value.trim() ? null : message);
}

function locationComplete(values: FormValues): boolean {
  return (
    isLocationMode(values.locationMode) &&
    Boolean(values.locationCity.trim() && values.locationRegion.trim()) &&
    isCountryCode(values.locationCountry)
  );
}

function initialValues(userData: UserData): FormValues {
  const name = normalizeBusinessName(userData.businessName);
  return {
    businessName: name && !isPlaceholderBusinessName(name) ? name : '',
    industry: isAllowedOption(userData.industry, BUSINESS_CATEGORY_OPTIONS) ? userData.industry : '',
    locationMode: isLocationMode(userData.locationMode) ? userData.locationMode : '',
    locationStreet: userData.locationStreet,
    locationCity: userData.locationCity,
    locationRegion: userData.locationRegion,
    locationPostalCode: userData.locationPostalCode,
    locationCountry: isCountryCode(userData.locationCountry) ? userData.locationCountry : DEFAULT_COUNTRY_CODE,
    customerRadius: isAllowedOption(userData.customerRadius, CUSTOMER_RADIUS_OPTIONS) ? userData.customerRadius : '',
    contactMethods: normalizeContactMethods(userData.contactMethods),
    preferredContactMethod: isAllowedOption(userData.preferredContactMethod, CONTACT_METHOD_OPTIONS)
      ? userData.preferredContactMethod
      : '',
    website: userData.website,
    monthlyBudget: isAllowedOption(userData.monthlyBudget, MONTHLY_AD_BUDGET_OPTIONS) ? userData.monthlyBudget : '',
    description: userData.description,
  };
}

function optionalString(value: string): string | null {
  return value.trim() || null;
}

/**
 * Builds the save payload for fields that changed since the last save and are valid.
 * Only what the owner typed is sent: no defaults, guesses, or generated text.
 */
function buildPayload(values: FormValues, saved: FormValues, includeUnchanged = false) {
  const changed = (key: keyof FormValues) => includeUnchanged || values[key] !== saved[key];
  const payload: ProfilePayload = {};
  let pending = false;

  if (changed('businessName')) {
    if (!validateBusinessName(values.businessName)) payload.businessName = normalizeBusinessName(values.businessName);
    else pending = true;
  }
  if (changed('industry')) {
    if (isAllowedOption(values.industry, BUSINESS_CATEGORY_OPTIONS)) payload.industry = values.industry;
    else pending = true;
  }
  if (LOCATION_KEYS.some(changed)) {
    if (locationComplete(values)) {
      payload.locationMode = values.locationMode;
      payload.locationStreet = optionalString(values.locationStreet);
      payload.locationCity = values.locationCity.trim();
      payload.locationRegion = values.locationRegion.trim();
      payload.locationPostalCode = optionalString(values.locationPostalCode);
      payload.locationCountry = values.locationCountry;
    } else {
      pending = true;
    }
  }
  if (changed('contactMethods') || changed('preferredContactMethod')) {
    const selection = resolveContactSelection(values.contactMethods, values.preferredContactMethod);
    if ('error' in selection) {
      pending = true;
    } else {
      payload.contactMethods = selection.contactMethods;
      payload.preferredContactMethod = selection.preferredContactMethod;
    }
  }
  // Optional fields: send a value when entered, null only when an earlier value was cleared.
  const optional = (key: 'customerRadius' | 'monthlyBudget' | 'description', target: keyof ProfilePayload) => {
    if (!changed(key)) return;
    const value = optionalString(values[key]);
    if (value) (payload as Record<string, unknown>)[target] = value;
    else if (saved[key].trim()) (payload as Record<string, unknown>)[target] = null;
  };
  optional('customerRadius', 'customerRadius');
  optional('monthlyBudget', 'monthlyBudget');
  optional('description', 'description');
  if (changed('website')) {
    const website = normalizeWebsite(values.website);
    if (website) payload.website = website;
    else if (!values.website.trim()) {
      if (saved.website.trim()) payload.website = null;
    } else pending = true;
  }

  return { payload, pending };
}

/** Marks optional fields in the label so every input in a row starts at the same height. */
function OptionalLabel({ children }: { children: string }) {
  return (
    <>
      {children} <span className={styles.optionalTag}>optional</span>
    </>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === 'idle') return null;
  const content = {
    saving: { icon: <IconCloudUpload size={14} />, text: 'Saving…' },
    saved: { icon: <IconCheck size={14} />, text: 'Saved' },
    pending: { icon: null, text: 'Finish the highlighted fields to save' },
    error: { icon: <IconAlertCircle size={14} />, text: 'Couldn’t save — we’ll retry when you continue' },
  }[state];

  return (
    <span
      className={[styles.draftState, state === 'error' ? styles.draftStateError : ''].filter(Boolean).join(' ')}
      aria-live="polite"
    >
      {content.icon}
      {content.text}
    </span>
  );
}

export default function BusinessProfileStep({
  countries,
  onNext,
  onPrev,
  userData,
  updateUserData,
  showBack = true,
}: BusinessProfileStepProps) {
  const [submitting, setSubmitting] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [optionalOpen, setOptionalOpen] = useState(
    () => Boolean(userData.website || userData.monthlyBudget || userData.description)
  );
  const [editCount, setEditCount] = useState(0);
  const savedValues = useRef<FormValues>(initialValues(userData));
  const saveChain = useRef<Promise<unknown>>(Promise.resolve());
  const saveSequence = useRef(0);

  const form = useForm<FormValues>({
    initialValues: savedValues.current,
    validate: {
      businessName: validateBusinessName,
      industry: required('Choose the closest category, or Other'),
      locationMode: required('Choose how you serve customers'),
      locationCity: required('Enter your city'),
      locationRegion: required('Enter your state or region'),
      locationCountry: (value) => (isCountryCode(value) ? null : 'Choose your country'),
      contactMethods: (value) => (value.length > 0 ? null : 'Choose at least one way customers reach you'),
      preferredContactMethod: (value, values) =>
        values.contactMethods.length > 1 && !values.contactMethods.includes(value)
          ? 'Choose which one brings the most customers'
          : null,
      website: (value) => (!value.trim() || normalizeWebsite(value) ? null : 'Enter a website like yourbusiness.com'),
    },
    onValuesChange: () => setEditCount((count) => count + 1),
  });

  const persist = (payload: ProfilePayload, pending: boolean) => {
    const sequence = ++saveSequence.current;
    const snapshot = { ...form.getValues() };
    setSaveState('saving');
    const run = saveChain.current.then(async () => {
      const result = await updateBusinessProfileData(payload);
      if (result.success) {
        // Mark only the sent fields as saved so later edits still count as changes.
        const next = { ...savedValues.current };
        for (const key of Object.keys(snapshot) as (keyof FormValues)[]) {
          const isLocation = (LOCATION_KEYS as readonly string[]).includes(key);
          const sent = isLocation ? 'locationMode' in payload : key in payload;
          if (sent) (next as Record<keyof FormValues, unknown>)[key] = snapshot[key];
        }
        savedValues.current = next;
      }
      if (sequence === saveSequence.current) {
        setSaveState(result.success ? (pending ? 'pending' : 'saved') : 'error');
      }
      return result;
    }).catch((error: unknown) => {
      console.error('Error saving onboarding draft:', error);
      if (sequence === saveSequence.current) setSaveState('error');
      return null;
    });
    saveChain.current = run;
    return run;
  };

  useEffect(() => {
    if (editCount === 0 || submitting) return;
    const timer = window.setTimeout(() => {
      const { payload, pending } = buildPayload(form.getValues(), savedValues.current);
      if (Object.keys(payload).length === 0) {
        setSaveState(pending ? 'pending' : 'saved');
        return;
      }
      void persist(payload, pending);
    }, AUTOSAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
    // persist/form are stable for this component's lifetime; editCount drives autosave.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editCount]);

  const handleSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      await saveChain.current;
      const { payload } = buildPayload(values, savedValues.current, true);
      const result = await persist(payload, false);
      if (!result || !result.success) {
        toast.error(result && !result.success ? result.error.userMessage : 'Your business details could not be saved.');
        return;
      }
      updateUserData({
        businessName: normalizeBusinessName(values.businessName),
        industry: values.industry,
        locationMode: values.locationMode,
        locationStreet: values.locationStreet.trim(),
        locationCity: values.locationCity.trim(),
        locationRegion: values.locationRegion.trim(),
        locationPostalCode: values.locationPostalCode.trim(),
        locationCountry: values.locationCountry,
        customerRadius: values.customerRadius,
        contactMethods: values.contactMethods,
        preferredContactMethod:
          values.contactMethods.length === 1 ? values.contactMethods[0] : values.preferredContactMethod,
        website: normalizeWebsite(values.website) ?? '',
        monthlyBudget: values.monthlyBudget,
        description: values.description.trim(),
      });
      await onNext();
    } finally {
      setSubmitting(false);
    }
  };

  const serviceArea = form.values.locationMode === 'service_area';
  const contactMethods = form.values.contactMethods;
  const contactLabel = (value: string) =>
    value === NOT_SURE_CONTACT_METHOD
      ? 'Not sure yet'
      : CONTACT_METHOD_OPTIONS.find((option) => option.value === value)?.label ?? value;

  const setContactMethods = (next: string[]) => {
    const previous = form.values.contactMethods;
    const added = next.find((value) => !previous.includes(value));
    // "Not sure yet" and real methods are mutually exclusive.
    const list = normalizeContactMethods(
      added === NOT_SURE_CONTACT_METHOD
        ? [NOT_SURE_CONTACT_METHOD]
        : added
          ? next.filter((value) => value !== NOT_SURE_CONTACT_METHOD)
          : next
    );
    form.setFieldValue('contactMethods', list);
    const main = form.values.preferredContactMethod;
    // One method is its own main method. Going from one to several asks the owner to pick,
    // so the first-clicked chip is never silently saved as the main one.
    if (list.length <= 1) form.setFieldValue('preferredContactMethod', list[0] ?? '');
    else if (previous.length <= 1 || !list.includes(main)) form.setFieldValue('preferredContactMethod', '');
  };

  return (
    <Stack gap="lg" className={styles.stepRoot}>
      <div className={styles.stepIntro}>
        <div className={styles.stepMetaRow}>
          <span className={styles.stepKicker}>Step 1 · Your business</span>
          <SaveIndicator state={saveState} />
        </div>
        <Title order={2} className={styles.stepTitle}>
          Tell us about your business.
        </Title>
        <Text className={styles.stepCopy}>
          Four quick answers. You can change any of them later in Settings.
        </Text>
      </div>

      <form
        noValidate
        onSubmit={form.onSubmit(handleSubmit, () => {
          toast.error('A few details are still needed.');
        })}
      >
        <Stack gap="lg">
          <fieldset className={styles.essentialsSection} disabled={submitting}>
            <Stack gap="md">
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                <TextInput
                  label="Business name"
                  placeholder="e.g. Bayside Plumbing"
                  withAsterisk
                  leftSection={<IconBuilding size={16} />}
                  autoComplete="organization"
                  maxLength={200}
                  key={form.key('businessName')}
                  {...form.getInputProps('businessName')}
                />
                <Select
                  label="What kind of business?"
                  placeholder="Search categories"
                  withAsterisk
                  searchable
                  nothingFoundMessage="No match — choose Other at the bottom"
                  leftSection={<IconCategory size={16} />}
                  data={BUSINESS_CATEGORY_GROUPS}
                  comboboxProps={comboboxProps}
                  maxDropdownHeight={300}
                  // Chrome ignores "off" here and suggests saved company/website values;
                  // an unrecognised token plus a specific name stops its type guessing.
                  name="dv-business-category"
                  autoComplete="dv-business-category"
                  key={form.key('industry')}
                  {...form.getInputProps('industry')}
                />
              </SimpleGrid>

              <Radio.Group
                label="How do you serve customers?"
                withAsterisk
                key={form.key('locationMode')}
                {...form.getInputProps('locationMode')}
              >
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm" mt={8}>
                  <Radio.Card value="storefront" className={styles.choiceCard} radius="sm">
                    <Group wrap="nowrap" align="flex-start" gap="sm">
                      <Radio.Indicator />
                      <div>
                        <Text fw={700} size="sm"><IconBuildingStore size={15} className={styles.choiceIcon} />Customers come to me</Text>
                        <Text size="xs" c="dimmed">A shop, office, studio, or restaurant.</Text>
                      </div>
                    </Group>
                  </Radio.Card>
                  <Radio.Card value="service_area" className={styles.choiceCard} radius="sm">
                    <Group wrap="nowrap" align="flex-start" gap="sm">
                      <Radio.Indicator />
                      <div>
                        <Text fw={700} size="sm"><IconCar size={15} className={styles.choiceIcon} />I travel to customers</Text>
                        <Text size="xs" c="dimmed">Home services, mobile, or on-site work.</Text>
                      </div>
                    </Group>
                  </Radio.Card>
                </SimpleGrid>
              </Radio.Group>

              <Collapse in={Boolean(form.values.locationMode)}>
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                  {!serviceArea ? (
                    <TextInput
                      label={<OptionalLabel>Street address</OptionalLabel>}
                      placeholder="e.g. 123 Main St"
                      leftSection={<IconMapPin size={16} />}
                      autoComplete="street-address"
                      maxLength={200}
                      className={styles.fullRow}
                      key={form.key('locationStreet')}
                      {...form.getInputProps('locationStreet')}
                    />
                  ) : null}
                  <TextInput
                    label={serviceArea ? 'City you work from' : 'City'}
                    placeholder="e.g. Tampa"
                    withAsterisk
                    autoComplete="address-level2"
                    maxLength={120}
                    key={form.key('locationCity')}
                    {...form.getInputProps('locationCity')}
                  />
                  <TextInput
                    label="State / region"
                    placeholder="e.g. FL"
                    withAsterisk
                    autoComplete="address-level1"
                    maxLength={120}
                    key={form.key('locationRegion')}
                    {...form.getInputProps('locationRegion')}
                  />
                  {!serviceArea ? (
                    <TextInput
                      label={<OptionalLabel>ZIP / postal code</OptionalLabel>}
                      placeholder="e.g. 33602"
                      autoComplete="postal-code"
                      maxLength={20}
                      key={form.key('locationPostalCode')}
                      {...form.getInputProps('locationPostalCode')}
                    />
                  ) : null}
                  <Select
                    label="Country"
                    withAsterisk
                    searchable
                    name="dv-business-country"
                    autoComplete="dv-business-country"
                    data={countries}
                    comboboxProps={comboboxProps}
                    allowDeselect={false}
                    key={form.key('locationCountry')}
                    {...form.getInputProps('locationCountry')}
                  />
                  <Select
                    label={<OptionalLabel>{serviceArea ? 'How far do you travel?' : 'How far do customers come from?'}</OptionalLabel>}
                    placeholder="Choose a distance"
                    clearable
                    data={CUSTOMER_RADIUS_OPTIONS}
                    comboboxProps={comboboxProps}
                    key={form.key('customerRadius')}
                    {...form.getInputProps('customerRadius')}
                  />
                </SimpleGrid>
              </Collapse>

              <Input.Wrapper
                label="How do customers reach you?"
                description="Pick all that apply."
                withAsterisk
                labelElement="div"
                error={form.errors.contactMethods}
              >
                <Chip.Group multiple value={contactMethods} onChange={setContactMethods}>
                  <Group gap={8} mt={8} className={styles.chipRow} role="group" aria-label="How do customers reach you?">
                    {CONTACT_METHOD_OPTIONS.map((option) => (
                      <Chip key={option.value} value={option.value} radius="sm" variant="outline">
                        {contactLabel(option.value)}
                      </Chip>
                    ))}
                  </Group>
                </Chip.Group>
              </Input.Wrapper>

              <Collapse in={contactMethods.length > 1}>
                <Radio.Group
                  label="Which one brings the most customers?"
                  description="DeepVisor uses it as the default when you run lead campaigns."
                  withAsterisk
                  key={form.key('preferredContactMethod')}
                  {...form.getInputProps('preferredContactMethod')}
                >
                  <Group gap="md" mt={8}>
                    {contactMethods.map((value) => (
                      <Radio key={value} value={value} label={contactLabel(value)} />
                    ))}
                  </Group>
                </Radio.Group>
              </Collapse>
            </Stack>
          </fieldset>

          <section className={styles.optionalSection}>
            <UnstyledButton
              type="button"
              className={styles.optionalToggle}
              onClick={() => setOptionalOpen((open) => !open)}
              aria-expanded={optionalOpen}
              aria-controls="onboarding-optional-details"
            >
              <span>
                <strong>Helpful, not required</strong>
                <span>Website, ad budget, and a short description</span>
              </span>
              <IconChevronDown size={18} className={optionalOpen ? styles.chevronOpen : undefined} />
            </UnstyledButton>
            <Collapse in={optionalOpen} id="onboarding-optional-details">
              <fieldset className={styles.optionalFields} disabled={submitting}>
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                  <TextInput
                    label="Website"
                    placeholder="yourbusiness.com"
                    leftSection={<IconWorld size={16} />}
                    autoComplete="url"
                    inputMode="url"
                    maxLength={2048}
                    key={form.key('website')}
                    {...form.getInputProps('website')}
                  />
                  <Select
                    label="Monthly ad budget"
                    placeholder="Choose a range"
                    description="A planning range; this never changes Meta budgets."
                    inputWrapperOrder={['label', 'input', 'description', 'error']}
                    clearable
                    leftSection={<IconWallet size={16} />}
                    data={MONTHLY_AD_BUDGET_OPTIONS}
                    comboboxProps={comboboxProps}
                    key={form.key('monthlyBudget')}
                    {...form.getInputProps('monthlyBudget')}
                  />
                  <Textarea
                    label="What do you offer?"
                    placeholder="e.g. Emergency plumbing, water heaters, and drain cleaning across Tampa Bay."
                    autosize
                    minRows={2}
                    maxRows={5}
                    maxLength={4000}
                    className={styles.fullRow}
                    key={form.key('description')}
                    {...form.getInputProps('description')}
                  />
                </SimpleGrid>
              </fieldset>
            </Collapse>
          </section>

          <Group justify="space-between" className={styles.actionBar} wrap="nowrap">
            {showBack ? (
              <Button
                variant="default"
                leftSection={<IconChevronLeft size={16} />}
                onClick={() => void onPrev()}
                disabled={submitting}
                className={styles.secondaryButton}
              >
                Back
              </Button>
            ) : <span />}
            <Button
              type="submit"
              loading={submitting}
              rightSection={<IconArrowRight size={16} />}
              className={styles.primaryButton}
            >
              Continue
            </Button>
          </Group>
        </Stack>
      </form>
    </Stack>
  );
}
