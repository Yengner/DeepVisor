import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/shared/types/supabase';
import type { NotificationFeedItem } from '@/lib/shared';

type IntelligenceClient = SupabaseClient<Database>;

type NotificationRow = {
  id: string;
  business_id: string;
  user_id: string;
  source_type: string;
  source_id: string | null;
  dedupe_key: string | null;
  severity: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  read_at: string | null;
  payload_json: unknown;
  created_at: string;
  updated_at: string;
};

type DeliveryLogRow = {
  id: string;
  business_id: string;
  user_id: string;
  channel: string;
  source_type: string;
  source_id: string | null;
  dedupe_key: string;
  status: string;
  payload_json: unknown;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
};

type NotificationSurface = 'bell' | 'dashboard_banner' | 'both';

function resolveNotificationSurface(row: Pick<NotificationRow, 'payload_json'>): NotificationSurface {
  if (!row.payload_json || typeof row.payload_json !== 'object' || Array.isArray(row.payload_json)) {
    return 'bell';
  }

  const surface = (row.payload_json as Record<string, unknown>).surface;
  return surface === 'dashboard_banner' || surface === 'both' || surface === 'bell'
    ? surface
    : 'bell';
}

function mapNotificationRow(row: NotificationRow): NotificationFeedItem {
  return {
    id: row.id,
    user_id: row.user_id,
    title: row.title,
    message: row.message,
    created_at: row.created_at,
    read: row.read,
    type: row.type,
    link: row.link,
  };
}

export async function listNotifications(
  supabase: IntelligenceClient,
  input: {
    userId: string;
    limit?: number;
    surface?: NotificationSurface | 'all';
  }
): Promise<NotificationFeedItem[]> {
  const requestedSurface = input.surface ?? 'bell';
  const limit = typeof input.limit === 'number' && input.limit > 0 ? input.limit : null;
  const fetchLimit = limit && requestedSurface !== 'all' ? Math.min(limit * 4, 100) : limit;
  let query = (supabase as any)
    .from('notifications')
    .select('*')
    .eq('user_id', input.userId)
    .order('created_at', { ascending: false });

  if (fetchLimit) {
    query = query.limit(fetchLimit);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const rows = ((data ?? []) as NotificationRow[]).filter((row) => {
    if (requestedSurface === 'all') {
      return true;
    }

    const rowSurface = resolveNotificationSurface(row);

    if (requestedSurface === 'bell') {
      return rowSurface === 'bell' || rowSurface === 'both';
    }

    return rowSurface === 'dashboard_banner' || rowSurface === 'both';
  });

  return rows.slice(0, limit ?? rows.length).map(mapNotificationRow);
}

export async function upsertNotification(
  supabase: IntelligenceClient,
  input: {
    businessId: string;
    userId: string;
    sourceType: string;
    sourceId: string | null;
    dedupeKey: string;
    severity: 'info' | 'warning' | 'critical';
    type: string;
    title: string;
    message: string;
    link: string | null;
    surface?: NotificationSurface;
    payload?: Record<string, unknown>;
  }
): Promise<NotificationFeedItem> {
  const timestamp = new Date().toISOString();
  const surface = input.surface ?? 'bell';
  const baseRow = {
    business_id: input.businessId,
    user_id: input.userId,
    source_type: input.sourceType,
    source_id: input.sourceId,
    dedupe_key: input.dedupeKey,
    severity: input.severity,
    type: input.type,
    title: input.title,
    message: input.message,
    link: input.link,
    payload_json: {
      ...(input.payload ?? {}),
      surface,
    },
    updated_at: timestamp,
  };

  const { data: existingRow, error: existingError } = await (supabase as any)
    .from('notifications')
    .select('*')
    .eq('user_id', input.userId)
    .eq('dedupe_key', input.dedupeKey)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existingRow) {
    const { data, error } = await (supabase as any)
      .from('notifications')
      .update(baseRow)
      .eq('id', existingRow.id)
      .select('*')
      .single();

    if (error) {
      throw error;
    }

    return mapNotificationRow(data as NotificationRow);
  }

  const { data, error } = await (supabase as any)
    .from('notifications')
    .insert(baseRow)
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return mapNotificationRow(data as NotificationRow);
}

export async function markNotificationRead(
  supabase: IntelligenceClient,
  input: {
    businessId: string;
    userId: string;
    notificationId: string;
  }
): Promise<NotificationFeedItem | null> {
  const timestamp = new Date().toISOString();
  const { data, error } = await (supabase as any)
    .from('notifications')
    .update({
      read: true,
      read_at: timestamp,
      updated_at: timestamp,
    })
    .eq('id', input.notificationId)
    .eq('business_id', input.businessId)
    .eq('user_id', input.userId)
    .select('*')
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapNotificationRow(data as NotificationRow) : null;
}

export async function createOrUpdateDeliveryLog(
  supabase: IntelligenceClient,
  input: {
    businessId: string;
    userId: string;
    channel: 'in_app' | 'email';
    sourceType: string;
    sourceId: string | null;
    dedupeKey: string;
    status: 'queued' | 'sent' | 'skipped' | 'failed';
    payload?: Record<string, unknown>;
    sentAt?: string | null;
  }
): Promise<DeliveryLogRow> {
  const timestamp = new Date().toISOString();
  const { data, error } = await (supabase as any)
    .from('notification_delivery_log')
    .upsert(
      {
        business_id: input.businessId,
        user_id: input.userId,
        channel: input.channel,
        source_type: input.sourceType,
        source_id: input.sourceId,
        dedupe_key: input.dedupeKey,
        status: input.status,
        payload_json: input.payload ?? {},
        sent_at: input.sentAt ?? null,
        updated_at: timestamp,
      },
      {
        onConflict: 'user_id,channel,dedupe_key',
      }
    )
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data as DeliveryLogRow;
}
