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
        <Title order={2} ta="center">Your intelligence profile is ready</Title>
        <Text size="lg" c="dimmed" ta="center" className="max-w-xl mx-auto">
          Your business context is saved. Next, connect your ad platform from Integrations so DeepVisor can start syncing live account data.
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
          <List.Item>Open Integrations to connect Meta or another ad platform</List.Item>
          <List.Item>Select the primary ad account you want DeepVisor to analyze first</List.Item>
          <List.Item>Return to the dashboard once sync is ready for live campaign intelligence</List.Item>
          <List.Item>Use reports and the calendar queue after data is connected and available</List.Item>
        </List>
      </Card>

      <Group>
        <Button
          size="lg"
          rightSection={<IconArrowRight size={18} />}
          onClick={onComplete}
        >
          Go to integrations
        </Button>
      </Group>
    </Stack>
  );
}
