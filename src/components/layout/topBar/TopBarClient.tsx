'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
  formatRelativeTime,
  type NotificationFeedItem,
} from '@/lib/shared';
import PlatformAdAccountDropdownClient from './PlatformAdAccountDropdownClient';

/* eslint-disable @typescript-eslint/no-explicit-any */
interface TopBarClientProps {
  userInfo: any;
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
  platforms = [],
  adAccounts = [],
  notifications = [],
  unreadNotificationIds = [],
  initialPlatformId,
  initialAccountId,
}: TopBarClientProps) {
  const router = useRouter();
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

  const formatNotificationTime = (value: string) =>
    formatRelativeTime(value, {
      emptyLabel: 'Recently',
      futureLabel: 'Just now',
      includeSeconds: true,
    });

  const markAllRead = () => {
    setUserNotifications((current) =>
      current.map((notification) => ({ ...notification, read: true }))
    );
    setUnreadIds([]);
    void markAllNotificationsAsReadClient(unreadIds);
  };

  const handleNotificationClick = (notification: NotificationFeedItem) => {
    if (!notification.read) {
      setUserNotifications((current) =>
        current.map((item) =>
          item.id === notification.id ? { ...item, read: true } : item
        )
      );
      setUnreadIds((current) => current.filter((id) => id !== notification.id));
      void markNotificationReadClient(notification.id);
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
        <span className="hidden h-6 w-px bg-[#343a33] lg:block" aria-hidden="true" />
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
        <Button
          leftSection={<IconPlus size={17} stroke={2.2} />}
          size="sm"
          onClick={() => router.push('/campaigns/create')}
          className="hidden sm:flex"
          styles={{
            root: {
              color: '#151714',
              background: '#c8ff56',
              border: '1px solid #d7ff8a',
            },
          }}
        >
          New campaign
        </Button>

        <Menu shadow="md" width={380} position="bottom-end">
          <Menu.Target>
            <Indicator
              disabled={notificationCount === 0}
              label={notificationCount > 9 ? '9+' : notificationCount}
              size={17}
              color="red"
              styles={{ indicator: { border: '2px solid #0d0f0d', fontWeight: 800 } }}
            >
              <ActionIcon
                size={38}
                variant="subtle"
                aria-label="Open notifications"
                styles={{
                  root: {
                    color: '#d7ddd4',
                    background: '#20241f',
                    border: '1px solid #343a33',
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
                <Text fw={800} size="sm">Notifications</Text>
                <Text size="xs" c="dimmed">Recent workspace signals</Text>
              </div>
              {notificationCount > 0 ? (
                <Button variant="subtle" size="compact-xs" onClick={markAllRead}>
                  Mark read
                </Button>
              ) : null}
            </Group>
            <Menu.Divider />

            {userNotifications.length > 0 ? (
              <>
                <Box px={6} pb={6} mah="54vh" style={{ overflowY: 'auto' }}>
                  {userNotifications.map((notification) => (
                    <Menu.Item
                      key={notification.id}
                      className={notification.read ? 'opacity-65' : ''}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="w-full py-0.5">
                        <Group justify="space-between" align="flex-start" gap="sm" wrap="nowrap">
                          <Text size="sm" fw={750} lineClamp={1} style={{ flex: 1, minWidth: 0 }}>
                            {notification.title}
                          </Text>
                          <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
                            {formatNotificationTime(notification.created_at)}
                          </Text>
                        </Group>
                        <Text size="xs" c="dimmed" lineClamp={2} mt={3} title={notification.message}>
                          {formatNotificationPreviewMessage(notification.message)}
                        </Text>
                      </div>
                    </Menu.Item>
                  ))}
                </Box>
                <Menu.Divider />
                <Menu.Item onClick={() => router.push('/notifications')}>
                  <Text size="sm" fw={700} ta="center" c="signal.8">
                    View notification center
                  </Text>
                </Menu.Item>
              </>
            ) : (
              <Box p="lg" ta="center">
                <Text fw={700} size="sm">You are caught up</Text>
                <Text size="xs" c="dimmed" mt={3}>New account signals will appear here.</Text>
              </Box>
            )}
          </Menu.Dropdown>
        </Menu>

        <Menu shadow="md" width={230} position="bottom-end">
          <Menu.Target>
            <UnstyledButton
              className="rounded-md border border-[#343a33] bg-[#20241f] px-1.5 py-1 transition-colors hover:border-[#555d52]"
              aria-label="Open account menu"
            >
              <Group gap={8} wrap="nowrap">
                <Avatar
                  radius="sm"
                  size={28}
                  styles={{
                    root: {
                      color: '#151714',
                      background: '#c8ff56',
                      border: '1px solid #d7ff8a',
                      fontSize: 11,
                      fontWeight: 850,
                    },
                  }}
                >
                  {userInitials}
                </Avatar>
                <div className="hidden max-w-36 min-w-0 lg:block">
                  <Text size="xs" fw={750} c="white" lineClamp={1}>
                    {fullName || 'Account'}
                  </Text>
                  <Text size="10px" c="#a6ada3" lineClamp={1}>
                    {userInfo?.business_name || 'Workspace'}
                  </Text>
                </div>
                <IconChevronDown size={15} color="#a6ada3" className="hidden lg:block" />
              </Group>
            </UnstyledButton>
          </Menu.Target>

          <Menu.Dropdown>
            <Menu.Label>{fullName || 'Account'}</Menu.Label>
            <Menu.Item leftSection={<IconUser size={16} />} onClick={() => router.push('/settings/profile')}>
              Profile
            </Menu.Item>
            <Menu.Item leftSection={<IconSettings size={16} />} onClick={() => router.push('/settings')}>
              Settings
            </Menu.Item>
            <Menu.Divider />
            <Menu.Item color="red" leftSection={<IconLogout size={16} />} onClick={clientHandleSignOut}>
              Log out
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </div>
    </div>
  );
}
