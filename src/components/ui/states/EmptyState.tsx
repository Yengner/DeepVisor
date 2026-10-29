import { Stack, Title, Text, Button } from '@mantine/core';
import { IconInbox } from '@tabler/icons-react';

interface EmptyStateProps {
  title?: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  title = 'No items found',
  message,
  actionLabel,
  onAction
}: EmptyStateProps) {
  return (
    <Stack align="center" className="mx-auto max-w-lg border-y border-[#d9e3ef] py-14 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-md border border-[#b8c9dd] bg-white text-[#53677d]">
        <IconInbox size={22} />
      </span>
      <Title order={3}>{title}</Title>
      <Text c="dimmed" size="md" className="max-w-md">
        {message}
      </Text>
      
      {actionLabel && onAction && (
        <Button onClick={onAction} mt="md">
          {actionLabel}
        </Button>
      )}
    </Stack>
  );
}
