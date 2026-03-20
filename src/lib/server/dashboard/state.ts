import type { DashboardState } from './types';

export function resolveDashboardState(input: {
  selectedPlatformId: string | null;
  platformConnected: boolean;
  selectedAdAccountId: string | null;
  adAccountPresent: boolean;
  adAccountHasMetrics: boolean;
}): DashboardState {
  if (!input.selectedPlatformId) {
    return 'no_platform_selected';
  }

  if (!input.platformConnected) {
    return 'platform_not_found_or_not_connected';
  }

  if (!input.selectedAdAccountId || !input.adAccountPresent) {
    return 'no_ad_account_selected';
  }

  if (!input.adAccountHasMetrics) {
    return 'ad_account_selected_no_metrics';
  }

  return 'ready';
}
