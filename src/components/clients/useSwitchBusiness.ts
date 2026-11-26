'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { switchBusiness } from '@/lib/server/clients/actions';
import { showError } from '@/lib/client';
import { safeAppPath } from '@/lib/shared/clients/model';

export const BUSINESS_CHANNEL = 'dv-business';

/**
 * Switches business, then loads the page fresh so nothing from the previous business stays on
 * screen. Other open tabs are told to reload: the choice is shared by every tab.
 */
export function useSwitchBusiness() {
  const t = useTranslations('clients');
  const [switching, setSwitching] = useState<string | null>(null);
  const go = async (businessId: string, path = '/dashboard') => {
    setSwitching(businessId);
    const result = await switchBusiness(businessId).catch(() => null);
    if (!result?.ok) {
      setSwitching(null);
      showError(t('error.switch'));
      return;
    }
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel(BUSINESS_CHANNEL);
      channel.postMessage(businessId);
      channel.close();
    }
    window.location.assign(safeAppPath(path));
  };
  return { switching, go };
}
