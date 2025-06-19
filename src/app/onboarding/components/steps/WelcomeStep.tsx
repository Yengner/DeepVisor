'use client';

import { Button, Text, Title, Stack, Group, ThemeIcon } from '@mantine/core';
import { IconBrandFacebook, IconBuildingStore, IconChartBar } from '@tabler/icons-react';

type WelcomeStepProps = {
  onNext: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  userData: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateUserData: (data: any) => void;
};

export default function WelcomeStep({ onNext }: WelcomeStepProps) {
  return (
    <Stack gap="xl" py={20}>
      <Title order={2} ta="center">Let&apos;s get your account set up</Title>

      <Text size="lg" c="dimmed" ta="center" className="max-w-xl mx-auto">
        Complete this short onboarding process to get the most out of DeepVisor.
        We&apos;ll help you connect your ad accounts and set up your preferences.
      </Text>

      <Stack gap="md" className="my-8">
        <Group>
          <ThemeIcon color="blue" size="lg" radius="xl">
            <IconBrandFacebook size={20} />
          </ThemeIcon>
          <div>
            <Text fw={600}>Connect your advertising accounts</Text>
            <Text c="dimmed" size="sm">Link your Meta, Google, and other platforms</Text>
          </div>
        </Group>

        <Group>
          <ThemeIcon color="green" size="lg" radius="xl">
            <IconBuildingStore size={20} />
          </ThemeIcon>
          <div>
            <Text fw={600}>Set up your business profile</Text>
            <Text c="dimmed" size="sm">Tell us about your business to personalize your experience</Text>
          </div>
        </Group>

        <Group>
          <ThemeIcon color="violet" size="lg" radius="xl">
            <IconChartBar size={20} />
          </ThemeIcon>
          <div>
            <Text fw={600}>Customize your dashboard</Text>
            <Text c="dimmed" size="sm">Choose what metrics and data matter most to you</Text>
          </div>
        </Group>
      </Stack>

      <Button
        size="lg"
        fullWidth
        onClick={onNext}
      >
        Let&apos;s Get Started
      </Button>
    </Stack>
  );
}