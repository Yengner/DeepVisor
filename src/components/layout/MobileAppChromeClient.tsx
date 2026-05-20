'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  ActionIcon,
  Avatar,
  Box,
  Burger,
  Button,
  Divider,
  Drawer,
  Group,
  Indicator,
  Menu,
  NavLink,
  Portal,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
} from '@mantine/core';
import {
  IconBell,
  IconLayersIntersect,
  IconLogout,
  IconPlus,
  IconSearch,
  IconSettings,
  IconTable,
} from '@tabler/icons-react';
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
import {
  isAppNavItemActive,
  mobileBottomNavItems,
  primaryNavItems,
  secondaryNavItems,
} from './navigation';
import PlatformAdAccountDropdownClient from './topBar/PlatformAdAccountDropdownClient';

type MobileAppChromeClientProps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  userInfo: any;
  platforms?: Array<{ id: string; platform_name: string }>;
  adAccounts?: Array<{
    id: string;
    name: string | null;
    platform_integration_id: string;
    external_account_id: string | null;
  }>;
  notifications?: NotificationFeedItem[];
  initialPlatformId?: string | null;
  initialAccountId?: string | null;
};

function formatNotificationTime(value: string) {
  return formatRelativeTime(value, {
    emptyLabel: 'Recently',
    futureLabel: 'Just now',
    includeSeconds: true,
  });
}

