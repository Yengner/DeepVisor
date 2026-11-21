'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
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
  const t = useTranslations('notificationsPage');
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
        showError(t('markFailed'));
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
      variant="default"
      size="md"
      loading={loading}
      className={className}
      rightSection={href ? <IconArrowRight size={16} /> : <IconCheck size={16} />}
      onClick={() => void handleClick()}
    >
      {href ? t('open') : t('markRead')}
    </Button>
  );
}
