'use client';

import { useState } from 'react';
import {
  Button,
  Card,
  Group,
  MultiSelect,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconChartBar, IconShieldCheck, IconTargetArrow } from '@tabler/icons-react';
import toast from 'react-hot-toast';
import { updateBusinessProfileData } from '@/lib/server/actions/business/onboarding';
import {
  AVERAGE_CUSTOMER_VALUE_OPTIONS,
  CONTACT_METHOD_OPTIONS,
  DEFAULT_INTELLIGENCE_GOALS,
  DEFAULT_WATCH_SIGNALS,
  INTELLIGENCE_GOAL_OPTIONS,
  LEAD_QUALITY_SIGNAL_OPTIONS,
  LEAD_TYPE_OPTIONS,
  RECOMMENDATION_STYLE_OPTIONS,
  SAFETY_PREFERENCE_OPTIONS,
  TARGET_COST_PER_LEAD_OPTIONS,
  WATCH_SIGNAL_OPTIONS,
} from '@/lib/shared/onboarding/salonProfile';
import type { UserData } from '../types';

type PreferencesStepProps = {
  onNext: () => void;
  onPrev: () => void;
  userData: UserData;
  updateUserData: (data: Partial<UserData>) => void;
};

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

function requiredString(message: string) {
  return (value: string) => (value.trim() ? null : message);
}

