import { expect, it } from 'vitest';
import { secondaryNavItems, primaryNavItems, mobileBottomNavItems, isAppNavItemActive } from '../navigation';
it('exposes Reports through secondary navigation without expanding primary navigation', () => {
  expect(secondaryNavItems.find(item => item.route === '/reports')?.name).toBe('Reports');
  expect(primaryNavItems.map(i => i.route)).toEqual(['/dashboard','/agency','/campaigns','/integration','/settings']);
  expect(mobileBottomNavItems).toEqual(primaryNavItems.filter(item=>item.route!=='/settings'));
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
