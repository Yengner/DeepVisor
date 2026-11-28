'use server';
import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import { fail, ok, ErrorCode, type ApiResponse } from '@/lib/shared';
import { requireManagerContext } from '@/lib/server/actions/business/manager';
import { createAdminClient } from '@/lib/server/supabase/admin';
import { deleteMetaDataForConnection } from '@/lib/server/privacy/metaDeletion';
import { releaseIntegrationWebhooks } from '@/lib/server/webhooks/subscription';
import { stopSharedConnections } from '@/lib/server/clients/sharedSync';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Owner/admin "Delete Meta data" for one Meta connection of the signed-in business. The business
 * comes from the session; the connection must belong to it (checked again in the database function).
 * Returns the confirmation code shown to the owner and checkable on /data-deletion.
 */
export async function deleteMetaDataAction(integrationId: unknown, confirmation: unknown): Promise<ApiResponse<{ code: string }>> {
  const t = await getTranslations('metaDeletion.error');
  if (typeof integrationId !== 'string' || !UUID.test(integrationId) || confirmation !== 'DELETE') {
    return fail('Invalid request', ErrorCode.VALIDATION_ERROR, { userMessage: t('confirm') });
  }
  const context = await requireManagerContext(t('forbidden'));
  if (!context.success) return context;
  const db = createAdminClient();
  const { data: connection, error } = await db.from('platform_integrations').select('id, platforms!inner(key)')
    .eq('id', integrationId).eq('business_id', context.data.businessId).eq('platforms.key', 'meta').maybeSingle();
  if (error || !connection) return fail('Connection not found', ErrorCode.NOT_FOUND, { userMessage: t('notFound') });
  try {
    await stopSharedConnections(context.data.businessId);
    // While the token still exists, stop Meta's ad account notifications (best effort).
    await releaseIntegrationWebhooks(integrationId, context.data.businessId).catch(() => console.warn('Meta webhook subscription could not be released.'));
    const result = await deleteMetaDataForConnection(db, { businessId: context.data.businessId, integrationId });
    revalidatePath('/', 'layout');
    return ok({ code: result.code });
  } catch (cause) {
    console.error('Delete Meta data failed', { code: (cause as { code?: string })?.code });
    return fail('Delete failed', ErrorCode.DATABASE_ERROR, { userMessage: t('failed') });
  }
}
