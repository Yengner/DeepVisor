import type { Icon } from '@tabler/icons-react';
import {
  IconBell,
  IconSparkles,
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
  { name: 'Overview', shortName: 'Overview', icon: IconHome2, route: '/dashboard' },
  { name: 'Agency Control', shortName: 'Agency Control', icon: IconSparkles, route: '/agency' },
  { name: 'Campaigns', shortName: 'Campaigns', icon: IconPresentation, route: '/campaigns' },
  { name: 'Reports', shortName: 'Reports', icon: IconChartBar, route: '/reports' },
  { name: 'Connections', shortName: 'Connections', icon: IconPuzzle, route: '/integration' },
];

export const secondaryNavItems: AppNavItem[] = [
  { name: 'Notifications', shortName: 'Alerts', icon: IconBell, route: '/notifications' },
  { name: 'Profile', shortName: 'Profile', icon: IconUser, route: '/settings/profile' },
  { name: 'Settings', shortName: 'Settings', icon: IconSettings, route: '/settings' },
];

export const mobileBottomNavItems: AppNavItem[] = primaryNavItems.filter(item => item.route !== '/reports');

export function isAppNavItemActive(pathname: string | null, route: string): boolean {
  if (!pathname) {
    return false;
  }

  if (route === '/agency' && (pathname === '/decisions' || pathname.startsWith('/decisions/'))) return true;

  if (route === '/dashboard') {
    return pathname === '/' || pathname === '/dashboard';
  }

  return pathname === route || pathname.startsWith(`${route}/`);
}
