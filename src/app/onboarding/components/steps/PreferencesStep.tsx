'use client';

import { updateBusinessProfileData } from '@/lib/server/actions/business/onboarding';
import { Button, Text, Title, Stack, Group, MultiSelect, Checkbox, Card, SimpleGrid, Divider } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconSettings, IconChartBar, IconBell } from '@tabler/icons-react';
import { useEffect, useRef, useState } from 'react';
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
  const formInitialized = useRef(false);

  // Log what we're initializing with
  /* eslint-disable */
  useEffect(() => {
    console.log("PreferencesStep initial userData:", {
      adGoals: userData.adGoals,
      preferredPlatforms: userData.preferredPlatforms,
      emailNotifications: userData.emailNotifications,
      weeklyReports: userData.weeklyReports,
      performanceAlerts: userData.performanceAlerts
    });
    formInitialized.current = true;
  }, []);

  /* eslint-enable */

  const form = useForm({
    initialValues: {
      adGoals: Array.isArray(userData.adGoals) ? userData.adGoals : [],
      preferredPlatforms: Array.isArray(userData.preferredPlatforms) ? userData.preferredPlatforms : [],
      emailNotifications: userData.emailNotifications !== false,
      weeklyReports: userData.weeklyReports !== false,
      performanceAlerts: userData.performanceAlerts !== false,
    },
    onValuesChange: (values) => {
      // Only update after form is initialized to prevent wipes
      if (formInitialized.current) {
        console.log("Updating user data in PreferencesStep:", values);
        updateUserData({
          ...userData,
          adGoals: values.adGoals,
          preferredPlatforms: values.preferredPlatforms,
          emailNotifications: values.emailNotifications,
          weeklyReports: values.weeklyReports,
          performanceAlerts: values.performanceAlerts
        });
      }
    }
  });

  const handleSubmit = async (values: typeof form.values) => {
    setSubmitting(true);
    try {
      // Log what we're about to send
      console.log("Submitting preferences:", values);

      // Update parent state
      updateUserData({
        ...userData,
        adGoals: values.adGoals,
        preferredPlatforms: values.preferredPlatforms,
        emailNotifications: values.emailNotifications,
        weeklyReports: values.weeklyReports,
        performanceAlerts: values.performanceAlerts
      });

      // Save directly to database for additional safety
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
        <Title order={2} ta="center">Customize Your Experience</Title>
        <Text size="lg" c="dimmed" ta="center" className="max-w-xl mx-auto mb-6">
          Tell us what outcomes and alerts matter most so we can prioritize the right insights.
        </Text>
      </div>

      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="xl">
          <Card withBorder p="lg" radius="md">
            <Group mb="sm">
              <IconChartBar />
              <Title order={4}>Advertising Goals</Title>
            </Group>
            <Text size="sm" c="dimmed" mb="md">
              Pick the outcomes you care about most. You can change this anytime.
            </Text>
            <MultiSelect
              label="Primary goals"
              placeholder="Select all that apply"
              description="Choose outcomes we should prioritize."
              data={[
                { value: 'brand_awareness', label: 'Brand Awareness' },
                { value: 'lead_generation', label: 'Lead Generation' },
                { value: 'website_traffic', label: 'Website Traffic' },
                { value: 'conversions', label: 'Conversions & Sales' },
                { value: 'app_installs', label: 'App Installs' },
                { value: 'engagement', label: 'Social Engagement' },
              ]}
              {...form.getInputProps('adGoals')}
            />
          </Card>

          <Card withBorder p="lg" radius="md">
            <Group mb="sm">
              <IconSettings />
              <Title order={4}>Platform Preferences</Title>
            </Group>
            <Text size="sm" c="dimmed" mb="md">
              We&apos;ll use this to prioritize channel insights and future integrations.
            </Text>
            <MultiSelect
              label="Preferred platforms"
              placeholder="Select all that apply"
              description="We will highlight insights for these channels."
              data={[
                { value: 'facebook', label: 'Facebook' },
                { value: 'instagram', label: 'Instagram' },
                { value: 'google', label: 'Google Ads' },
                { value: 'tiktok', label: 'TikTok' },
                { value: 'linkedin', label: 'LinkedIn' },
                { value: 'twitter', label: 'Twitter' },
                { value: 'youtube', label: 'YouTube' },
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
              Choose what we should notify you about. Default settings are recommended.
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
