import { Stack, Title, Text, Button, Group } from '@mantine/core';
import { IconCheck } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';

interface SuccessStateProps {
  title?: string;
  message: string;
  primaryAction?: {
    label: string;
    href: string;
  };
  secondaryAction?: {
    label: string;
    href: string;
  };
}

export function SuccessState({
  title = 'Success!',
  message,
  primaryAction,
  secondaryAction,
}: SuccessStateProps) {
  const router = useRouter();

  return (
    <Stack align="center" className="max-w-md mx-auto py-12 text-center">
      <div className="bg-green-100 rounded-full p-5 w-20 h-20 flex items-center justify-center mb-4">
        <IconCheck size={40} className="text-green-600" />
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
              onClick={() => router.push(secondaryAction.href)}
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