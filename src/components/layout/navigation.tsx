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

/** Message keys under `nav` in messages/*.json. */
export type NavKey = 'overview' | 'agency' | 'agencyShort' | 'campaigns' | 'reports' | 'connections' | 'notifications' | 'notificationsShort' | 'profile' | 'settings';
export type AppNavItem = {
  nameKey: NavKey;
  shortKey: NavKey;
  icon: Icon;
  route: string;
};

export const primaryNavItems: AppNavItem[] = [
  { nameKey: 'overview', shortKey: 'overview', icon: IconHome2, route: '/dashboard' },
  { nameKey: 'agency', shortKey: 'agency', icon: IconSparkles, route: '/agency' },
  { nameKey: 'campaigns', shortKey: 'campaigns', icon: IconPresentation, route: '/campaigns' },
  { nameKey: 'reports', shortKey: 'reports', icon: IconChartBar, route: '/reports' },
  { nameKey: 'connections', shortKey: 'connections', icon: IconPuzzle, route: '/integration' },
];

export const secondaryNavItems: AppNavItem[] = [
  { nameKey: 'notifications', shortKey: 'notificationsShort', icon: IconBell, route: '/notifications' },
  { nameKey: 'profile', shortKey: 'profile', icon: IconUser, route: '/settings/profile' },
  { nameKey: 'settings', shortKey: 'settings', icon: IconSettings, route: '/settings' },
];

/** Five equal tabs on phones. Connections, Profile and Settings stay in the menu drawer. */
export const mobileBottomNavItems: AppNavItem[] = [
  { nameKey: 'overview', shortKey: 'overview', icon: IconHome2, route: '/dashboard' },
  { nameKey: 'agency', shortKey: 'agencyShort', icon: IconSparkles, route: '/agency' },
  { nameKey: 'campaigns', shortKey: 'campaigns', icon: IconPresentation, route: '/campaigns' },
  { nameKey: 'reports', shortKey: 'reports', icon: IconChartBar, route: '/reports' },
  { nameKey: 'notifications', shortKey: 'notificationsShort', icon: IconBell, route: '/notifications' },
];

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
