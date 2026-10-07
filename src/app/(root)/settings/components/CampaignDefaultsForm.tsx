'use client';
import { ownerMessages } from '@/components/product/presentation';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Button,
  Group,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
} from '@mantine/core';
import { IconCheck, IconDeviceFloppy, IconMapPin } from '@tabler/icons-react';
import { updateBusinessProfileData } from '@/lib/server/actions/business/onboarding';
import {
  CONTACT_METHOD_OPTIONS,
  CUSTOMER_RADIUS_OPTIONS,
  MONTHLY_AD_BUDGET_OPTIONS,
  SALON_MOST_VALUABLE_SERVICE_OPTIONS,
  SALON_SERVICE_OPTIONS,
  isAllowedOption,
} from '@/lib/shared/onboarding/businessProfileOptions';

type CampaignDefaultsFormProps = {
  initial: {
    businessLocation: string;
    customerRadius: string;
    mainService: string;
    promotedServices: string[];
    preferredContactMethod: string;
    bookingLink: string;
    monthlyBudget: string;
  };
};

const toSelectData = (options: Array<{ value: string; label: string }>) =>
  options.map((option) => ({ value: option.value, label: option.label }));

const mainServiceOptions = Array.from(
  new Map(
    [...SALON_SERVICE_OPTIONS, ...SALON_MOST_VALUABLE_SERVICE_OPTIONS].map((option) => [
      option.value,
      option,
    ])
  ).values()
);

function isValidHttpUrl(value: string): boolean {
  if (!value.trim()) return true;

  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export default function CampaignDefaultsForm({ initial }: CampaignDefaultsFormProps) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  async function handleSave() {
    if (!values.businessLocation.trim() || !values.mainService || !values.preferredContactMethod) {
      setFeedback({
        type: 'error',
        message: 'Add a service area, main service, and preferred lead path.',
      });
      return;
    }

    if (!isValidHttpUrl(values.bookingLink)) {
      setFeedback({
        type: 'error',
        message: 'Enter a complete http or https booking destination.',
      });
      return;
    }

    setSaving(true);
    setFeedback(null);

    try {
      const promotedServices = Array.from(
        new Set(
          [values.mainService, ...values.promotedServices].filter((service) =>
            isAllowedOption(service, SALON_SERVICE_OPTIONS)
          )
        )
      );
      const response = await updateBusinessProfileData({
        businessLocation: values.businessLocation.trim(),
        customerRadius: values.customerRadius || null,
        ...(promotedServices.length > 0 ? { promotedServices } : {}),
        mostValuableService: values.mainService,
        preferredContactMethod: values.preferredContactMethod,
        bookingLink: values.bookingLink.trim() || null,
        ...(isAllowedOption(values.monthlyBudget, MONTHLY_AD_BUDGET_OPTIONS)
          ? { monthlyBudget: values.monthlyBudget }
          : values.monthlyBudget
            ? {}
            : { monthlyBudget: null }),
      });

      if (!response.success) {
        setFeedback({
          type: 'error',
          message: response.error.userMessage || 'Campaign defaults could not be saved.',
        });
        return;
      }

      setFeedback({
        type: 'success',
        message: 'Campaign defaults saved.',
      });
      router.refresh();
    } catch (error) {
      console.error('Campaign defaults could not be saved', error);
      setFeedback({
        type: 'error',
        message: ownerMessages.preferences,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section style={{ borderTop: '1px solid var(--mantine-color-gray-3)', paddingTop: 20, marginTop: 20 }}>
      <Group justify="space-between" align="flex-start" gap="md" wrap="wrap" mb="md">
        <Group gap="sm" align="flex-start" wrap="nowrap">
          <ThemeIcon variant="light" color="signal" radius="md">
            <IconMapPin size={17} />
          </ThemeIcon>
          <div>
            <Text fw={700}>Campaign defaults</Text>
            <Text size="sm" c="dimmed" maw={680}>
              Stable salon details used when a previous ad does not contain a reusable value.
            </Text>
          </div>
        </Group>
        <Button
          type="button"
          size="sm"
          leftSection={<IconDeviceFloppy size={16} />}
          loading={saving}
          onClick={() => void handleSave()}
        >
          Save defaults
        </Button>
      </Group>

      <Stack gap="md">
        {feedback ? (
          <Alert
            color={feedback.type === 'success' ? 'signal' : 'red'}
            icon={feedback.type === 'success' ? <IconCheck size={16} /> : undefined}
          >
            {feedback.message}
          </Alert>
        ) : null}

        <SimpleGrid cols={{ base: 1, sm: 2, xl: 3 }} spacing="md">
          <Select
            label="Main service"
            placeholder="Choose a service"
            searchable
            data={toSelectData(mainServiceOptions)}
            value={values.mainService || null}
            onChange={(value) =>
              setValues((current) => ({ ...current, mainService: value ?? '' }))
            }
            required
          />
          <TextInput
            label="Service area"
            placeholder="Business address or city"
            value={values.businessLocation}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                businessLocation: event.currentTarget.value,
              }))
            }
            required
          />
          <Select
            label="Customer radius"
            placeholder="Choose a radius"
            clearable
            data={toSelectData(CUSTOMER_RADIUS_OPTIONS)}
            value={values.customerRadius || null}
            onChange={(value) =>
              setValues((current) => ({ ...current, customerRadius: value ?? '' }))
            }
          />
          <Select
            label="Preferred lead path"
            placeholder="Choose a lead path"
            data={toSelectData(CONTACT_METHOD_OPTIONS)}
            value={values.preferredContactMethod || null}
            onChange={(value) =>
              setValues((current) => ({ ...current, preferredContactMethod: value ?? '' }))
            }
            required
          />
          <TextInput
            label="Booking destination"
            placeholder="https://..."
            type="url"
            value={values.bookingLink}
            onChange={(event) =>
              setValues((current) => ({ ...current, bookingLink: event.currentTarget.value }))
            }
          />
          <Select
            label="Monthly budget guardrail"
            placeholder="Optional"
            clearable
            data={toSelectData(MONTHLY_AD_BUDGET_OPTIONS)}
            value={values.monthlyBudget || null}
            onChange={(value) =>
              setValues((current) => ({ ...current, monthlyBudget: value ?? '' }))
            }
          />
        </SimpleGrid>
      </Stack>
    </section>
  );
}
