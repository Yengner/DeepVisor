import type { Icon } from '@tabler/icons-react';
import {
  IconBell,
  IconChecklist,
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
  { name: 'Decisions', shortName: 'Decisions', icon: IconChecklist, route: '/decisions' },
  { name: 'Campaigns', shortName: 'Campaigns', icon: IconPresentation, route: '/campaigns' },
  { name: 'Connections', shortName: 'Connections', icon: IconPuzzle, route: '/integration' },
  { name: 'Settings', shortName: 'Settings', icon: IconSettings, route: '/settings' },
];

export const secondaryNavItems: AppNavItem[] = [
  { name: 'Profile', shortName: 'Profile', icon: IconUser, route: '/settings/profile' },
  { name: 'Notifications', shortName: 'Alerts', icon: IconBell, route: '/notifications' },
];

export const mobileBottomNavItems: AppNavItem[] = primaryNavItems;

export function isAppNavItemActive(pathname: string | null, route: string): boolean {
  if (!pathname) {
    return false;
  }

  if (route === '/dashboard') {
    return pathname === '/' || pathname === '/dashboard';
  }

  return pathname === route || pathname.startsWith(`${route}/`);
}
