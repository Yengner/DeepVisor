import { cache } from 'react';
import { cookies } from 'next/headers';
import { createServerClient } from '@/lib/server/supabase/server';
import { asRecord } from '@/lib/shared';

export type AppSelection = {
  selectedPlatformId: string | null;
  selectedAdAccountId: string | null;
};

export const getCurrentSelection = cache(async (): Promise<AppSelection> => {
  const cookieStore = await cookies();

  return {
    selectedPlatformId: cookieStore.get('platform_integration_id')?.value ?? null,
    selectedAdAccountId: cookieStore.get('ad_account_row_id')?.value ?? null,
  };
});

export const resolveCurrentSelection = cache(
  async (businessId: string): Promise<AppSelection> => {
    const cookieSelection = await getCurrentSelection();
    const supabase = await createServerClient();

    const { data: integrations, error: integrationError } = await supabase
      .from('platform_integrations')
      .select('id, platform_id, integration_details')
      .eq('business_id', businessId)
      .eq('status', 'connected')
      .order('created_at', { ascending: true });

    if (integrationError || !integrations || integrations.length === 0) {
      return {
        selectedPlatformId: null,
        selectedAdAccountId: null,
      };
    }

    const selectedIntegration =
      integrations.find((integration) => integration.id === cookieSelection.selectedPlatformId) ??
      integrations[0];

    const platformIds = Array.from(new Set(integrations.map((integration) => integration.platform_id)));
    const { data: adAccounts, error: adAccountsError } = await supabase
      .from('ad_accounts')
      .select('id, platform_id, external_account_id')
      .eq('business_id', businessId)
      .in('platform_id', platformIds)
      .order('created_at', { ascending: true });

    if (adAccountsError || !adAccounts) {
      return {
        selectedPlatformId: selectedIntegration.id,
        selectedAdAccountId: null,
      };
    }

    const accountsForPlatform = adAccounts.filter(
      (adAccount) => adAccount.platform_id === selectedIntegration.platform_id
    );
    const primaryExternalAccountId = (() => {
      const details = asRecord(selectedIntegration.integration_details);
      return typeof details.primary_ad_account_external_id === 'string'
        ? details.primary_ad_account_external_id
        : null;
    })();
    const filteredAccountsForPlatform =
      primaryExternalAccountId
        ? accountsForPlatform.filter(
            (adAccount: { external_account_id?: string }) =>
              adAccount.external_account_id === primaryExternalAccountId
          )
        : accountsForPlatform;
    const selectedAdAccount =
      filteredAccountsForPlatform.find((adAccount) => adAccount.id === cookieSelection.selectedAdAccountId) ??
      filteredAccountsForPlatform[0] ??
      null;

    return {
      selectedPlatformId: selectedIntegration.id,
      selectedAdAccountId: selectedAdAccount?.id ?? null,
    };
  }
);
