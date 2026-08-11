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
  ThemeIcon,
} from '@mantine/core';
import {
  IconBell,
  IconLogout,
  IconPlus,
  IconSettings,
} from '@tabler/icons-react';
import { BrandLockup, BrandMark } from '@/components/brand/Brand';
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
  unreadNotificationIds?: string[];
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
  unreadNotificationIds = [],
  initialPlatformId,
  initialAccountId,
}: MobileAppChromeClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [drawerOpened, setDrawerOpened] = useState(false);
  const [userNotifications, setUserNotifications] =
    useState<NotificationFeedItem[]>(notifications);
  const [unreadIds, setUnreadIds] = useState<string[]>(unreadNotificationIds);
  const notificationCount = unreadIds.length;
  const accentColor = 'var(--platform-accent)';
  const accentStrong = 'var(--platform-accent-strong)';
  const accentSoft = 'var(--platform-accent-soft)';
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
    setUnreadIds(unreadNotificationIds);
  }, [notifications, unreadNotificationIds]);

  const navigate = (route: string) => {
    setDrawerOpened(false);
    router.push(route);
  };

  const isMobileBottomItemActive = (route: string) =>
    isAppNavItemActive(pathname, route) ||
    (route === '/settings' && Boolean(
      pathname?.startsWith('/settings/')
    ));

  const drawerNavItems = [...primaryNavItems, ...secondaryNavItems];
  const activeDrawerRoute = drawerNavItems
    .filter((item) => isAppNavItemActive(pathname, item.route))
    .sort((left, right) => right.route.length - left.route.length)[0]?.route;

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
          color="#f7f8f3"
        />

        <BrandMark tone="light" className="h-[34px] w-[34px]" />

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
                variant="subtle"
                aria-label="Open notifications"
                style={{ color: '#d7ddd4', backgroundColor: '#20241f', border: '1px solid #343a33' }}
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
            <ActionIcon size="lg" variant="subtle" aria-label="Open account menu">
              <Avatar
                radius="sm"
                size={34}
                style={{
                  backgroundColor: '#c8ff56',
                  color: '#151714',
                  border: '1px solid #d7ff8a',
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
        title={<BrandLockup />}
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

          <Button
            leftSection={<IconPlus size={18} />}
            fullWidth
            justify="flex-start"
            onClick={() => navigate('/campaigns/create')}
          >
            New campaign
          </Button>

          <Divider />

          <Stack gap={4}>
            {drawerNavItems.map((item) => {
              const active = item.route === activeDrawerRoute;

              return (
              <NavLink
                key={item.route}
                label={item.name}
                leftSection={
                  <ThemeIcon
                    variant={active ? 'filled' : 'light'}
                    style={{
                      backgroundColor: active
                        ? accentColor
                        : accentSoft,
                      color: active ? '#fff' : accentStrong,
                    }}
                  >
                    <item.icon size={18} />
                  </ThemeIcon>
                }
                active={active}
                onClick={() => navigate(item.route)}
                styles={{
                  root: {
                    borderRadius: 6,
                  },
                  label: {
                    color: textStrong,
                    fontWeight: 700,
                  },
                }}
              />
              );
            })}
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
          className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t bg-white px-1 pb-[calc(0.45rem+env(safe-area-inset-bottom))] pt-2 shadow-[0_-4px_16px_rgba(21,23,20,0.08)] md:hidden"
          style={{ borderColor: '#dfe2da' }}
          aria-label="Primary mobile navigation"
        >
          {mobileBottomNavItems.slice(0, 2).map((item) => {
            const active = isMobileBottomItemActive(item.route);

            return (
              <button
                key={item.route}
                type="button"
                onClick={() => navigate(item.route)}
                className="flex min-w-0 flex-col items-center justify-center gap-1 rounded-md px-1 py-1.5 text-[10px] font-bold"
                style={{
                  color: active ? '#0b7a4b' : '#697067',
                  backgroundColor: active ? '#e9f7ef' : 'transparent',
                }}
              >
                <item.icon size={20} stroke={active ? 2.2 : 1.8} />
                <span className="w-full truncate">{item.shortName}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => navigate('/campaigns/create')}
            aria-label="Create campaign"
            className="flex min-w-0 flex-col items-center justify-center gap-1 rounded-md px-1 py-1.5 text-[10px] font-bold"
            style={{
              color: '#151714',
              backgroundColor: 'transparent',
            }}
          >
            <span
              className="flex h-10 w-10 items-center justify-center rounded-md"
              style={{
                backgroundColor: '#c8ff56',
                border: '1px solid #b6ed46',
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
                className="flex min-w-0 flex-col items-center justify-center gap-1 rounded-md px-1 py-1.5 text-[10px] font-bold"
                style={{
                  color: active ? '#0b7a4b' : '#697067',
                  backgroundColor: active ? '#e9f7ef' : 'transparent',
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
