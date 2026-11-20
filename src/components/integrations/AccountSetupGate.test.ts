import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/brand/PixelCompanion', () => ({ default: () => null }));
vi.mock('./AccountSetupProgress', () => ({ AccountSetupProgress: () => null }));
const { isOpenDuringAccountSetup } = await import('./AccountSetupGate');

describe('isOpenDuringAccountSetup', () => {
  it('keeps setup, settings, leads and notifications usable during account setup', () => {
    for (const path of ['/integration', '/settings', '/settings/account', '/leads', '/notifications']) {
      expect(isOpenDuringAccountSetup(path)).toBe(true);
    }
  });
  it('holds pages that read or change Meta data until account setup finishes', () => {
    for (const path of ['/dashboard', '/campaigns', '/campaigns/create', '/reports', '/calendar', '/insights', '/lifecycle', '/decisions', '/agency', '/integrationsx', '/leadsboard']) {
      expect(isOpenDuringAccountSetup(path)).toBe(false);
    }
  });
});
