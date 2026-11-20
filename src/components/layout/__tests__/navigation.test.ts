import { expect, it } from 'vitest';
import en from '../../../../messages/en.json';
import { secondaryNavItems, primaryNavItems, mobileBottomNavItems, isAppNavItemActive, primaryNavFor, mobileNavFor } from '../navigation';
it('places Reports after Campaigns and account links below the divider', () => {
  expect(primaryNavItems.map(item => item.route)).toEqual(['/dashboard', '/leads', '/campaigns', '/reports', '/integration']);
  expect(secondaryNavItems.map(item => item.route)).toEqual(['/notifications', '/settings']);
  expect(mobileBottomNavItems.map(item => item.route)).toEqual(['/dashboard', '/leads', '/campaigns', '/reports', '/notifications']);
  expect(mobileBottomNavItems.map(item => en.nav[item.shortKey])).toEqual(['Overview', 'Leads', 'Campaigns', 'Reports', 'Alerts']);
  expect(isAppNavItemActive('/reports', '/reports')).toBe(true);
  expect(isAppNavItemActive('/reports/archive/example', '/reports')).toBe(true);
  expect(isAppNavItemActive('/campaigns', '/reports')).toBe(false);
});

it('hides Agency Control unless the server enables it', () => {
  expect(primaryNavFor(false).some(item => item.route === '/agency')).toBe(false);
  expect(mobileNavFor(false).some(item => item.route === '/agency')).toBe(false);
  expect(primaryNavFor(true).map(item => item.route)).toEqual(['/dashboard', '/leads', '/agency', '/campaigns', '/reports', '/integration']);
  expect(mobileNavFor(true).map(item => en.nav[item.shortKey])).toEqual(['Overview', 'Agency', 'Campaigns', 'Reports', 'Alerts']);
});

it('places decision review under Agency Control across desktop and mobile navigation', () => {
  const agency = primaryNavFor(true).find(item => item.route === '/agency');
  expect(agency && en.nav[agency.nameKey]).toBe('Agency Control');
  expect(mobileBottomNavItems.some(item => item.route === '/decisions')).toBe(false);
  expect(isAppNavItemActive('/decisions', '/agency')).toBe(true);
  expect(isAppNavItemActive('/decisions/example', '/agency')).toBe(true);
  expect(isAppNavItemActive('/agency', '/agency')).toBe(true);
  expect(isAppNavItemActive('/campaigns', '/agency')).toBe(false);
});
