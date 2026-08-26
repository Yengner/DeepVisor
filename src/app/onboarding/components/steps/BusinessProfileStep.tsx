'use client';

import {
  type ChangeEventHandler,
  type FocusEventHandler,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Autocomplete as GooglePlacesAutocomplete,
  useJsApiLoader,
} from '@react-google-maps/api';
import {
  Button,
  Group,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import {
  IconArrowRight,
  IconAlertCircle,
  IconBuilding,
  IconCheck,
  IconChevronLeft,
  IconCloudUpload,
  IconMapPin,
  IconMessageCircle,
  IconScissors,
  IconWallet,
} from '@tabler/icons-react';
import toast from 'react-hot-toast';
import { updateBusinessProfileData } from '@/lib/server/actions/business/onboarding';
import {
  CONTACT_METHOD_OPTIONS,
  CUSTOMER_RADIUS_OPTIONS,
  DEFAULT_INTELLIGENCE_GOALS,
  DEFAULT_WATCH_SIGNALS,
  MONTHLY_AD_BUDGET_OPTIONS,
  SALON_SERVICE_OPTIONS,
  isAllowedOption,
  labelForOption,
} from '@/lib/shared/onboarding/businessProfileOptions';
import type { UserData } from '../types';
import styles from './OnboardingSteps.module.css';

type BusinessProfileStepProps = {
  onNext: () => void | Promise<void>;
  onPrev: () => void | Promise<void>;
  userData: UserData;
  updateUserData: (data: Partial<UserData>) => void;
  showBack?: boolean;
};

type EssentialsFormValues = {
  businessName: string;
  mainService: string;
  businessLocation: string;
  customerRadius: string;
  preferredContactMethod: string;
  monthlyBudget: string;
};

type EssentialsField = keyof EssentialsFormValues;
type DraftSaveState = 'saving' | 'saved' | 'error';
type BusinessProfileDraft = Parameters<typeof updateBusinessProfileData>[0];
type QueuedDraft = {
  payload: BusinessProfileDraft;
  revision: number;
  savedFields: EssentialsField[];
};

const BUSINESS_NAME_PLACEHOLDERS = new Set([
  'my business',
  'business setup',
  'new business',
  'untitled business',
]);

const dropdownProps = {
  comboboxProps: {
    withinPortal: false,
    position: 'bottom-start' as const,
    middlewares: {
      flip: false,
      shift: true,
    },
  },
  maxDropdownHeight: 280,
};

const GOOGLE_PLACES_LIBRARIES: ('places')[] = ['places'];

function normalizeBusinessName(value: string): string {
  return value.trim();
}

function validateBusinessName(value: string): string | null {
  const normalized = normalizeBusinessName(value);

  if (!normalized) return 'Business name is required';

  if (BUSINESS_NAME_PLACEHOLDERS.has(normalized.toLowerCase())) {
    return 'Replace the default name with your real business name';
  }

  return null;
}

function requiredString(message: string) {
  return (value: string) => (value.trim() ? null : message);
}

function leadTypeForContact(contactMethod: string): string {
  switch (contactMethod) {
    case 'whatsapp_messages':
      return 'whatsapp_messages';
    case 'instagram_dms':
    case 'facebook_messenger':
      return 'messages';
    case 'phone_calls':
      return 'phone_calls';
    case 'lead_form':
      return 'instant_forms';
    case 'website_booking_link':
      return 'booking_link_clicks';
    default:
      return 'recommend_for_me';
  }
}

function initialMainService(userData: UserData): string {
  const allowedServices = new Set(SALON_SERVICE_OPTIONS.map((option) => option.value));
  if (allowedServices.has(userData.mostValuableService)) return userData.mostValuableService;
  return userData.promotedServices.find((service) => allowedServices.has(service)) ?? '';
}

function buildDraftPayload(
  values: EssentialsFormValues,
  dirtyFields: ReadonlySet<EssentialsField>,
  existingPromotedServices: string[]
): { payload: BusinessProfileDraft; savedFields: EssentialsField[] } {
  const payload: BusinessProfileDraft = {};
  const savedFields: EssentialsField[] = [];

  if (dirtyFields.has('businessName') && !validateBusinessName(values.businessName)) {
    payload.businessName = normalizeBusinessName(values.businessName);
    savedFields.push('businessName');
  }

  if (dirtyFields.has('mainService') && isAllowedOption(values.mainService, SALON_SERVICE_OPTIONS)) {
    payload.mostValuableService = values.mainService;
    payload.promotedServices = Array.from(
      new Set([values.mainService, ...existingPromotedServices].filter(Boolean))
    );
    savedFields.push('mainService');
  }

  if (dirtyFields.has('businessLocation') && values.businessLocation.trim()) {
    payload.businessLocation = values.businessLocation.trim();
    savedFields.push('businessLocation');
  }

  if (
    dirtyFields.has('customerRadius') &&
    isAllowedOption(values.customerRadius, CUSTOMER_RADIUS_OPTIONS)
  ) {
    payload.customerRadius = values.customerRadius;
    savedFields.push('customerRadius');
  }

  if (
    dirtyFields.has('preferredContactMethod') &&
    isAllowedOption(values.preferredContactMethod, CONTACT_METHOD_OPTIONS)
  ) {
    payload.preferredContactMethod = values.preferredContactMethod;
    savedFields.push('preferredContactMethod');
  }

  if (dirtyFields.has('monthlyBudget')) {
    if (!values.monthlyBudget) {
      payload.monthlyBudget = null;
      savedFields.push('monthlyBudget');
    } else if (isAllowedOption(values.monthlyBudget, MONTHLY_AD_BUDGET_OPTIONS)) {
      payload.monthlyBudget = values.monthlyBudget;
      savedFields.push('monthlyBudget');
    }
  }

  return { payload, savedFields };
}

function BusinessAddressInput({
  value,
  error,
  onChange,
  onBlur,
  onSelectAddress,
}: {
  value: string;
  error?: ReactNode;
  onChange: ChangeEventHandler<HTMLInputElement>;
  onBlur?: FocusEventHandler<HTMLInputElement>;
  onSelectAddress: (address: string) => void;
}) {
  const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);
  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'deepvisor-onboarding-google-places',
    googleMapsApiKey,
    libraries: GOOGLE_PLACES_LIBRARIES,
  });

  const input = (
    <TextInput
      label="Service address"
      placeholder="123 Main St, Tampa, FL"
      description="Used for local reporting and targeting context."
      required
      leftSection={<IconMapPin size={16} />}
      value={value}
      error={error}
      onChange={onChange}
      onBlur={onBlur}
      autoComplete="street-address"
    />
  );

  if (!googleMapsApiKey || loadError || !isLoaded) return input;

  return (
    <GooglePlacesAutocomplete
      onLoad={setAutocomplete}
      onPlaceChanged={() => {
        const place = autocomplete?.getPlace();
        const address = place?.formatted_address || place?.name || '';
        if (address) onSelectAddress(address);
      }}
      options={{
        fields: ['formatted_address', 'name', 'geometry'],
        types: ['establishment', 'geocode'],
      }}
    >
      {input}
    </GooglePlacesAutocomplete>
  );
}

