import { Group, Text } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';

interface ErrorToastProps {
  title?: string;
  message: string;
}

export function ErrorToast({ title = 'Error', message }: ErrorToastProps) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-md p-4 shadow-md">
      <Group>
        <div className="bg-red-100 rounded-full p-1">
          <IconAlertCircle size={20} className="text-red-600" />
        </div>
        <div>
          <Text fw={600}>{title}</Text>
          <Text size="sm" c="dimmed">{message}</Text>
        </div>
      </Group>
    </div>
  );
}