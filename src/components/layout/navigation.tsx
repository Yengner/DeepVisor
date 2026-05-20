import type { Icon } from '@tabler/icons-react';
import {
  IconBell,
  IconCalendarMonth,
  IconChartBar,
  IconHome2,
  IconPresentation,
  IconPuzzle,
  IconSettings,
  IconUser,
} from '@tabler/icons-react';

export type AppNavItem = {
  name: string;
  shortName: string;
  icon: Icon;
  route: string;
};

export const primaryNavItems: AppNavItem[] = [
  { name: 'Home', shortName: 'Home', icon: IconHome2, route: '/dashboard' },
  { name: 'Calendar', shortName: 'Calendar', icon: IconCalendarMonth, route: '/calendar' },
  { name: 'Campaigns', shortName: 'Campaigns', icon: IconPresentation, route: '/campaigns' },
  { name: 'Reports', shortName: 'Reports', icon: IconChartBar, route: '/reports' },
  { name: 'Integration', shortName: 'Connect', icon: IconPuzzle, route: '/integration' },
];

export const secondaryNavItems: AppNavItem[] = [
  { name: 'Settings', shortName: 'Settings', icon: IconSettings, route: '/settings' },
  { name: 'Profile', shortName: 'Profile', icon: IconUser, route: '/settings/profile' },
  { name: 'Notifications', shortName: 'Alerts', icon: IconBell, route: '/notifications' },
];

export const mobileBottomNavItems: AppNavItem[] = [
  { name: 'Dashboard', shortName: 'Home', icon: IconHome2, route: '/dashboard' },
  { name: 'Calendar', shortName: 'Calendar', icon: IconCalendarMonth, route: '/calendar' },
  { name: 'Notifications', shortName: 'Alerts', icon: IconBell, route: '/notifications' },
  { name: 'Settings', shortName: 'Settings', icon: IconSettings, route: '/settings' },
];

export function isAppNavItemActive(pathname: string | null, route: string): boolean {
  if (!pathname) {
    return false;
  }

  if (route === '/dashboard') {
    return pathname === '/' || pathname === '/dashboard';
  }

  return pathname === route || pathname.startsWith(`${route}/`);
}
