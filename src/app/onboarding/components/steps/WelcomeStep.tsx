'use client';

import { Button, Text, Title, Stack, Group, ThemeIcon, Paper, SimpleGrid } from '@mantine/core';
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
    <Stack gap="xl" py={16}>
      <div>
        <Title order={2} ta="center">Let&apos;s get your account set up</Title>
        <Text size="lg" c="dimmed" ta="center" className="max-w-xl mx-auto">
          A short, guided setup so we can personalize your dashboard and automation.
        </Text>
      </div>

      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md" className="my-4">
        <Paper withBorder p="md" radius="md">
          <Group>
            <ThemeIcon color="blue" size="lg" radius="xl">
              <IconBrandFacebook size={20} />
            </ThemeIcon>
            <div>
              <Text fw={600}>Connect platforms</Text>
              <Text c="dimmed" size="sm">Meta first, more later</Text>
            </div>
          </Group>
        </Paper>
        <Paper withBorder p="md" radius="md">
          <Group>
            <ThemeIcon color="green" size="lg" radius="xl">
              <IconBuildingStore size={20} />
            </ThemeIcon>
            <div>
              <Text fw={600}>Business profile</Text>
              <Text c="dimmed" size="sm">Tell us about your team</Text>
            </div>
          </Group>
        </Paper>
        <Paper withBorder p="md" radius="md">
          <Group>
            <ThemeIcon color="violet" size="lg" radius="xl">
              <IconChartBar size={20} />
            </ThemeIcon>
            <div>
              <Text fw={600}>Preferences</Text>
              <Text c="dimmed" size="sm">Pick goals and alerts</Text>
            </div>
          </Group>
        </Paper>
      </SimpleGrid>

      <Button size="lg" fullWidth onClick={onNext}>
        Let&apos;s Get Started
      </Button>
    </Stack>
  );
}
