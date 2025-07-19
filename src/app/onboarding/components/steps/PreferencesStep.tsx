'use client';

import { updateBusinessProfileData } from '@/lib/actions/user/user.actions';
import { Button, Text, Title, Stack, Group, MultiSelect, Checkbox, Card, SimpleGrid } from '@mantine/core';
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

  const form = useForm({
    initialValues: {
      adGoals: userData.adGoals || [],
      preferredPlatforms: userData.preferredPlatforms || [],
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
      await updateBusinessProfileData({
        adGoals: values.adGoals,
        preferredPlatforms: values.preferredPlatforms,
        emailNotifications: values.emailNotifications,
        weeklyReports: values.weeklyReports,
        performanceAlerts: values.performanceAlerts
      });

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
    <Stack gap="xl" py={20}>
      <Title order={2} ta="center">Customize Your Experience</Title>

      <Text size="lg" c="dimmed" ta="center" className="max-w-xl mx-auto mb-6">
        Set your preferences to make DeepVisor work best for you
      </Text>

      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="xl">
          <Card withBorder p="md">
            <Title order={4} className="mb-4">
              <Group>
                <IconChartBar />
                <span>Advertising Goals</span>
              </Group>
            </Title>

            <MultiSelect
              label="What are your main advertising goals?"
              placeholder="Select all that apply"
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

          <Card withBorder p="md">
            <Title order={4} className="mb-4">
              <Group>
                <IconSettings />
                <span>Platform Preferences</span>
              </Group>
            </Title>

            <MultiSelect
              label="Which platforms do you prefer to advertise on?"
              placeholder="Select all that apply"
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

          <Card withBorder p="md">
            <Title order={4} className="mb-4">
              <Group>
                <IconBell />
                <span>Notifications</span>
              </Group>
            </Title>

            <SimpleGrid cols={1}>
              <Checkbox
                label="Email notifications for important updates"
                {...form.getInputProps('emailNotifications', { type: 'checkbox' })}
              />
              <Checkbox
                label="Weekly performance reports"
                {...form.getInputProps('weeklyReports', { type: 'checkbox' })}
              />
              <Checkbox
                label="Alert me about significant performance changes"
                {...form.getInputProps('performanceAlerts', { type: 'checkbox' })}
              />
            </SimpleGrid>
          </Card>
        </Stack>

        <Group justify="apart" mt="xl">
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