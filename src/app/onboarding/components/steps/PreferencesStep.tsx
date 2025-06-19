'use client';

import { Button, Text, Title, Stack, Group, MultiSelect, Checkbox, Card, SimpleGrid, Radio, RadioGroup } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconSettings, IconChartBar } from '@tabler/icons-react';

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
  const form = useForm({
    initialValues: {
      adGoals: userData.adGoals || [],
      preferredPlatforms: userData.preferredPlatforms || [],
      dashboardView: userData.dashboardView || 'campaign',
      emailNotifications: userData.emailNotifications !== false,
      weeklyReports: userData.weeklyReports !== false,
      performanceAlerts: userData.performanceAlerts !== false,
    }
  });

  const handleSubmit = (values: typeof form.values) => {
    updateUserData(values);
    onNext();
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

            <Stack gap="md">
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

              <RadioGroup
                label="Default dashboard view"
                {...form.getInputProps('dashboardView')}
              >
                <Radio value="campaign" label="Campaign-focused" />
                <Radio value="platform" label="Platform-focused" />
                <Radio value="conversion" label="Conversion-focused" />
              </RadioGroup>
            </Stack>
          </Card>

          <Card withBorder p="md">
            <Title order={4} className="mb-4">Notifications</Title>

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
          <Button type="submit">
            Continue
          </Button>
        </Group>
      </form>
    </Stack>
  );
}