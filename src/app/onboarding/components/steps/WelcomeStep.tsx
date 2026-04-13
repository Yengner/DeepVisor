'use client';

import { Button, Text, Title, Stack, Group, ThemeIcon, Paper, SimpleGrid, Badge } from '@mantine/core';
import { IconBuildingStore, IconCalendarTime, IconChartBar, IconBell } from '@tabler/icons-react';

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
        <Badge variant="light" color="blue" display="block" w="fit-content" mx="auto" mb="sm">
          3-5 minutes
        </Badge>
        <Title order={2} ta="center">DeepVisor needs business context before data</Title>
        <Text size="lg" c="dimmed" ta="center" className="max-w-xl mx-auto">
          We&apos;ll ask what you sell, what outcomes matter, and which platforms you use. After onboarding, we&apos;ll send you to Integrations to connect ad platforms there.
        </Text>
      </div>

      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md" className="my-4">
        <Paper withBorder p="md" radius="md">
          <Group>
            <ThemeIcon color="blue" size="lg" radius="xl">
              <IconBuildingStore size={20} />
            </ThemeIcon>
            <div>
              <Text fw={600}>Business context</Text>
              <Text c="dimmed" size="sm">Industry, offer, budget</Text>
            </div>
          </Group>
        </Paper>
        <Paper withBorder p="md" radius="md">
          <Group>
            <ThemeIcon color="green" size="lg" radius="xl">
              <IconChartBar size={20} />
            </ThemeIcon>
            <div>
              <Text fw={600}>Decision priorities</Text>
              <Text c="dimmed" size="sm">Goals, platforms, reports</Text>
            </div>
          </Group>
        </Paper>
        <Paper withBorder p="md" radius="md">
          <Group>
            <ThemeIcon color="violet" size="lg" radius="xl">
              <IconBell size={20} />
            </ThemeIcon>
            <div>
              <Text fw={600}>Operator preferences</Text>
              <Text c="dimmed" size="sm">Alerts, reports, priorities</Text>
            </div>
          </Group>
        </Paper>
      </SimpleGrid>

      <Paper withBorder radius="md" p="md" bg="gray.0">
        <Group align="flex-start" gap="sm">
          <ThemeIcon color="yellow" variant="light" radius="xl">
            <IconCalendarTime size={18} />
          </ThemeIcon>
          <div>
            <Text fw={700}>Why this comes first</Text>
            <Text size="sm" c="dimmed" mt={4}>
              DeepVisor&apos;s recommendations need the owner&apos;s definition of success. Platform data tells us what happened; onboarding tells us what matters.
            </Text>
          </div>
        </Group>
      </Paper>

      <Button size="lg" fullWidth onClick={onNext}>
        Start setup
      </Button>
    </Stack>
  );
}
