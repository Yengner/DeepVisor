import { cache } from 'react';
import { cookies } from 'next/headers';

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
