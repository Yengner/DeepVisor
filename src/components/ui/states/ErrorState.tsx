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
      <div className="bg-red-100 rounded-full p-5 w-20 h-20 flex items-center justify-center mb-4">
        <IconAlertTriangle size={40} className="text-red-600" />
      </div>
      
      <Title order={2}>{title}</Title>
      <Text color="dimmed" size="lg">
        {message}
      </Text>
      
      {(primaryAction || secondaryAction) && (
        <Group mt="xl">
          {primaryAction && (
            <Button onClick={() => router.push(primaryAction.href)} size="md">
              {primaryAction.label}
            </Button>
          )}
          
          {secondaryAction && (
            <Button 
              variant="outline" 
              onClick={secondaryAction.onClick}
              size="md"
            >
              {secondaryAction.label}
            </Button>
          )}
        </Group>
      )}
    </Stack>
  );
}