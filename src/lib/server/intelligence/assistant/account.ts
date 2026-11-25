import 'server-only';

import { createServerClient } from '@/lib/server/supabase/server';
import type { AssistantAccountRef } from '@/lib/shared/assistant/contracts';

/** The selected account the assistant drawer names. Read with the person's session, so RLS applies. */
export async function loadAssistantAccount(input: { businessId: string; adAccountId: string | null }): Promise<AssistantAccountRef> {
  if (!input.adAccountId) return { selectedAdAccountId: null, selectedAdAccountName: null };
  const supabase = await createServerClient();
  const { data, error } = await supabase.from('ad_accounts').select('id, name')
    .eq('business_id', input.businessId).eq('id', input.adAccountId).maybeSingle();
  if (error) throw error;
  return { selectedAdAccountId: data?.id ?? null, selectedAdAccountName: data?.name ?? null };
}
