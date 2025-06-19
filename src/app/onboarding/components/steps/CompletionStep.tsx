'use client';

import { Button, Text, Title, Stack, ThemeIcon, List, Card } from '@mantine/core';
import { IconCheck, IconArrowRight, IconZoomCheck } from '@tabler/icons-react';

type CompletionStepProps = {
  onComplete: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  userData: any;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function CompletionStep({ onComplete, userData }: CompletionStepProps) {
  return (
    <Stack gap="xl" py={20} align="center">
      <ThemeIcon size={80} radius="xl" color="green">
        <IconZoomCheck size={40} />
      </ThemeIcon>

      <Title order={2} ta="center">You&apos;re All Set!</Title>

      <Text size="lg" c="dimmed" ta="center" className="max-w-xl mx-auto">
        Your DeepVisor account is now fully configured. Here&apos;s what you can do next:
      </Text>

      <Card withBorder p="xl" radius="md" className="w-full max-w-lg">
        <List
          spacing="md"
          size="lg"
          center
          icon={
            <ThemeIcon color="green" size={24} radius="xl">
              <IconCheck size={16} />
            </ThemeIcon>
          }
        >
          <List.Item>View your advertising performance across platforms</List.Item>
          <List.Item>Analyze campaign effectiveness and ROI</List.Item>
          <List.Item>Get AI-powered recommendations to improve results</List.Item>
          <List.Item>Set up custom reports and alerts</List.Item>
        </List>
      </Card>

      <Button
        size="lg"
        rightSection={<IconArrowRight size={18} />}
        onClick={onComplete}
        mt="xl"
      >
        Go to Dashboard
      </Button>
    </Stack>
  );
}