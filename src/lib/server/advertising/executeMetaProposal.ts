import 'server-only';
import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/lib/shared/types/supabase';
import { getBusinessIntegrationById, resolveIntegrationAccessToken } from '../integrations/service';
import { executeReview, executionEnabled, type ExecutionContext, type ExecutionStore } from './ReviewExecutor';
import { MetaActionAdapter } from './MetaActionAdapter';
import { AdvertisingError } from './types';

export async function createMetaExecutionAdapter(client: SupabaseClient<Database>, businessId: string, snapshot: ExecutionContext['snapshot'], enabled: boolean) {
  const [integration, accountResult] = await Promise.all([
    getBusinessIntegrationById(client, { businessId, integrationId: snapshot.platform_integration_id }),
    client.from('ad_accounts').select('*').eq('business_id', businessId).eq('id', snapshot.ad_account_id).single(),
  ]);
  const account = accountResult.data;
  if (accountResult.error || !account || !integration || integration.platformKey !== 'meta' || integration.status !== 'connected' || integration.platformId !== account.platform_id) throw new AdvertisingError('INVALID_META_CONNECTION');
  const token = await resolveIntegrationAccessToken(client, integration);
  if (!token) throw new AdvertisingError('MISSING_META_TOKEN');
  return new MetaActionAdapter({ accessToken: token, accountId: account.external_account_id, adsetId: snapshot.entity_id, liveEnabled: enabled });
}

export async function executeMetaProposal(client: SupabaseClient<Database>, input: { businessId: string; proposalId: string; role: string }) {
  if (!['owner', 'admin'].includes(input.role) || !executionEnabled(input.businessId)) throw new AdvertisingError('EXECUTION_DISABLED');
  const executionId = randomUUID();
  const ai = client.schema('ai');
  const keys = { p_business: input.businessId, p_execution: executionId };
  const store: ExecutionStore = {
    async claim() {
      const { data, error } = await ai.rpc('claim_review_execution', { ...keys, p_proposal: input.proposalId });
      if (error || !data) throw new AdvertisingError('CLAIM_REJECTED');
      return data as unknown as ExecutionContext;
    },
    async checkpoint(before, request) {
      if (!executionEnabled(input.businessId)) throw new AdvertisingError('EXECUTION_DISABLED');
      const { error } = await ai.rpc('checkpoint_review_execution', { ...keys, p_before: before as unknown as Json, p_request: request });
      if (error) throw new AdvertisingError('CHECKPOINT_REJECTED');
    },
    async finish(success, after, errorInfo) {
      const { error } = await ai.rpc('finish_review_execution', { ...keys, p_success: success, p_after: after as unknown as Json, p_error: errorInfo });
      if (error) throw new AdvertisingError('AUDIT_FINALIZATION_FAILED');
    },
  };
  await executeReview({ ...input, enabled: true, store,
    adapter: ({ snapshot }) => createMetaExecutionAdapter(client, input.businessId, snapshot, executionEnabled(input.businessId)) });
  return { executionId };
}
