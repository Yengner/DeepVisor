'use client';

import { Card, Stack, Text, Title } from '@mantine/core';

export default function CompanionClient() {
  return (
    <Card withBorder radius="lg" p="xl">
      <Stack gap="sm">
        <Title order={3}>Legacy calendar companion</Title>
        <Text c="dimmed">
          This legacy optimizer view is no longer part of the active product flow.
        </Text>
        <Text c="dimmed">
          Use the main `/calendar` workspace for business-scoped screening and account assessments.
        </Text>
      </Stack>
    </Card>
  );
}
