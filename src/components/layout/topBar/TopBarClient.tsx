'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import {
  ActionIcon,
  Avatar,
  Box,
  Button,
  Group,
  Indicator,
  Menu,
  Text,
  UnstyledButton,
} from '@mantine/core';
import {
  IconBell,
  IconChevronDown,
  IconLogout,
  IconPlus,
  IconSettings,
  IconUser,
} from '@tabler/icons-react';
import { BrandLockup } from '@/components/brand/Brand';
import {
  clientHandleSignOut,
  markAllNotificationsAsReadClient,
  markNotificationReadClient,
} from '@/lib/client';
import {
  formatNotificationPreviewMessage,
  type NotificationFeedItem,
} from '@/lib/shared';
import PlatformAdAccountDropdownClient from './PlatformAdAccountDropdownClient';

/* eslint-disable @typescript-eslint/no-explicit-any */
interface TopBarClientProps {
  userInfo: any;
  workspaceName?: string | null;
  platforms?: any[];
  adAccounts?: any[];
  notifications?: NotificationFeedItem[];
  unreadNotificationIds?: string[];
  initialPlatformId?: string | null;
  initialAccountId?: string | null;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export default function TopBarClient({
  userInfo,
  workspaceName = null,
  platforms = [],
  adAccounts = [],
  notifications = [],
  unreadNotificationIds = [],
  initialPlatformId,
  initialAccountId,
}: TopBarClientProps) {
  const t = useTranslations('nav');
  const intl = useLocale() === 'es' ? 'es-US' : 'en-US';
  const router = useRouter();
  const onCampaigns = (usePathname() ?? "").startsWith("/campaigns");
  const [userNotifications, setUserNotifications] =
    useState<NotificationFeedItem[]>(notifications);
  const [unreadIds, setUnreadIds] = useState<string[]>(unreadNotificationIds);

  useEffect(() => {
    setUserNotifications(notifications);
    setUnreadIds(unreadNotificationIds);
  }, [notifications, unreadNotificationIds]);

  const notificationCount = unreadIds.length;
  const fullName = `${userInfo?.first_name ?? ''} ${userInfo?.last_name ?? ''}`.trim();
  const userInitials =
    fullName
      .split(' ')
      .filter(Boolean)
      .map((name: string) => name[0])
      .join('')
      .toUpperCase() || 'DV';

  // "Now" is read once when the bar mounts, so relative times don't depend on the render clock.
  const [now] = useState(() => Date.now());
  const formatNotificationTime = (value: string) => {
    const time = Date.parse(value);
    if (!Number.isFinite(time)) return t('bell.recently');
    const seconds = (time - now) / 1000;
    if (seconds > 0 || Math.abs(seconds) < 60) return t('bell.justNow');
    const format = new Intl.RelativeTimeFormat(intl, { numeric: 'auto', style: 'narrow' });
    for (const [unit, size] of [['day', 86400], ['hour', 3600], ['minute', 60]] as const) {
      if (Math.abs(seconds) >= size) return format.format(Math.round(seconds / size), unit);
    }
    return t('bell.justNow');
  };

  const markAllRead = () => {
    setUserNotifications((current) =>
      current.map((notification) => ({ ...notification, read: true }))
    );
    setUnreadIds([]);
    // Refresh so the phone nav's unread count (rendered by the server) follows the bell.
    void markAllNotificationsAsReadClient(unreadIds).then(() => router.refresh());
  };

  const handleNotificationClick = (notification: NotificationFeedItem) => {
    if (!notification.read) {
      setUserNotifications((current) =>
        current.map((item) =>
          item.id === notification.id ? { ...item, read: true } : item
        )
      );
      setUnreadIds((current) => current.filter((id) => id !== notification.id));
      void markNotificationReadClient(notification.id).then(() => router.refresh());
    }

    if (notification.link) {
      router.push(notification.link);
    }
  };

  return (
    <div className="flex h-16 w-full items-center justify-between gap-4 px-4 lg:px-5">
      <div className="flex min-w-0 items-center gap-4">
        <Link href="/dashboard" className="shrink-0 rounded-md focus-visible:outline-none">
          <BrandLockup inverse />
        </Link>
        <span className="hidden h-6 w-px bg-[#284665] lg:block" aria-hidden="true" />
        <div className="min-w-0">
          <PlatformAdAccountDropdownClient
            platforms={platforms}
            adAccounts={adAccounts}
            initialPlatformId={initialPlatformId}
            initialAccountId={initialAccountId}
          />
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {/* Campaigns has its own context-aware create action (campaign, ad set or ad). */}
        {!onCampaigns && <Button
          leftSection={<IconPlus size={17} stroke={2.2} />}
          size="sm"
          onClick={() => router.push('/campaigns/create')}
          className="hidden sm:flex app-platform-page-action-primary"
        >
          {t('newCampaign')}
        </Button>}

        <Menu shadow="md" width={380} position="bottom-end">
          <Menu.Target>
            <Indicator
              disabled={notificationCount === 0}
              label={notificationCount > 9 ? '9+' : notificationCount}
              size={17}
              color="red"
              styles={{ indicator: { border: '2px solid #07182d', fontWeight: 800 } }}
            >
              <ActionIcon
                size={38}
                variant="subtle"
                aria-label={t('bell.open')}
                styles={{
                  root: {
                    color: '#d4d8dd',
                    background: '#102f50',
                    border: '1px solid #284665',
                  },
                }}
              >
                <IconBell size={19} stroke={1.9} />
              </ActionIcon>
            </Indicator>
          </Menu.Target>

          <Menu.Dropdown
            style={{
              width: 'min(92vw, 380px)',
              maxHeight: 'min(72vh, 440px)',
              overflow: 'hidden',
            }}
          >
            <Group justify="space-between" px="sm" py={8}>
              <div>
                <Text fw={800} size="md">{t('bell.title')}</Text>
                <Text size="sm" c="dimmed">{t('bell.subtitle')}</Text>
              </div>
              {notificationCount > 0 ? (
                <Button variant="subtle" size="compact-md" onClick={markAllRead}>
                  {t('bell.markRead')}
                </Button>
              ) : null}
            </Group>
            <Menu.Divider />

            {userNotifications.length > 0 ? (
              <>
                <Box px={6} pb={6} mah="min(46vh, 290px)" style={{ overflowY: 'auto' }}>
                  {userNotifications.map((notification) => (
                    <Menu.Item
                      key={notification.id}
                      className={notification.read ? 'opacity-65' : ''}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="w-full py-0.5">
                        <Group justify="space-between" align="flex-start" gap="sm" wrap="nowrap">
                          <Text size="md" fw={800} lineClamp={1} style={{ flex: 1, minWidth: 0 }}>
                            {notification.title}
                          </Text>
                          <Text size="sm" c="dimmed" style={{ flexShrink: 0 }}>
                            {formatNotificationTime(notification.created_at)}
                          </Text>
                        </Group>
                        <Text size="sm" c="dimmed" lineClamp={2} mt={3} title={notification.message}>
                          {formatNotificationPreviewMessage(notification.message)}
                        </Text>
                      </div>
                    </Menu.Item>
                  ))}
                </Box>
                <Menu.Divider />
                <Menu.Item onClick={() => router.push('/notifications')}>
                  <Text size="sm" fw={700} ta="center" c="signal.8">
                    {t('bell.viewAll')}
                  </Text>
                </Menu.Item>
              </>
            ) : (
              <Box p="lg" ta="center">
                <Text fw={700} size="md">{t('bell.caughtUp')}</Text>
                <Text size="sm" c="dimmed" mt={3}>{t('bell.caughtUpHint')}</Text>
              </Box>
            )}
          </Menu.Dropdown>
        </Menu>

        <Menu shadow="md" width={230} position="bottom-end">
          <Menu.Target>
            <UnstyledButton
              className="rounded-md border border-[#284665] bg-[#102f50] px-1.5 py-1 transition-colors hover:border-[#4d5662]"
              aria-label={t('openAccountMenu')}
            >
              <Group gap={8} wrap="nowrap">
                <Avatar
                  radius="sm"
                  size={28}
                  styles={{
                    root: {
                      color: '#082d56',
                      background: '#bdceff',
                      border: '1px solid #bdceff',
                      fontSize: 11,
                      fontWeight: 850,
                    },
                  }}
                >
                  {userInitials}
                </Avatar>
                <div className="hidden max-w-36 min-w-0 lg:block">
                  <Text size="sm" fw={800} c="white" lineClamp={1}>
                    {fullName || t('account')}
                  </Text>
                  <Text size="xs" c="#b0c4da" lineClamp={1}>
                    {workspaceName || 'Workspace'}
                  </Text>
                </div>
                <IconChevronDown size={15} color="#b0c4da" className="hidden lg:block" />
              </Group>
            </UnstyledButton>
          </Menu.Target>

          <Menu.Dropdown>
            <Menu.Label>{fullName || t('account')}</Menu.Label>
            <Menu.Item leftSection={<IconUser size={16} />} onClick={() => router.push('/settings#profile')}>
              {t('profile')}
            </Menu.Item>
            <Menu.Item leftSection={<IconSettings size={16} />} onClick={() => router.push('/settings')}>
              {t('settings')}
            </Menu.Item>
            <Menu.Divider />
            <Menu.Item color="red" leftSection={<IconLogout size={16} />} onClick={clientHandleSignOut}>
              {t('logOut')}
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </div>
    </div>
  );
}
