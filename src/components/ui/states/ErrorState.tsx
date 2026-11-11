'use client';

import { Stack, Title, Text, Button, Group } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';

interface ErrorStateProps {
  title?: string;
  message: string;
  primaryAction?: {
    label: string;
    href: string;
  };
  secondaryAction?: {
    label: string;
    href: string;
    onClick: () => void;
  };
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  primaryAction,
  secondaryAction,
}: ErrorStateProps) {
  const router = useRouter();

  return (
    <Stack align="center" className="max-w-md mx-auto py-12 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-md border border-[var(--dv-urgent-border)] bg-[var(--dv-urgent-soft)] text-[var(--dv-urgent-text)]">
        <IconAlertTriangle size={24} />
      </div>
      
      <Title order={2}>{title}</Title>
      <Text color="dimmed" size="lg">
        {message}
      </Text>
      
      {(primaryAction || secondaryAction) && (
        <Group mt="xl">
          {primaryAction && (
            <Button onClick={() => router.push(primaryAction.href)} size="md" className="app-platform-page-action-primary">
              {primaryAction.label}
            </Button>
          )}
          
          {secondaryAction && (
            <Button 
              variant="outline" 
              onClick={secondaryAction.onClick}
              size="md"
              mih={44}
            >
              {secondaryAction.label}
            </Button>
          )}
        </Group>
      )}
    </Stack>
  );
}
