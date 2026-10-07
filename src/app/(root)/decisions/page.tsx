import type { Metadata } from 'next';
import { Container, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { IconChecklist } from '@tabler/icons-react';

export const metadata: Metadata = { title: 'Decisions | DeepVisor' };

export default function DecisionsPage() {
  return (
    <Container size="xl" px="md" py="lg">
      <Stack gap="xl">
        <Title order={1}>Decisions</Title>
        <Stack align="center" ta="center" py="xl" gap="sm">
          <ThemeIcon size={48} radius="md" variant="light" color="signal">
            <IconChecklist size={24} />
          </ThemeIcon>
          <Title order={2} size="h3">Your next steps will appear here</Title>
          <Text c="dimmed" size="sm" maw={420}>
            DeepVisor decisions for your campaigns will appear here when available.
          </Text>
        </Stack>
      </Stack>
    </Container>
  );
}
