import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/lib/shared/types/supabase';
import type { DecisionPersistenceTables } from '@/lib/shared/types/decisionPersistence';
import type { FeatureSnapshot } from '@/lib/server/features';

type Client = SupabaseClient<Database>;
type Insert<T extends keyof DecisionPersistenceTables> = DecisionPersistenceTables[T]['Insert'];

function requireBusinessId(businessId: string): void {
  if (!businessId.trim()) throw new Error('A business ID is required');
}

function pageLimit(limit = 50): number {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error('Limit must be an integer between 1 and 100');
  }
  return limit;
}

export async function saveFeatureSnapshot(
  client: Client,
  input: { platformIntegrationId: string; snapshot: FeatureSnapshot }
) {
  const { snapshot } = input;
  requireBusinessId(snapshot.deliveryUnit.businessId);
  const { data, error } = await client.schema('ai').from('feature_snapshots').insert({
    business_id: snapshot.deliveryUnit.businessId,
    platform_integration_id: input.platformIntegrationId,
    ad_account_id: snapshot.deliveryUnit.adAccountId,
    entity_type: snapshot.deliveryUnit.entityType,
    entity_id: snapshot.deliveryUnit.adsetId,
    feature_schema_version: snapshot.schemaVersion,
    feature_json: JSON.parse(JSON.stringify(snapshot)) as Json,
  }).select('*').single();
  if (error) throw error;
  return data;
}

export async function getFeatureSnapshot(client: Client, businessId: string, id: string) {
  requireBusinessId(businessId);
  const { data, error } = await client.schema('ai').from('feature_snapshots')
    .select('*').eq('business_id', businessId).eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function listFeatureSnapshots(client: Client, businessId: string, limit = 50) {
  requireBusinessId(businessId);
  const { data, error } = await client.schema('ai').from('feature_snapshots')
    .select('*').eq('business_id', businessId)
    .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(pageLimit(limit));
  if (error) throw error;
  return data ?? [];
}

export async function insertDecisionRun(
  client: Client, businessId: string,
  values: Omit<Insert<'decision_runs'>, 'business_id' | 'id' | 'created_at' | 'updated_at'>
) {
  requireBusinessId(businessId);
  const { data, error } = await client.schema('ai').from('decision_runs')
    .insert({ ...values, business_id: businessId }).select('*').single();
  if (error) throw error;
  return data;
}

export async function getDecisionRun(client: Client, businessId: string, id: string) {
  requireBusinessId(businessId);
  const { data, error } = await client.schema('ai').from('decision_runs')
    .select('*').eq('business_id', businessId).eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function listDecisionRuns(client: Client, businessId: string, limit = 50) {
  requireBusinessId(businessId);
  const { data, error } = await client.schema('ai').from('decision_runs')
    .select('*').eq('business_id', businessId)
    .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(pageLimit(limit));
  if (error) throw error;
  return data ?? [];
}

export async function insertActionProposal(
  client: Client, businessId: string,
  values: Omit<Insert<'action_proposals'>, 'business_id' | 'id' | 'created_at' | 'updated_at'>
) {
  requireBusinessId(businessId);
  const { data, error } = await client.schema('ai').from('action_proposals')
    .insert({ ...values, business_id: businessId }).select('*').single();
  if (error) throw error;
  return data;
}

export async function getActionProposal(client: Client, businessId: string, id: string) {
  requireBusinessId(businessId);
  const { data, error } = await client.schema('ai').from('action_proposals')
    .select('*').eq('business_id', businessId).eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function listActionProposals(client: Client, businessId: string, limit = 50) {
  requireBusinessId(businessId);
  const { data, error } = await client.schema('ai').from('action_proposals')
    .select('*').eq('business_id', businessId)
    .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(pageLimit(limit));
  if (error) throw error;
  return data ?? [];
}

export async function insertExecutedAction(
  client: Client, businessId: string,
  values: Omit<Insert<'executed_actions'>, 'business_id' | 'id' | 'created_at' | 'updated_at'>
) {
  requireBusinessId(businessId);
  const { data, error } = await client.schema('ai').from('executed_actions')
    .insert({ ...values, business_id: businessId }).select('*').single();
  if (error) throw error;
  return data;
}

export async function getExecutedAction(client: Client, businessId: string, id: string) {
  requireBusinessId(businessId);
  const { data, error } = await client.schema('ai').from('executed_actions')
    .select('*').eq('business_id', businessId).eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function listExecutedActions(client: Client, businessId: string, limit = 50) {
  requireBusinessId(businessId);
  const { data, error } = await client.schema('ai').from('executed_actions')
    .select('*').eq('business_id', businessId)
    .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(pageLimit(limit));
  if (error) throw error;
  return data ?? [];
}

export async function insertActionOutcome(
  client: Client, businessId: string,
  values: Omit<Insert<'action_outcomes'>, 'business_id' | 'id' | 'created_at' | 'updated_at'>
) {
  requireBusinessId(businessId);
  const { data, error } = await client.schema('ai').from('action_outcomes')
    .insert({ ...values, business_id: businessId }).select('*').single();
  if (error) throw error;
  return data;
}

export async function getActionOutcome(client: Client, businessId: string, id: string) {
  requireBusinessId(businessId);
  const { data, error } = await client.schema('ai').from('action_outcomes')
    .select('*').eq('business_id', businessId).eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function listActionOutcomes(client: Client, businessId: string, limit = 50) {
  requireBusinessId(businessId);
  const { data, error } = await client.schema('ai').from('action_outcomes')
    .select('*').eq('business_id', businessId)
    .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(pageLimit(limit));
  if (error) throw error;
  return data ?? [];
}

export async function updateDecisionRun(
  client: Client, businessId: string, id: string,
  values: Pick<DecisionPersistenceTables['decision_runs']['Update'], 'status' | 'decision_json' | 'confidence' | 'provider_response_json'>
) {
  requireBusinessId(businessId);
  const { data, error } = await client.schema('ai').from('decision_runs')
    .update(values).eq('business_id', businessId).eq('id', id).select('*').maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateActionProposal(
  client: Client, businessId: string, id: string,
  values: Pick<DecisionPersistenceTables['action_proposals']['Update'], 'status' | 'policy_result_json' | 'requires_approval'>
) {
  requireBusinessId(businessId);
  const { data, error } = await client.schema('ai').from('action_proposals')
    .update(values).eq('business_id', businessId).eq('id', id).select('*').maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateExecutedAction(
  client: Client, businessId: string, id: string,
  values: Pick<DecisionPersistenceTables['executed_actions']['Update'], 'status' | 'request_metadata_json' | 'state_before_json' | 'state_after_json' | 'error_json' | 'started_at' | 'completed_at'>
) {
  requireBusinessId(businessId);
  const { data, error } = await client.schema('ai').from('executed_actions')
    .update(values).eq('business_id', businessId).eq('id', id).select('*').maybeSingle();
  if (error) throw error;
  return data;
}

export async function getAutonomyPolicy(client: Client, businessId: string) {
  requireBusinessId(businessId);
  const { data, error } = await client.schema('ai').from('autonomy_policies')
    .select('*').eq('business_id', businessId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertAutonomyPolicy(
  client: Client, businessId: string,
  values: Omit<Insert<'autonomy_policies'>, 'business_id' | 'id' | 'created_at' | 'updated_at'>
) {
  requireBusinessId(businessId);
  const { data, error } = await client.schema('ai').from('autonomy_policies')
    .upsert({ ...values, business_id: businessId }, { onConflict: 'business_id' }).select('*').single();
  if (error) throw error;
  return data;
}