export default function PreferencesStep({
  onNext,
  onPrev,
  userData,
  updateUserData,
}: PreferencesStepProps) {
  const [submitting, setSubmitting] = useState(false);

  const form = useForm({
    initialValues: {
      primaryGoal: userData.primaryGoal || DEFAULT_INTELLIGENCE_GOALS.primaryGoal,
      leadType: userData.leadType || DEFAULT_INTELLIGENCE_GOALS.leadType,
      preferredContactMethod: userData.preferredContactMethod || DEFAULT_INTELLIGENCE_GOALS.preferredContactMethod,
      leadQualitySignal: userData.leadQualitySignal || DEFAULT_INTELLIGENCE_GOALS.leadQualitySignal,
      averageCustomerValue: userData.averageCustomerValue || '',
      targetCostPerLead: userData.targetCostPerLead || '',
      watchSignals: Array.isArray(userData.watchSignals) && userData.watchSignals.length > 0
        ? userData.watchSignals
        : [...DEFAULT_WATCH_SIGNALS],
      recommendationStyle: userData.recommendationStyle || DEFAULT_INTELLIGENCE_GOALS.recommendationStyle,
      safetyPreference: userData.safetyPreference || DEFAULT_INTELLIGENCE_GOALS.safetyPreference,
    },
    validate: {
      primaryGoal: requiredString('Choose a primary goal'),
      leadType: requiredString('Choose the lead type that matters most'),
      preferredContactMethod: requiredString('Choose a preferred contact method'),
      leadQualitySignal: requiredString('Choose what makes a lead valuable'),
      watchSignals: (value) => (value.length === 0 ? 'Choose at least one signal' : null),
      recommendationStyle: requiredString('Choose how DeepVisor should recommend actions'),
      safetyPreference: requiredString('Choose a safety preference'),
    },
    onValuesChange: (values) => {
      updateUserData({
        primaryGoal: values.primaryGoal,
        leadType: values.leadType,
        preferredContactMethod: values.preferredContactMethod,
        leadQualitySignal: values.leadQualitySignal,
        averageCustomerValue: values.averageCustomerValue,
        targetCostPerLead: values.targetCostPerLead,
        watchSignals: values.watchSignals,
        recommendationStyle: values.recommendationStyle,
        safetyPreference: values.safetyPreference,
      });
    },
  });

  const handleSubmit = async (values: typeof form.values) => {
    setSubmitting(true);
    try {
      updateUserData(values);

      const saveRes = await updateBusinessProfileData({
        primaryGoal: values.primaryGoal,
        leadType: values.leadType,
        preferredContactMethod: values.preferredContactMethod,
        leadQualitySignal: values.leadQualitySignal,
        averageCustomerValue: values.averageCustomerValue,
        targetCostPerLead: values.targetCostPerLead,
        watchSignals: values.watchSignals,
        recommendationStyle: values.recommendationStyle,
        safetyPreference: values.safetyPreference,
        adGoals: [values.primaryGoal],
        preferredPlatforms: ['meta'],
      });

      if (!saveRes.success) {
        toast.error(saveRes.error.userMessage);
        return;
      }

      onNext();
    } catch (error) {
      console.error('Error saving intelligence goals:', error);
      toast.error('Failed to save your intelligence goals');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Stack gap="xl" py={16}>
      <div>
        <Title order={2} ta="center">
          Intelligence Goals & Signals
        </Title>
        <Text size="lg" c="dimmed" ta="center" className="max-w-xl mx-auto mb-6">
          Tell DeepVisor what counts as a valuable lead so recommendations stay tied to real business outcomes.
        </Text>
      </div>

      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="lg">
          <Card withBorder p="lg" radius="lg">
            <Group mb="md">
              <IconTargetArrow size={20} />
              <Title order={4}>Lead goals</Title>
            </Group>
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <Select
                label="What is your main goal with DeepVisor?"
                placeholder="Choose goal"
                description="This helps DeepVisor prioritize insights and recommendations."
                required
                data={INTELLIGENCE_GOAL_OPTIONS}
                {...dropdownProps}
                {...form.getInputProps('primaryGoal')}
              />
              <Select
                label="What type of lead matters most to you?"
                placeholder="Choose lead type"
                description="DeepVisor uses this to judge ad quality, not just lead quantity."
                required
                data={LEAD_TYPE_OPTIONS}
                {...dropdownProps}
                {...form.getInputProps('leadType')}
              />
              <Select
                label="How do you prefer new customers to contact you?"
                placeholder="Choose contact method"
                description="Used when DeepVisor recommends lead campaigns."
                required
                data={CONTACT_METHOD_OPTIONS}
                {...dropdownProps}
                {...form.getInputProps('preferredContactMethod')}
              />
              <Select
                label="What makes a lead valuable to you?"
                placeholder="Choose quality signal"
                description="DeepVisor uses this to learn which ads are creating real business value."
                required
                data={LEAD_QUALITY_SIGNAL_OPTIONS}
                {...dropdownProps}
                {...form.getInputProps('leadQualitySignal')}
              />
            </SimpleGrid>
          </Card>

          <Card withBorder p="lg" radius="lg">
            <Group mb="md">
              <IconChartBar size={20} />
              <Title order={4}>Value and cost targets</Title>
            </Group>
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <Select
                label="About how much is a new customer worth?"
                placeholder="Select value"
                description="Used to estimate ROI and understand how much you can afford to spend per lead."
                data={AVERAGE_CUSTOMER_VALUE_OPTIONS}
                {...dropdownProps}
                {...form.getInputProps('averageCustomerValue')}
              />
              <Select
                label="Do you have a target cost per lead?"
                placeholder="Select target"
                description="Optional. DeepVisor can recommend one if you are not sure."
                data={TARGET_COST_PER_LEAD_OPTIONS}
                {...dropdownProps}
                {...form.getInputProps('targetCostPerLead')}
              />
            </SimpleGrid>
          </Card>

          <Card withBorder p="lg" radius="lg">
            <Group mb="md">
              <IconShieldCheck size={20} />
              <Title order={4}>Signals and safety</Title>
            </Group>
            <Stack gap="md">
              <MultiSelect
                label="What should DeepVisor watch for?"
                placeholder="Choose signals"
                description="Choose the signals you want DeepVisor to flag in your ad account."
                required
                searchable
                data={WATCH_SIGNAL_OPTIONS}
                {...dropdownProps}
                {...form.getInputProps('watchSignals')}
              />
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                <Select
                  label="How should DeepVisor recommend actions?"
                  placeholder="Choose style"
                  description="You stay in control. DeepVisor will not make changes without approval."
                  required
                  data={RECOMMENDATION_STYLE_OPTIONS}
                  {...dropdownProps}
                  {...form.getInputProps('recommendationStyle')}
                />
                <Select
                  label="How cautious should DeepVisor be?"
                  placeholder="Choose safety level"
                  description="Used to control how aggressive suggestions should be."
                  required
                  data={SAFETY_PREFERENCE_OPTIONS}
                  {...dropdownProps}
                  {...form.getInputProps('safetyPreference')}
                />
              </SimpleGrid>
            </Stack>
          </Card>
        </Stack>

        <Group justify="space-between" mt="xl">
          <Button variant="light" onClick={onPrev} type="button">
            Back
          </Button>
          <Button type="submit" loading={submitting}>
            Continue
          </Button>
        </Group>
      </form>
    </Stack>
  );
}
