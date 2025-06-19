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
    <Stack align="center" className="py-16 text-center">
      <IconInbox size={48} className="text-gray-400" />
      <Title order={3}>{title}</Title>
      <Text color="dimmed" size="lg" className="max-w-md">
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