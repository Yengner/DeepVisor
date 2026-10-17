import { expect, it } from 'vitest';
import { secondaryNavItems, primaryNavItems, mobileBottomNavItems, isAppNavItemActive } from '../navigation';
it('exposes Reports through secondary navigation without expanding primary navigation', () => {
  expect(secondaryNavItems.find(item => item.route === '/reports')?.name).toBe('Reports');
  expect(primaryNavItems.map(i => i.route)).toEqual(['/dashboard','/decisions','/campaigns','/integration','/settings']);
  expect(mobileBottomNavItems).toEqual(primaryNavItems);
  expect(isAppNavItemActive('/reports', '/reports')).toBe(true);
  expect(isAppNavItemActive('/reports/archive/example', '/reports')).toBe(true);
  expect(isAppNavItemActive('/campaigns', '/reports')).toBe(false);
});
