'use client';

import { updateBusinessProfileData } from '@/lib/server/actions/business/onboarding';
import { Button, Text, Title, Stack, Group, MultiSelect, Checkbox, Card, SimpleGrid, Divider } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconSettings, IconChartBar, IconBell } from '@tabler/icons-react';
import { useState } from 'react';
import toast from 'react-hot-toast';

type PreferencesStepProps = {
  onNext: () => void;
  onPrev: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  userData: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateUserData: (data: any) => void;
};

export default function PreferencesStep({
  onNext,
  onPrev,
  userData,
  updateUserData
}: PreferencesStepProps) {
  const [submitting, setSubmitting] = useState(false);

  const form = useForm({
    initialValues: {
      adGoals: Array.isArray(userData.adGoals) ? userData.adGoals : [],
      preferredPlatforms: Array.isArray(userData.preferredPlatforms) ? userData.preferredPlatforms : [],
      emailNotifications: userData.emailNotifications !== false,
      weeklyReports: userData.weeklyReports !== false,
      performanceAlerts: userData.performanceAlerts !== false,
    },
    validate: {
      adGoals: (value) => value.length === 0 ? 'Choose at least one business goal' : null,
      preferredPlatforms: (value) => value.length === 0 ? 'Choose at least one platform you use or plan to use' : null,
    },
    onValuesChange: (values) => {
      updateUserData({
        ...userData,
        adGoals: values.adGoals,
        preferredPlatforms: values.preferredPlatforms,
        emailNotifications: values.emailNotifications,
        weeklyReports: values.weeklyReports,
        performanceAlerts: values.performanceAlerts
      });
    }
  });

  const handleSubmit = async (values: typeof form.values) => {
    setSubmitting(true);
    try {
      updateUserData({
        ...userData,
        adGoals: values.adGoals,
        preferredPlatforms: values.preferredPlatforms,
        emailNotifications: values.emailNotifications,
        weeklyReports: values.weeklyReports,
        performanceAlerts: values.performanceAlerts
      });

      const saveRes = await updateBusinessProfileData({
        adGoals: values.adGoals,
        preferredPlatforms: values.preferredPlatforms,
      });
      if (!saveRes.success) {
        toast.error(saveRes.error.userMessage);
        return;
      }

      // Proceed to next step
      onNext();
    } catch (error) {
      console.error('Error saving preferences:', error);
      toast.error('Failed to save your preferences');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Stack gap="xl" py={16}>
      <div>
        <Title order={2} ta="center">Define what DeepVisor should optimize for</Title>
        <Text size="lg" c="dimmed" ta="center" className="max-w-xl mx-auto mb-6">
          Platform metrics are only useful when we know the business goal. These answers help shape reports, calendar recommendations, and future account intelligence.
        </Text>
      </div>

      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="xl">
          <Card withBorder p="lg" radius="md">
            <Group mb="sm">
              <IconChartBar />
              <Title order={4}>Primary business outcomes</Title>
            </Group>
            <Text size="sm" c="dimmed" mb="md">
              Pick the outcomes that should make a recommendation feel useful. You can change this later.
            </Text>
            <MultiSelect
              label="What should ads help you do?"
              placeholder="Select all that apply"
              description="Choose outcomes we should prioritize."
              required
              data={[
                { value: 'brand_awareness', label: 'Brand Awareness' },
                { value: 'lead_generation', label: 'Lead Generation' },
                { value: 'website_traffic', label: 'Website Traffic' },
                { value: 'conversions', label: 'Conversions & Sales' },
                { value: 'bookings', label: 'Bookings / Appointments' },
                { value: 'phone_calls', label: 'Phone Calls' },
                { value: 'app_installs', label: 'App Installs' },
                { value: 'engagement', label: 'Social Engagement' },
              ]}
              {...form.getInputProps('adGoals')}
            />
          </Card>

          <Card withBorder p="lg" radius="md">
            <Group mb="sm">
              <IconSettings />
              <Title order={4}>Ad platforms</Title>
            </Group>
            <Text size="sm" c="dimmed" mb="md">
              Tell us where you currently advertise or where you expect to advertise next.
            </Text>
            <MultiSelect
              label="Platforms to include in your intelligence profile"
              placeholder="Select all that apply"
              description="Integration is optional. This only sets product context."
              required
              data={[
                { value: 'meta', label: 'Meta / Facebook / Instagram' },
                { value: 'google', label: 'Google Ads / YouTube' },
                { value: 'tiktok', label: 'TikTok Ads' },
                { value: 'linkedin', label: 'LinkedIn Ads' },
                { value: 'microsoft', label: 'Microsoft Advertising' },
                { value: 'amazon', label: 'Amazon Ads' },
                { value: 'not_running_ads_yet', label: 'Not running ads yet' },
              ]}
              {...form.getInputProps('preferredPlatforms')}
            />
          </Card>

          <Card withBorder p="lg" radius="md">
            <Group mb="sm">
              <IconBell />
              <Title order={4}>Notifications</Title>
            </Group>
            <Text size="sm" c="dimmed" mb="md">
              These are local setup preferences for now. A dedicated notification settings table should store them later.
            </Text>
            <SimpleGrid cols={1} spacing="sm">
              <Checkbox
                label="Email notifications for important updates"
                description="Recommended if you want urgent alerts."
                {...form.getInputProps('emailNotifications', { type: 'checkbox' })}
              />
              <Checkbox
                label="Weekly performance reports"
                description="A weekly summary with key wins and risks."
                {...form.getInputProps('weeklyReports', { type: 'checkbox' })}
              />
              <Checkbox
                label="Alert me about significant performance changes"
                description="Realtime alerts when guardrails are triggered."
                {...form.getInputProps('performanceAlerts', { type: 'checkbox' })}
              />
            </SimpleGrid>
          </Card>
        </Stack>

        <Divider my="xl" />

        <Group justify="apart">
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
