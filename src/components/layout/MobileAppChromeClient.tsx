'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  ActionIcon,
  Avatar,
  Burger,
  Button,
  Divider,
  Drawer,
  Menu,
  NavLink,
  Portal,
  Stack,
  ThemeIcon,
} from '@mantine/core';
import {
  IconLogout,
  IconPlus,
  IconSettings,
  IconSparkles,
} from '@tabler/icons-react';
import { openDeepVisor } from '@/lib/shared/assistant/askEvent';
import { BrandLockup, BrandMark } from '@/components/brand/Brand';
import { clientHandleSignOut } from '@/lib/client';
import type { NotificationFeedItem } from '@/lib/shared';
import {
  isAppNavItemActive,
  mobileNavFor,
  primaryNavFor,
  secondaryNavItems,
} from './navigation';
import PlatformAdAccountDropdownClient from './topBar/PlatformAdAccountDropdownClient';
import bottomNav from './MobileBottomNav.module.css';

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
  /** Agency Control navigation (server switch DEEPVISOR_AGENCY). */
  showAgency?: boolean;
};

export default function MobileAppChromeClient({
  userInfo,
  platforms = [],
  adAccounts = [],
  unreadNotificationIds = [],
  initialPlatformId,
  initialAccountId,
  showAgency = false,
}: MobileAppChromeClientProps) {
  const t = useTranslations('nav');
  const router = useRouter();
  const pathname = usePathname();
  const [drawerOpened, setDrawerOpened] = useState(false);
  const notificationCount = unreadNotificationIds.length;
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

  const navigate = (route: string) => {
    setDrawerOpened(false);
    router.push(route);
  };

  const isMobileBottomItemActive = (route: string) =>
    isAppNavItemActive(pathname, route) ||
    (route === '/settings' && Boolean(
      pathname?.startsWith('/settings/')
    ));

  const drawerNavItems = [...primaryNavFor(showAgency), ...secondaryNavItems];
  const activeDrawerRoute = drawerNavItems
    .filter((item) => isAppNavItemActive(pathname, item.route))
    .sort((left, right) => right.route.length - left.route.length)[0]?.route;

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
          aria-label={t('openNavigation')}
          size="sm"
          w={44}
          h={44}
          color="#f5f9ff"
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

        <ActionIcon size={44} variant="subtle" color="gray" aria-label={t('askDeepVisor')} onClick={openDeepVisor} style={{ color: '#f5f9ff' }}>
          <IconSparkles size={21} aria-hidden />
        </ActionIcon>

        <Menu shadow="md" width={220} position="bottom-end">
          <Menu.Target>
            <ActionIcon size="lg" variant="subtle" aria-label={t('openAccountMenu')}>
              <Avatar
                radius="sm"
                size={34}
                style={{
                  backgroundColor: '#bdceff',
                  color: '#082d56',
                  border: '1px solid #bdceff',
                }}
              >
                {userInitials}
              </Avatar>
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Label>{fullName || t('account')}</Menu.Label>
            <Menu.Item leftSection={<IconSettings size={16} />} onClick={() => navigate('/settings')}>
              {t('settings')}
            </Menu.Item>
            <Menu.Item color="red" leftSection={<IconLogout size={16} />} onClick={clientHandleSignOut}>
              {t('logOut')}
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
            {t('newCampaign')}
          </Button>

          <Divider />

          <Stack gap={4}>
            {drawerNavItems.map((item) => {
              const active = item.route === activeDrawerRoute;

              return (
              <NavLink
                key={item.route}
                label={t(item.nameKey)}
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
        <nav className={`${bottomNav.bar} md:hidden`} aria-label={t('primaryMobileNavigation')}>
          <ul className={bottomNav.list}>
            {mobileNavFor(showAgency).map((item) => {
              const active = isMobileBottomItemActive(item.route);
              const unread = item.route === '/notifications' ? notificationCount : 0;

              return (
                <li key={item.route}>
                  <Link
                    href={item.route}
                    className={bottomNav.tab}
                    aria-current={active ? 'page' : undefined}
                    aria-label={unread > 0 ? t('unread', { name: t(item.nameKey), count: unread }) : t(item.nameKey)}
                  >
                    <span className={bottomNav.icon}>
                      <item.icon size={22} stroke={active ? 2.1 : 1.7} aria-hidden />
                      {unread > 0 ? <span className={bottomNav.badge} aria-hidden>{unread > 9 ? '9+' : unread}</span> : null}
                    </span>
                    <span className={bottomNav.label}>{t(item.shortKey)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </Portal>
    </>
  );
}
