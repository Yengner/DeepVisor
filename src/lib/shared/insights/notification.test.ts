import { describe, expect, it } from 'vitest';
import { dailyNotification, presentationDay } from './notification';

describe('daily insight notifications', () => {
  it('links a single update directly', () => {
    const n = dailyNotification(null, { id: 'a', urgent: false, day: '2026-11-13' });
    expect(n).toMatchObject({ title: 'Your advertising update', link: '/insights?id=a', severity: 'info' });
  });
  it('bundles later updates into the day and links to the day', () => {
    const first = dailyNotification(null, { id: 'a', urgent: false, day: '2026-11-13' });
    const second = dailyNotification(first.bundle, { id: 'b', urgent: false, day: '2026-11-13' });
    expect(second).toMatchObject({ title: '2 advertising updates today', link: '/insights?day=2026-11-13' });
    expect(second.bundle.presentationIds).toEqual(['a', 'b']);
    expect(dailyNotification(second.bundle, { id: 'b', urgent: false, day: '2026-11-13' }).bundle.presentationIds).toHaveLength(2);
  });
  it('stays urgent once any update needed attention', () => {
    const urgent = dailyNotification(null, { id: 'a', urgent: true, day: '2026-11-13' });
    const later = dailyNotification(urgent.bundle, { id: 'b', urgent: false, day: '2026-11-13' });
    expect(later.severity).toBe('warning');
    expect(later.message).toContain('needs your attention');
  });
  it('uses the account timezone for the day', () => {
    expect(presentationDay('2026-11-13T03:00:00Z', 'America/New_York')).toBe('2026-11-12');
    expect(presentationDay('2026-11-13T03:00:00Z', 'Asia/Tokyo')).toBe('2026-11-13');
    expect(presentationDay('2026-11-13T03:00:00Z', 'Not/AZone')).toBe('2026-11-13');
  });
});
