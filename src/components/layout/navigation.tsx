import type { Icon } from '@tabler/icons-react';
import {
  IconBell,
  IconSparkles,
  IconChartBar,
  IconHome2,
  IconMessageCircle,
  IconPresentation,
  IconPuzzle,
  IconSettings,
} from '@tabler/icons-react';

/** Message keys under `nav` in messages/*.json. */
export type NavKey = 'overview' | 'leads' | 'agency' | 'agencyShort' | 'campaigns' | 'reports' | 'connections' | 'notifications' | 'notificationsShort' | 'profile' | 'settings';
export type AppNavItem = {
  nameKey: NavKey;
  shortKey: NavKey;
  icon: Icon;
  route: string;
};

/** Agency Control: shown only when the server enables it (`agencyEnabled`, DEEPVISOR_AGENCY). */
export const agencyNavItem: AppNavItem = { nameKey: 'agency', shortKey: 'agency', icon: IconSparkles, route: '/agency' };

export const primaryNavItems: AppNavItem[] = [
  { nameKey: 'overview', shortKey: 'overview', icon: IconHome2, route: '/dashboard' },
  { nameKey: 'leads', shortKey: 'leads', icon: IconMessageCircle, route: '/leads' },
  { nameKey: 'campaigns', shortKey: 'campaigns', icon: IconPresentation, route: '/campaigns' },
  { nameKey: 'reports', shortKey: 'reports', icon: IconChartBar, route: '/reports' },
  { nameKey: 'connections', shortKey: 'connections', icon: IconPuzzle, route: '/integration' },
];

export const secondaryNavItems: AppNavItem[] = [
  { nameKey: 'notifications', shortKey: 'notificationsShort', icon: IconBell, route: '/notifications' },
  { nameKey: 'settings', shortKey: 'settings', icon: IconSettings, route: '/settings' },
];

/** Five equal tabs on phones. Connections, Profile and Settings stay in the menu drawer. */
export const mobileBottomNavItems: AppNavItem[] = [
  { nameKey: 'overview', shortKey: 'overview', icon: IconHome2, route: '/dashboard' },
  { nameKey: 'leads', shortKey: 'leads', icon: IconMessageCircle, route: '/leads' },
  { nameKey: 'campaigns', shortKey: 'campaigns', icon: IconPresentation, route: '/campaigns' },
  { nameKey: 'reports', shortKey: 'reports', icon: IconChartBar, route: '/reports' },
  { nameKey: 'notifications', shortKey: 'notificationsShort', icon: IconBell, route: '/notifications' },
];

/** Navigation with Agency Control inserted after Leads (desktop) or in Leads' tab (phones) when enabled. */
export function primaryNavFor(agency: boolean): AppNavItem[] {
  if (!agency) return primaryNavItems;
  const at = primaryNavItems.findIndex(item => item.route === '/leads') + 1;
  return [...primaryNavItems.slice(0, at), agencyNavItem, ...primaryNavItems.slice(at)];
}
export function mobileNavFor(agency: boolean): AppNavItem[] {
  return agency ? mobileBottomNavItems.map(item => item.route === '/leads' ? { ...agencyNavItem, shortKey: 'agencyShort' } : item) : mobileBottomNavItems;
}

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
