'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@mantine/core';
import { IconArrowRight, IconCheck } from '@tabler/icons-react';
import { markNotificationReadClient, showError } from '@/lib/client';

type NotificationActionProps = {
  notificationId: string;
  unread: boolean;
  href: string | null;
  className?: string;
};

export default function NotificationAction({
  notificationId,
  unread,
  href,
  className,
}: NotificationActionProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  if (!unread && !href) {
    return null;
  }

  const handleClick = async () => {
    setLoading(true);

    if (unread) {
      const marked = await markNotificationReadClient(notificationId);
      if (!marked) {
        showError('The notification could not be marked as read.');
      }
    }

    if (href) {
      router.push(href);
      return;
    }

    router.refresh();
    setLoading(false);
  };

  return (
    <Button
      variant="light"
      size="xs"
      loading={loading}
      className={className}
      rightSection={href ? <IconArrowRight size={14} /> : <IconCheck size={14} />}
      onClick={() => void handleClick()}
    >
      {href ? 'Open' : 'Mark read'}
    </Button>
  );
}
