'use client';

import { Button, Text, Title, Stack, ThemeIcon, List, Card, Group } from '@mantine/core';
import { IconCheck, IconArrowRight, IconZoomCheck } from '@tabler/icons-react';

type CompletionStepProps = {
  onComplete: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  userData: any;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function CompletionStep({ onComplete, userData: _userData }: CompletionStepProps) {
  return (
    <Stack gap="xl" py={16} align="center">
      <ThemeIcon size={80} radius="xl" color="green">
        <IconZoomCheck size={40} />
      </ThemeIcon>

      <div>
        <Title order={2} ta="center">You&apos;re all set</Title>
        <Text size="lg" c="dimmed" ta="center" className="max-w-xl mx-auto">
          Your DeepVisor account is configured. Here&apos;s what you can do next.
        </Text>
      </div>

      <Card withBorder p="xl" radius="md" className="w-full max-w-lg">
        <List
          spacing="md"
          size="md"
          icon={
            <ThemeIcon color="green" size={24} radius="xl">
              <IconCheck size={16} />
            </ThemeIcon>
          }
        >
          <List.Item>View performance across connected platforms</List.Item>
          <List.Item>Monitor guardrails and key KPIs</List.Item>
          <List.Item>Review AI recommendations with confidence</List.Item>
          <List.Item>Set up reports and alerting</List.Item>
        </List>
      </Card>

      <Group>
        <Button
          size="lg"
          rightSection={<IconArrowRight size={18} />}
          onClick={onComplete}
        >
          Go to Dashboard
        </Button>
      </Group>
    </Stack>
  );
}
