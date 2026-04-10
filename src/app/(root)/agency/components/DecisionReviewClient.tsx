'use client';

import { Button, Card, Group, Stack, Text, Title } from '@mantine/core';
import { useRouter } from 'next/navigation';

export default function DecisionReviewClient() {
  const router = useRouter();

  return (
    <Card withBorder radius="lg" p="xl">
      <Stack gap="sm">
        <Title order={3}>Legacy decision review</Title>
        <Text c="dimmed">
          The old optimizer decision flow has been retired from the business-only product.
        </Text>
        <Text c="dimmed">
          Review and approve recommendations from the main Calendar workspace instead.
        </Text>
        <Group>
          <Button onClick={() => router.push('/calendar')}>Go to Calendar</Button>
        </Group>
      </Stack>
    </Card>
  );
}