export default function BusinessProfileStep({
  onNext,
  onPrev,
  userData,
  updateUserData,
  showBack = true,
}: BusinessProfileStepProps) {
  const [submitting, setSubmitting] = useState(false);
  const [draftSaveState, setDraftSaveState] = useState<DraftSaveState>('saved');
  const dirtyDraftFields = useRef<Set<EssentialsField>>(new Set());
  const draftRevision = useRef(0);
  const draftTimer = useRef<number | null>(null);
  const draftQueue = useRef<Promise<void>>(Promise.resolve());
  const pendingDraft = useRef<QueuedDraft | null>(null);
  const draftWorkerRunning = useRef(false);
  const submittingRef = useRef(false);
  const [draftChangeCount, setDraftChangeCount] = useState(0);
  const existingPromotedServices = useRef(userData.promotedServices);
  const initialValues = useRef<EssentialsFormValues>({
    businessName: validateBusinessName(userData.businessName || '')
      ? ''
      : normalizeBusinessName(userData.businessName),
    mainService: initialMainService(userData),
    businessLocation: userData.businessLocation || '',
    customerRadius: userData.customerRadius || '',
    preferredContactMethod: userData.preferredContactMethod || '',
    monthlyBudget: userData.monthlyBudget || '',
  });
  const latestDraftValues = useRef<EssentialsFormValues>(initialValues.current);
  const form = useForm<EssentialsFormValues>({
    initialValues: initialValues.current,
    validate: {
      businessName: validateBusinessName,
      mainService: requiredString('Choose your main service'),
      businessLocation: requiredString('Service address is required'),
      customerRadius: requiredString('Choose a customer radius'),
      preferredContactMethod: requiredString('Choose a preferred contact path'),
    },
    onValuesChange: (values, previous) => {
      if (submittingRef.current) return;

      (Object.keys(values) as EssentialsField[]).forEach((field) => {
        if (values[field] !== previous[field]) dirtyDraftFields.current.add(field);
      });
      latestDraftValues.current = values;
      draftRevision.current += 1;
      setDraftSaveState('saving');
      setDraftChangeCount((count) => count + 1);
    },
  });

  const enqueueDraft = (draft: QueuedDraft) => {
    // Keep only the newest not-yet-started snapshot while the active write finishes.
    pendingDraft.current = draft;
    if (draftWorkerRunning.current) return;

    draftWorkerRunning.current = true;
    draftQueue.current = (async () => {
      try {
        while (pendingDraft.current) {
          const nextDraft = pendingDraft.current;
          pendingDraft.current = null;

          try {
            const result = await updateBusinessProfileData(nextDraft.payload);
            if (nextDraft.revision !== draftRevision.current) continue;

            if (!result.success) {
              setDraftSaveState('error');
              continue;
            }

            nextDraft.savedFields.forEach((field) => dirtyDraftFields.current.delete(field));
            setDraftSaveState(dirtyDraftFields.current.size === 0 ? 'saved' : 'error');
          } catch (error) {
            console.error('Error saving onboarding draft:', error);
            if (nextDraft.revision === draftRevision.current) {
              setDraftSaveState('error');
            }
          }
        }
      } finally {
        draftWorkerRunning.current = false;
      }
    })();
  };

  useEffect(() => {
    if (draftChangeCount === 0) return;

    if (draftTimer.current) window.clearTimeout(draftTimer.current);
    const requestRevision = draftRevision.current;

    draftTimer.current = window.setTimeout(() => {
      const dirtyFields = new Set(dirtyDraftFields.current);
      const { payload, savedFields } = buildDraftPayload(
        latestDraftValues.current,
        dirtyFields,
        existingPromotedServices.current
      );

      if (Object.keys(payload).length === 0) {
        if (requestRevision === draftRevision.current) setDraftSaveState('error');
        return;
      }

      enqueueDraft({
        payload,
        revision: requestRevision,
        savedFields,
      });
    }, 900);

    return () => {
      if (draftTimer.current) {
        window.clearTimeout(draftTimer.current);
        draftTimer.current = null;
      }
    };
  }, [draftChangeCount]);

  const handleSubmit = async (values: typeof form.values) => {
    submittingRef.current = true;
    setSubmitting(true);

    try {
      if (draftTimer.current) {
        window.clearTimeout(draftTimer.current);
        draftTimer.current = null;
      }
      draftRevision.current += 1;
      await draftQueue.current;

      const businessName = normalizeBusinessName(values.businessName);
      const serviceLabel = labelForOption(values.mainService, SALON_SERVICE_OPTIONS, 'services');
      const primaryGoal = userData.primaryGoal || DEFAULT_INTELLIGENCE_GOALS.primaryGoal;
      const promotedServices = Array.from(
        new Set([values.mainService, ...userData.promotedServices].filter(Boolean))
      );
      const cleanValues: Partial<UserData> = {
        businessName,
        businessLocation: values.businessLocation.trim(),
        customerRadius: values.customerRadius,
        monthlyBudget: values.monthlyBudget || 'not_sure',
        promotedServices,
        mostValuableService: values.mainService,
        preferredContactMethod: values.preferredContactMethod,
        industry: userData.industry || 'other',
        description:
          userData.description ||
          `${businessName} offers ${serviceLabel.toLowerCase()} in ${values.businessLocation.trim()}.`,
        metaAdsStatus: userData.metaAdsStatus || 'not_sure',
        primaryGoal,
        leadType: userData.leadType || leadTypeForContact(values.preferredContactMethod),
        leadQualitySignal:
          userData.leadQualitySignal || DEFAULT_INTELLIGENCE_GOALS.leadQualitySignal,
        watchSignals:
          userData.watchSignals.length > 0 ? userData.watchSignals : [...DEFAULT_WATCH_SIGNALS],
        recommendationStyle:
          userData.recommendationStyle || DEFAULT_INTELLIGENCE_GOALS.recommendationStyle,
        safetyPreference:
          userData.safetyPreference || DEFAULT_INTELLIGENCE_GOALS.safetyPreference,
        adGoals: userData.adGoals.length > 0 ? userData.adGoals : [primaryGoal],
        preferredPlatforms:
          userData.preferredPlatforms.length > 0 ? userData.preferredPlatforms : ['meta'],
      };

      const saveRes = await updateBusinessProfileData(cleanValues);
      if (!saveRes.success) {
        setDraftSaveState('error');
        toast.error(saveRes.error.userMessage);
        return;
      }

      dirtyDraftFields.current.clear();
      setDraftSaveState('saved');
      updateUserData(cleanValues);
      await onNext();
    } catch (error) {
      console.error('Error saving business profile:', error);
      setDraftSaveState('error');
      toast.error('Failed to save your business profile');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <Stack gap="lg" className={styles.stepRoot}>
      <div className={styles.stepIntro}>
        <div className={styles.stepMetaRow}>
          <span className={styles.stepKicker}>01 / Business essentials</span>
          <span
            className={[
              styles.draftState,
              draftSaveState === 'error' ? styles.draftStateError : '',
            ].filter(Boolean).join(' ')}
            aria-live="polite"
          >
            {draftSaveState === 'saving' ? <IconCloudUpload size={14} /> : null}
            {draftSaveState === 'saved' ? <IconCheck size={14} /> : null}
            {draftSaveState === 'error' ? <IconAlertCircle size={14} /> : null}
            {draftSaveState === 'saving' ? 'Saving...' : null}
            {draftSaveState === 'saved' ? 'Saved' : null}
            {draftSaveState === 'error' ? 'Not saved' : null}
          </span>
        </div>
        <Title order={2} className={styles.stepTitle}>
          Tell us enough to make the dashboard useful.
        </Title>
        <Text className={styles.stepCopy}>
          This is the only business form required before your workspace opens.
        </Text>
      </div>

      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="lg">
          <fieldset
            className={styles.essentialsSection}
            aria-labelledby="business-essentials-heading"
            disabled={submitting}
          >
            <Group mb="md" className={styles.sectionHeader}>
              <span className={styles.sectionIcon}><IconBuilding size={17} /></span>
              <Title id="business-essentials-heading" order={3} className={styles.sectionTitle}>
                Business essentials
              </Title>
            </Group>

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <TextInput
                label="Business name"
                placeholder="Your business name"
                description="This names your DeepVisor workspace."
                required
                leftSection={<IconBuilding size={16} />}
                autoComplete="organization"
                {...form.getInputProps('businessName')}
              />
              <Select
                label="Main service"
                placeholder="Choose one service"
                description="Start with the service that matters most."
                required
                searchable
                leftSection={<IconScissors size={16} />}
                data={SALON_SERVICE_OPTIONS}
                {...dropdownProps}
                {...form.getInputProps('mainService')}
              />
              <BusinessAddressInput
                value={form.values.businessLocation}
                error={form.errors.businessLocation}
                onChange={(event) => form.setFieldValue('businessLocation', event.currentTarget.value)}
                onBlur={() => form.validateField('businessLocation')}
                onSelectAddress={(address) => form.setFieldValue('businessLocation', address)}
              />
              <Select
                label="Customer radius"
                placeholder="Choose a radius"
                description="Choose Not sure if you want to decide later."
                required
                leftSection={<IconMapPin size={16} />}
                data={CUSTOMER_RADIUS_OPTIONS}
                {...dropdownProps}
                {...form.getInputProps('customerRadius')}
              />
              <Select
                label="Preferred contact path"
                placeholder="How should leads reach you?"
                description="Used to focus lead and conversion reporting."
                required
                leftSection={<IconMessageCircle size={16} />}
                data={CONTACT_METHOD_OPTIONS}
                {...dropdownProps}
                {...form.getInputProps('preferredContactMethod')}
              />
              <Select
                label="Monthly ad budget"
                placeholder="Optional"
                description="You can add or change this later."
                clearable
                leftSection={<IconWallet size={16} />}
                data={MONTHLY_AD_BUDGET_OPTIONS}
                {...dropdownProps}
                {...form.getInputProps('monthlyBudget')}
              />
            </SimpleGrid>
          </fieldset>

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
              Save and continue
            </Button>
          </Group>
        </Stack>
      </form>
    </Stack>
  );
}
