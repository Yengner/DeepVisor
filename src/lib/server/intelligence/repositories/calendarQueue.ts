import type { SupabaseClient } from '@supabase/supabase-js';
import { asRecord } from '@/lib/shared';
import type { Database } from '@/lib/shared/types/supabase';
import type {
  CalendarQueueChildBlueprint,
  CalendarQueueItem,
  CalendarQueueItemDraft,
} from '../types';

type IntelligenceClient = SupabaseClient<Database>;
type QueueRow = Database['public']['Tables']['calendar_queue_items']['Row'];
type QueueInsert = Database['public']['Tables']['calendar_queue_items']['Insert'];
type QueueUpdate = Database['public']['Tables']['calendar_queue_items']['Update'];

function mapQueueRow(row: QueueRow): CalendarQueueItem {
  return {
    id: row.id,
    businessId: row.business_id,
    platformIntegrationId: row.platform_integration_id,
    adAccountId: row.ad_account_id,
    sourceSignalId: row.source_signal_id,
    sourceType: row.source_type as CalendarQueueItem['sourceType'],
    itemType: row.item_type as CalendarQueueItem['itemType'],
    priority: row.priority as CalendarQueueItem['priority'],
    status: row.status as CalendarQueueItem['status'],
    title: row.title,
    description: row.description,
    destinationHref: row.destination_href,
    scheduledFor: row.scheduled_for,
    dueDate: row.due_date,
    parentQueueItemId: row.parent_queue_item_id,
    workflowKey: row.workflow_key as CalendarQueueItem['workflowKey'],
    materializedFromBlueprintKey: row.materialized_from_blueprint_key,
    childBlueprints: (Array.isArray(row.child_blueprints_json)
      ? row.child_blueprints_json
      : []) as unknown as CalendarQueueChildBlueprint[],
    payload: asRecord(row.payload_json) as CalendarQueueItem['payload'],
    campaignDraftId: row.campaign_draft_id,
    createdByUserId: row.created_by_user_id,
    updatedByUserId: row.updated_by_user_id,
    completedAt: row.completed_at,
    dismissedAt: row.dismissed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toQueueInsert(
  draft: CalendarQueueItemDraft,
  timestamp: string
): QueueInsert {
  return {
    business_id: draft.businessId,
    platform_integration_id: draft.platformIntegrationId,
    ad_account_id: draft.adAccountId,
    source_signal_id: draft.sourceSignalId,
    source_type: draft.sourceType,
    item_type: draft.itemType,
    priority: draft.priority,
    title: draft.title,
    description: draft.description,
    destination_href: draft.destinationHref,
    scheduled_for: draft.scheduledFor ?? null,
    due_date: draft.dueDate ?? null,
    parent_queue_item_id: draft.parentQueueItemId ?? null,
    workflow_key: draft.workflowKey ?? null,
    materialized_from_blueprint_key: draft.materializedFromBlueprintKey ?? null,
    child_blueprints_json:
      (draft.childBlueprints ?? []) as unknown as QueueInsert['child_blueprints_json'],
    payload_json: draft.payload as QueueInsert['payload_json'],
    updated_at: timestamp,
  };
}

/**
 * Lists queue items for one ad account, including parent workflows and any
 * materialized child actions.
 */
export async function listCalendarQueueItems(
  supabase: IntelligenceClient,
  input: {
    businessId: string;
    adAccountId: string;
  }
): Promise<CalendarQueueItem[]> {
  const { data, error } = await supabase
    .from('calendar_queue_items')
    .select('*')
    .eq('business_id', input.businessId)
    .eq('ad_account_id', input.adAccountId)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return ((data ?? []) as QueueRow[]).map(mapQueueRow);
}

/**
 * Creates or updates workflow parent queue items for the current signal set.
 * Parent workflows that are no longer active are dismissed unless they have
 * already been completed. Materialized child rows are operational records and
 * are not touched here.
 */
export async function syncSignalCalendarQueueItems(
  supabase: IntelligenceClient,
  input: {
    businessId: string;
    adAccountId: string;
    drafts: CalendarQueueItemDraft[];
  }
): Promise<CalendarQueueItem[]> {
  const timestamp = new Date().toISOString();

  const { data: existingRows, error: existingError } = await supabase
    .from('calendar_queue_items')
    .select('*')
    .eq('business_id', input.businessId)
    .eq('ad_account_id', input.adAccountId)
    .eq('source_type', 'signal')
    .is('parent_queue_item_id', null);

  if (existingError) {
    throw existingError;
  }

  const existingByWorkflowKey = new Map<string, QueueRow>();
  for (const row of (existingRows ?? []) as QueueRow[]) {
    if (row.workflow_key) {
      existingByWorkflowKey.set(row.workflow_key, row);
    }
  }

  const activeWorkflowKeys = new Set<string>(
    input.drafts
      .map((draft) => draft.workflowKey)
      .filter(
        (value): value is NonNullable<CalendarQueueItemDraft['workflowKey']> =>
          typeof value === 'string' && value.length > 0
      )
  );

  const staleRows = ((existingRows ?? []) as QueueRow[]).filter(
    (row) =>
      row.workflow_key &&
      !activeWorkflowKeys.has(row.workflow_key) &&
      row.status !== 'completed' &&
      row.status !== 'dismissed'
  );

  if (staleRows.length > 0) {
    const { error: dismissError } = await supabase
      .from('calendar_queue_items')
      .update({
        status: 'dismissed',
        dismissed_at: timestamp,
        updated_at: timestamp,
      } satisfies QueueUpdate)
      .in(
        'id',
        staleRows.map((row) => row.id)
      );

    if (dismissError) {
      throw dismissError;
    }
  }

  const upserted: CalendarQueueItem[] = [];
  for (const draft of input.drafts) {
    const existing = draft.workflowKey
      ? existingByWorkflowKey.get(draft.workflowKey) ?? null
      : null;

    if (existing) {
      const { data, error } = await supabase
        .from('calendar_queue_items')
        .update({
          item_type: draft.itemType,
          priority: draft.priority,
          title: draft.title,
          description: draft.description,
          destination_href: draft.destinationHref,
          scheduled_for: draft.scheduledFor ?? null,
          due_date: draft.dueDate ?? null,
          workflow_key: draft.workflowKey ?? null,
          child_blueprints_json:
            (draft.childBlueprints ?? []) as unknown as QueueUpdate['child_blueprints_json'],
          payload_json: draft.payload as QueueUpdate['payload_json'],
          updated_at: timestamp,
          dismissed_at: null,
          status: existing.status === 'dismissed' ? 'ready' : existing.status,
        } satisfies QueueUpdate)
        .eq('id', existing.id)
        .select('*')
        .single();

      if (error || !data) {
        throw error ?? new Error('Failed to update signal queue item');
      }

      upserted.push(mapQueueRow(data as QueueRow));
      continue;
    }

    const { data, error } = await supabase
      .from('calendar_queue_items')
      .insert(toQueueInsert(draft, timestamp))
      .select('*')
      .single();

    if (error || !data) {
      throw error ?? new Error('Failed to insert signal queue item');
    }

    upserted.push(mapQueueRow(data as QueueRow));
  }

  return upserted;
}

/**
 * Accepts one queue item. Workflow parents are approved and materialize their
 * child items atomically through the database RPC; ordinary items simply move
 * to approved.
 */
export async function acceptCalendarQueueWorkflow(
  supabase: IntelligenceClient,
  input: {
    queueItemId: string;
    userId: string | null;
  }
): Promise<CalendarQueueItem[]> {
  const { data, error } = await supabase.rpc('accept_calendar_queue_workflow', {
    p_queue_item_id: input.queueItemId,
    p_user_id: input.userId,
  });

  if (error) {
    throw error;
  }

  return ((data ?? []) as QueueRow[]).map(mapQueueRow);
}
