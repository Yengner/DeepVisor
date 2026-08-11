import { Center, Loader, Text, Stack } from '@mantine/core';

interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message = 'Loading...' }: LoadingStateProps) {
  return (
    <Center className="min-h-[300px]">
      <Stack align="center" gap="sm">
        <Loader size="sm" color="signal" />
        <Text c="dimmed" size="sm" fw={650}>{message}</Text>
      </Stack>
    </Center>
  );
}
