'use client';

import { type ChangeEventHandler, type FocusEventHandler, type ReactNode, useMemo, useState } from 'react';
import { Autocomplete as GooglePlacesAutocomplete, useJsApiLoader } from '@react-google-maps/api';
import {
  Button,
  Card,
  Group,
  MultiSelect,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import {
  IconArrowRight,
  IconBuilding,
  IconChevronLeft,
  IconMapPin,
  IconScissors,
  IconWallet,
} from '@tabler/icons-react';
import toast from 'react-hot-toast';
import { updateBusinessProfileData } from '@/lib/server/actions/business/onboarding';
import {
  CUSTOMER_RADIUS_OPTIONS,
  META_ADS_STATUS_OPTIONS,
  MONTHLY_AD_BUDGET_OPTIONS,
  SALON_INDUSTRY_OPTIONS,
  SALON_MOST_VALUABLE_SERVICE_OPTIONS,
  SALON_SERVICE_OPTIONS,
} from '@/lib/shared/onboarding/businessProfileOptions';
import type { UserData } from '../types';
import styles from './OnboardingSteps.module.css';

type BusinessProfileStepProps = {
  onNext: () => void;
  onPrev: () => void;
  userData: UserData;
  updateUserData: (data: Partial<UserData>) => void;
  showBack?: boolean;
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

  if (!normalized) {
    return 'Business name is required';
  }

  if (BUSINESS_NAME_PLACEHOLDERS.has(normalized.toLowerCase())) {
    return 'Replace the default name with your real business name';
  }

  return null;
}

function requiredString(message: string) {
  return (value: string) => (value.trim() ? null : message);
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
      label="Business address"
      placeholder="123 Main St, Tampa, FL"
      description={
        googleMapsApiKey
          ? 'Start typing to search for your salon address.'
          : 'Used to understand your local market and ad radius.'
      }
      required
      leftSection={<IconMapPin size={16} />}
      value={value}
      error={error}
      onChange={onChange}
      onBlur={onBlur}
      autoComplete="street-address"
    />
  );

  if (!googleMapsApiKey || loadError || !isLoaded) {
    return input;
  }

  return (
    <GooglePlacesAutocomplete
      onLoad={setAutocomplete}
      onPlaceChanged={() => {
        const place = autocomplete?.getPlace();
        const address = place?.formatted_address || place?.name || '';
        if (address) {
          onSelectAddress(address);
        }
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

  const form = useForm({
    initialValues: {
      businessName: validateBusinessName(userData.businessName || '')
        ? ''
        : normalizeBusinessName(userData.businessName),
      industry: userData.industry || '',
      businessLocation: userData.businessLocation || '',
      website: userData.website || '',
      bookingLink: userData.bookingLink || '',
      customerRadius: userData.customerRadius || '',
      promotedServices: Array.isArray(userData.promotedServices) ? userData.promotedServices : [],
      mostValuableService: userData.mostValuableService || '',
      description: userData.description || '',
      monthlyBudget: userData.monthlyBudget || '',
      metaAdsStatus: userData.metaAdsStatus || '',
    },
    validate: {
      businessName: validateBusinessName,
      industry: requiredString('Industry is required'),
      businessLocation: requiredString('Business address is required'),
      promotedServices: (value) => (value.length === 0 ? 'Choose at least one service' : null),
      mostValuableService: requiredString('Choose your most valuable service'),
      description: requiredString('A short business context is required'),
      monthlyBudget: requiredString('Monthly ad budget is required'),
      metaAdsStatus: requiredString('Meta ads status is required'),
    },
    onValuesChange: (values) => {
      updateUserData({
        businessName: values.businessName,
        industry: values.industry,
        businessLocation: values.businessLocation,
        website: values.website,
        bookingLink: values.bookingLink,
        customerRadius: values.customerRadius,
        promotedServices: values.promotedServices,
        mostValuableService: values.mostValuableService,
        description: values.description,
        monthlyBudget: values.monthlyBudget,
        metaAdsStatus: values.metaAdsStatus,
      });
    },
  });

  const mostValuableServiceOptions = useMemo(() => {
    if (form.values.promotedServices.length === 0) {
      return SALON_MOST_VALUABLE_SERVICE_OPTIONS;
    }

    const selectedOptions = SALON_SERVICE_OPTIONS.filter((option) =>
      form.values.promotedServices.includes(option.value)
    );
    const includesOther = selectedOptions.some((option) => option.value === 'other');

    return includesOther
      ? selectedOptions
      : [...selectedOptions, { value: 'other', label: 'Other' }];
  }, [form.values.promotedServices]);

  const handleSubmit = async (values: typeof form.values) => {
    setSubmitting(true);
    try {
      const businessName = normalizeBusinessName(values.businessName);
      const cleanValues = {
        businessName,
        industry: values.industry,
        businessLocation: values.businessLocation.trim(),
        website: values.website.trim(),
        bookingLink: values.bookingLink.trim(),
        customerRadius: values.customerRadius,
        promotedServices: values.promotedServices,
        mostValuableService: values.mostValuableService,
        description: values.description.trim(),
        monthlyBudget: values.monthlyBudget,
        metaAdsStatus: values.metaAdsStatus,
      };

      updateUserData(cleanValues);

      const saveRes = await updateBusinessProfileData(cleanValues);
      if (!saveRes.success) {
        toast.error(saveRes.error.userMessage);
        return;
      }

      onNext();
    } catch (error) {
      console.error('Error saving business profile:', error);
      toast.error('Failed to save your business profile');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Stack gap="lg" className={styles.stepRoot}>
      <div className={styles.stepIntro}>
        <span className={styles.stepKicker}>01 / Business context</span>
        <Title order={2} className={styles.stepTitle}>
          Define the business behind the numbers.
        </Title>
        <Text className={styles.stepCopy}>
          Help DeepVisor understand your salon, local market, services, customers, and budget.
        </Text>
      </div>

      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="lg">
          <Card withBorder p="lg" radius="sm" className={styles.sectionCard}>
            <Group mb="md" className={styles.sectionHeader}>
              <span className={styles.sectionIcon}><IconBuilding size={17} /></span>
              <Title order={4} className={styles.sectionTitle}>Workspace and market</Title>
            </Group>
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <TextInput
                label="Business name"
                placeholder="DeepVisor Salon"
                description="This becomes the name of your business workspace."
                required
                {...form.getInputProps('businessName')}
              />
              <Select
                label="Industry"
                placeholder="Select industry"
                description="Used for reporting baselines and recommendation context."
                required
                data={SALON_INDUSTRY_OPTIONS}
                {...dropdownProps}
                {...form.getInputProps('industry')}
              />
              <BusinessAddressInput
                value={form.values.businessLocation}
                error={form.errors.businessLocation}
                onChange={(event) => form.setFieldValue('businessLocation', event.currentTarget.value)}
                onBlur={() => form.validateField('businessLocation')}
                onSelectAddress={(address) => {
                  form.setFieldValue('businessLocation', address);
                  updateUserData({ businessLocation: address });
                }}
              />
              <Select
                label="How far do your customers usually travel?"
                placeholder="Select radius"
                description="Optional. Helps DeepVisor reason about local targeting."
                data={CUSTOMER_RADIUS_OPTIONS}
                {...dropdownProps}
                {...form.getInputProps('customerRadius')}
              />
              <TextInput
                label="Website"
                placeholder="https://yourbusiness.com"
                description="Optional. Adds context to your profile."
                {...form.getInputProps('website')}
              />
              <TextInput
                label="Booking link"
                placeholder="https://yourbookinglink.com"
                description="Optional, but helps DeepVisor understand where customers should take action."
                {...form.getInputProps('bookingLink')}
              />
            </SimpleGrid>
          </Card>

          <Card withBorder p="lg" radius="sm" className={styles.sectionCard}>
            <Group mb="md" className={styles.sectionHeader}>
              <span className={styles.sectionIcon}><IconScissors size={17} /></span>
              <Title order={4} className={styles.sectionTitle}>Services and customers</Title>
            </Group>
            <Stack gap="md">
              <MultiSelect
                label="Main services you want to promote"
                placeholder="Choose services"
                description="DeepVisor uses this to understand which offers, creatives, and leads matter most."
                required
                searchable
                data={SALON_SERVICE_OPTIONS}
                {...dropdownProps}
                {...form.getInputProps('promotedServices')}
              />
              <Select
                label="Which service is most valuable to your business?"
                placeholder="Choose service"
                description="Used to prioritize recommendations around higher-value customers."
                required
                data={mostValuableServiceOptions}
                {...dropdownProps}
                {...form.getInputProps('mostValuableService')}
              />
              <Textarea
                label="What do you sell and who are you trying to reach?"
                placeholder="Example: We are a hair salon in Tampa that offers color, balayage, extensions, and haircuts. We want to reach women within 10 miles who are looking for premium hair services and consultations."
                description="This is the most important non-platform input for recommendations."
                minRows={4}
                required
                {...form.getInputProps('description')}
              />
            </Stack>
          </Card>

          <Card withBorder p="lg" radius="sm" className={styles.sectionCard}>
            <Group mb="md" className={styles.sectionHeader}>
              <span className={styles.sectionIcon}><IconWallet size={17} /></span>
              <Title order={4} className={styles.sectionTitle}>Ads and budget</Title>
            </Group>
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <Select
                label="Monthly ad budget"
                placeholder="Select budget range"
                description="Used for pacing suggestions, guardrails, and safe campaign recommendations."
                required
                data={MONTHLY_AD_BUDGET_OPTIONS}
                {...dropdownProps}
                {...form.getInputProps('monthlyBudget')}
              />
              <Select
                label="Are you currently running Facebook or Instagram ads?"
                placeholder="Select status"
                description="Helps DeepVisor decide whether to analyze existing ads or help you start simple."
                required
                data={META_ADS_STATUS_OPTIONS}
                {...dropdownProps}
                {...form.getInputProps('metaAdsStatus')}
              />
            </SimpleGrid>
          </Card>
        </Stack>

        <Group justify={showBack ? 'space-between' : 'flex-end'} mt="xl" className={styles.actionBar}>
          {showBack ? (
            <Button
              variant="default"
              onClick={onPrev}
              type="button"
              leftSection={<IconChevronLeft size={16} />}
              className={styles.secondaryButton}
            >
              Back
            </Button>
          ) : null}
          <Button
            type="submit"
            loading={submitting}
            rightSection={<IconArrowRight size={17} />}
            className={styles.primaryButton}
          >
            Continue
          </Button>
        </Group>
      </form>
    </Stack>
  );
}
