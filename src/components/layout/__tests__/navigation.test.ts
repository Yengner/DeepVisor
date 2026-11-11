import { expect, it } from 'vitest';
import { secondaryNavItems, primaryNavItems, mobileBottomNavItems, isAppNavItemActive } from '../navigation';
it('places Reports after Campaigns and account links below the divider', () => {
  expect(primaryNavItems.map(item => item.route)).toEqual(['/dashboard', '/agency', '/campaigns', '/reports', '/integration']);
  expect(secondaryNavItems.map(item => item.route)).toEqual(['/notifications', '/settings/profile', '/settings']);
  expect(mobileBottomNavItems.map(item => item.route)).toEqual(['/dashboard', '/agency', '/campaigns', '/integration']);
  expect(isAppNavItemActive('/reports', '/reports')).toBe(true);
  expect(isAppNavItemActive('/reports/archive/example', '/reports')).toBe(true);
  expect(isAppNavItemActive('/campaigns', '/reports')).toBe(false);
});

it('places decision review under Agency Control across desktop and mobile navigation', () => {
  expect(primaryNavItems.find(item => item.route === '/agency')?.name).toBe('Agency Control');
  expect(mobileBottomNavItems.some(item => item.route === '/decisions')).toBe(false);
  expect(isAppNavItemActive('/decisions', '/agency')).toBe(true);
  expect(isAppNavItemActive('/decisions/example', '/agency')).toBe(true);
  expect(isAppNavItemActive('/agency', '/agency')).toBe(true);
  expect(isAppNavItemActive('/campaigns', '/agency')).toBe(false);
});
