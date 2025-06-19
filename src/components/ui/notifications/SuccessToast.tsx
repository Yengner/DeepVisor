import { Group, Text } from '@mantine/core';
import { IconCheck } from '@tabler/icons-react';

interface SuccessToastProps {
  title?: string;
  message: string;
}

export function SuccessToast({ title = 'Success', message }: SuccessToastProps) {
  return (
    <div className="bg-green-50 border border-green-200 rounded-md p-4 shadow-md">
      <Group>
        <div className="bg-green-100 rounded-full p-1">
          <IconCheck size={20} className="text-green-600" />
        </div>
        <div>
          <Text fw={600}>{title}</Text>
          <Text size="sm" c="dimmed">{message}</Text>
        </div>
      </Group>
    </div>
  );
}