export default function MobileAppChromeClient({
  userInfo,
  platforms = [],
  adAccounts = [],
  notifications = [],
  initialPlatformId,
  initialAccountId,
}: MobileAppChromeClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [drawerOpened, setDrawerOpened] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [userNotifications, setUserNotifications] =
    useState<NotificationFeedItem[]>(notifications);
  const notificationCount = userNotifications.filter((notification) => !notification.read).length;
  const accentColor = 'var(--platform-accent)';
  const accentStrong = 'var(--platform-accent-strong)';
  const accentSoft = 'var(--platform-accent-soft)';
  const accentSoftStrong = 'var(--platform-accent-soft-strong)';
  const borderColor = 'var(--platform-border)';
  const textStrong = 'var(--platform-text-strong)';
  const fullName = `${userInfo?.first_name ?? ''} ${userInfo?.last_name ?? ''}`.trim();
  const userInitials =
    fullName
      .split(' ')
      .filter(Boolean)
      .map((name: string) => name[0])
      .join('')
      .toUpperCase() || 'DV';

  useEffect(() => {
    setUserNotifications(notifications);
  }, [notifications]);

  const navigate = (route: string) => {
    setDrawerOpened(false);
    router.push(route);
  };

  const isMobileBottomItemActive = (route: string) =>
    isAppNavItemActive(pathname, route) ||
    (route === '/settings' && Boolean(pathname?.startsWith('/integration')));

  const markAllRead = () => {
    const unreadIds = userNotifications
      .filter((notification) => !notification.read)
      .map((notification) => notification.id);

    setUserNotifications((current) =>
      current.map((notification) => ({ ...notification, read: true }))
    );
    void markAllNotificationsAsReadClient(unreadIds);
  };

  const handleNotificationClick = (notification: NotificationFeedItem) => {
    if (!notification.read) {
      setUserNotifications((current) =>
        current.map((item) =>
          item.id === notification.id ? { ...item, read: true } : item
        )
      );
      void markNotificationReadClient(notification.id);
    }

    if (notification.link) {
      router.push(notification.link);
    }
  };

  return (
    <>
      <div
        className="flex h-full w-full items-center gap-2 px-3 md:hidden"
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          minWidth: 0,
        }}
      >
        <Burger
          opened={drawerOpened}
          onClick={() => setDrawerOpened((opened) => !opened)}
          aria-label="Open navigation"
          size="sm"
          color={accentStrong}
        />

        <Box
          w={34}
          h={34}
          style={{
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background:
              'linear-gradient(135deg, var(--platform-accent-strong) 0%, var(--platform-accent) 62%, rgba(255,255,255,0.92) 160%)',
            color: '#ffffff',
            flex: '0 0 auto',
          }}
        >
          <Text fw={800} size="xs" lh={1}>
            DV
          </Text>
        </Box>

        <div style={{ minWidth: 0, flex: 1 }}>
          <PlatformAdAccountDropdownClient
            platforms={platforms}
            adAccounts={adAccounts}
            initialPlatformId={initialPlatformId}
            initialAccountId={initialAccountId}
            variant="compact"
          />
        </div>

        <Menu shadow="md" width="min(calc(100vw - 24px), 380px)" position="bottom-end">
          <Menu.Target>
            <Indicator disabled={notificationCount === 0} label={notificationCount} size={16}>
              <ActionIcon
                size="lg"
                radius="xl"
                variant="subtle"
                aria-label="Open notifications"
                style={{ color: accentStrong, backgroundColor: accentSoft }}
              >
                <IconBell size={20} />
              </ActionIcon>
            </Indicator>
          </Menu.Target>
          <Menu.Dropdown>
            <Group justify="space-between" px="sm" py={8}>
              <Text fw={700} size="sm">Notifications</Text>
              {notificationCount > 0 ? (
                <Button variant="subtle" size="compact-xs" onClick={markAllRead}>
                  Mark read
                </Button>
              ) : null}
            </Group>
            <Divider />
            {userNotifications.length > 0 ? (
              <Box mah="54vh" style={{ overflowY: 'auto' }} p={6}>
                {userNotifications.map((notification) => (
                  <Menu.Item
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={notification.read ? 'opacity-70' : ''}
                  >
                    <Stack gap={2}>
                      <Group justify="space-between" gap="sm" wrap="nowrap">
                        <Text size="sm" fw={700} lineClamp={1} style={{ minWidth: 0 }}>
                          {notification.title}
                        </Text>
                        <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
                          {formatNotificationTime(notification.created_at)}
                        </Text>
                      </Group>
                      <Text
                        size="xs"
                        c="dimmed"
                        lineClamp={2}
                        title={notification.message}
                      >
                        {formatNotificationPreviewMessage(notification.message)}
                      </Text>
                    </Stack>
                  </Menu.Item>
                ))}
              </Box>
            ) : (
              <Box p="md" ta="center">
                <Text size="sm" c="dimmed">No new notifications</Text>
              </Box>
            )}
            <Divider />
            <Menu.Item onClick={() => navigate('/notifications')}>
              View all notifications
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>

        <Menu shadow="md" width={220} position="bottom-end">
          <Menu.Target>
            <ActionIcon size="lg" radius="xl" variant="subtle" aria-label="Open account menu">
              <Avatar
                color="blue"
                radius="xl"
                size={34}
                style={{
                  backgroundColor: accentSoftStrong,
                  color: accentStrong,
                  border: `1px solid ${borderColor}`,
                }}
              >
                {userInitials}
              </Avatar>
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Label>{fullName || 'Account'}</Menu.Label>
            <Menu.Item leftSection={<IconSettings size={16} />} onClick={() => navigate('/settings')}>
              Settings
            </Menu.Item>
            <Menu.Item color="red" leftSection={<IconLogout size={16} />} onClick={clientHandleSignOut}>
              Logout
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </div>

      <Drawer
        opened={drawerOpened}
        onClose={() => setDrawerOpened(false)}
        title={<Text fw={800}>DeepVisor</Text>}
        position="left"
        size="min(88vw, 360px)"
        padding="md"
        className="md:hidden"
        overlayProps={{ opacity: 0.28, blur: 2 }}
      >
        <Stack gap="md">
          <PlatformAdAccountDropdownClient
            platforms={platforms}
            adAccounts={adAccounts}
            initialPlatformId={initialPlatformId}
            initialAccountId={initialAccountId}
            variant="drawer"
          />

          <TextInput
            placeholder="Search DeepVisor"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.currentTarget.value)}
            leftSection={<IconSearch size={16} />}
          />

          <Stack gap={8}>
            <Text size="xs" fw={800} c="dimmed" tt="uppercase">
              Create
            </Text>
            <Button
              leftSection={<IconTable size={18} />}
              fullWidth
              justify="flex-start"
              variant="light"
              disabled
            >
              Campaign
            </Button>
            <Button
              leftSection={<IconLayersIntersect size={18} />}
              fullWidth
              justify="flex-start"
              variant="light"
              disabled
            >
              Ad set
            </Button>
            <Button
              leftSection={<IconPlus size={18} />}
              fullWidth
              justify="flex-start"
              variant="light"
              disabled
            >
              Ad
            </Button>
          </Stack>

          <Divider />

          <Stack gap={4}>
            {[...primaryNavItems, ...secondaryNavItems].map((item) => (
              <NavLink
                key={item.route}
                label={item.name}
                leftSection={
                  <ThemeIcon
                    variant={isAppNavItemActive(pathname, item.route) ? 'filled' : 'light'}
                    style={{
                      backgroundColor: isAppNavItemActive(pathname, item.route)
                        ? accentColor
                        : accentSoft,
                      color: isAppNavItemActive(pathname, item.route) ? '#fff' : accentStrong,
                    }}
                  >
                    <item.icon size={18} />
                  </ThemeIcon>
                }
                active={isAppNavItemActive(pathname, item.route)}
                onClick={() => navigate(item.route)}
                styles={{
                  root: {
                    borderRadius: 14,
                  },
                  label: {
                    color: textStrong,
                    fontWeight: 700,
                  },
                }}
              />
            ))}
          </Stack>

          <Divider />

          <Button
            color="red"
            variant="subtle"
            leftSection={<IconLogout size={18} />}
            justify="flex-start"
            onClick={clientHandleSignOut}
          >
            Logout
          </Button>
        </Stack>
      </Drawer>

      <Portal>
        <nav
          className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t bg-white/95 px-1 pb-[calc(0.45rem+env(safe-area-inset-bottom))] pt-2 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur md:hidden"
          style={{ borderColor }}
          aria-label="Primary mobile navigation"
        >
          {mobileBottomNavItems.slice(0, 2).map((item) => {
            const active = isMobileBottomItemActive(item.route);

            return (
              <button
                key={item.route}
                type="button"
                onClick={() => navigate(item.route)}
                className="flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-[10px] font-bold"
                style={{
                  color: active ? accentStrong : '#64748b',
                  backgroundColor: active ? accentSoft : 'transparent',
                }}
              >
                <item.icon size={20} stroke={active ? 2.2 : 1.8} />
                <span className="w-full truncate">{item.shortName}</span>
              </button>
            );
          })}
          <button
            type="button"
            disabled
            aria-label="Create campaigns, ad sets, and ads coming soon"
            className="flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-[10px] font-bold disabled:cursor-not-allowed"
            style={{
              color: '#94a3b8',
              backgroundColor: 'rgba(148, 163, 184, 0.12)',
            }}
          >
            <span
              className="flex h-10 w-10 items-center justify-center rounded-full"
              style={{
                backgroundColor: 'rgba(148, 163, 184, 0.18)',
                border: '1px solid rgba(148, 163, 184, 0.34)',
              }}
            >
              <IconPlus size={24} stroke={2.4} />
            </span>
            <span className="w-full truncate">Create</span>
          </button>
          {mobileBottomNavItems.slice(2).map((item) => {
            const active = isMobileBottomItemActive(item.route);
            const isNotifications = item.route === '/notifications';
            const icon = <item.icon size={20} stroke={active ? 2.2 : 1.8} />;

            return (
              <button
                key={item.route}
                type="button"
                onClick={() => navigate(item.route)}
                className="flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-[10px] font-bold"
                style={{
                  color: active ? accentStrong : '#64748b',
                  backgroundColor: active ? accentSoft : 'transparent',
                }}
              >
                {isNotifications ? (
                  <Indicator
                    disabled={notificationCount === 0}
                    label={notificationCount > 9 ? '9+' : notificationCount}
                    size={18}
                    offset={1}
                    styles={{
                      indicator: {
                        minWidth: 18,
                        height: 18,
                        padding: '0 4px',
                        borderRadius: 999,
                        lineHeight: '18px',
                        fontSize: 10,
                        fontWeight: 800,
                        border: '2px solid #ffffff',
                      },
                    }}
                  >
                    {icon}
                  </Indicator>
                ) : (
                  icon
                )}
                <span className="w-full truncate">{item.shortName}</span>
              </button>
            );
          })}
        </nav>
      </Portal>
    </>
  );
}
