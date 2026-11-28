import 'server-only';
import { resolveCurrentSelection } from '@/lib/server/actions/app/selection';
import { getBusinessIntegrationById, resolveIntegrationAccessToken } from '@/lib/server/integrations/service';
import { createAdminClient } from '@/lib/server/supabase/admin';
import { createServerClient } from '@/lib/server/supabase/server';
import { canManageBusiness, type BusinessRole } from '@/lib/shared/business/access';
import {
  normalizeWhatsAppNumber, sameWhatsAppNumber,
  type WhatsAppSetupData, type WhatsAppTracking,
} from '@/lib/shared/whatsapp/setup';
import { sharedFromBusiness } from '@/lib/shared/integrations/sharedConnection';
import { detectWhatsAppNumbers } from './detect';

type Db = ReturnType<typeof createAdminClient>;

async function loadProfile(db: Db, businessId: string) {
  const { data, error } = await db.from('business_profiles')
    .select('whatsapp_number, whatsapp_setup_completed, page_phone').eq('id', businessId).single();
  if (error) throw error;
  return data;
}

async function loadTracking(db: Db, businessId: string, role: BusinessRole): Promise<WhatsAppTracking> {
  const { data, error } = await db.from('whatsapp_connections')
    .select('display_phone').eq('business_id', businessId).eq('status', 'active')
    .order('connected_at', { ascending: false }).limit(1);
  if (error) throw error;
  if (data.length > 0) return { status: 'on', phone: data[0].display_phone };
  if (!canManageBusiness(role)) return { status: 'view_only' };
  // Embedded Signup needs the app id and a WhatsApp Embedded Signup configuration (neither is secret).
  const appId = process.env.META_APP_ID, configId = process.env.META_WHATSAPP_CONFIG_ID;
  return appId && configId ? { status: 'available', appId, configId } : { status: 'unavailable' };
}

/**
 * What the setup screen shows for the signed-in business. The ad account comes from the saved
 * selection; reads only, nothing is written to Meta or the database.
 */
export async function loadWhatsAppSetup(businessId: string, role: BusinessRole): Promise<WhatsAppSetupData> {
  const db = createAdminClient();
  const [selection, profile, tracking] = await Promise.all([
    resolveCurrentSelection(businessId), loadProfile(db, businessId), loadTracking(db, businessId, role),
  ]);
  const result: WhatsAppSetupData = {
    candidates: [], adsCheck: 'unavailable', accountName: null,
    saved: { number: normalizeWhatsAppNumber(profile.whatsapp_number), completed: Boolean(profile.whatsapp_setup_completed) },
    pagePhone: normalizeWhatsAppNumber(profile.page_phone), tracking,
  };
  if (!selection.selectedAdAccountId || !selection.selectedPlatformId) return result;

  const { data: account, error } = await db.from('ad_accounts').select('id, name, external_account_id')
    .eq('id', selection.selectedAdAccountId).eq('business_id', businessId).maybeSingle();
  if (error) throw error;
  if (!account) return result;
  result.accountName = account.name;

  const loadSavedAdSets = async () => {
    const { data, error: savedError } = await db.from('adset_dims').select('raw').eq('ad_account_id', account.id).limit(1000);
    if (savedError) throw savedError;
    return data.map(row => row.raw);
  };
  const integration = await getBusinessIntegrationById(await createServerClient(), {
    businessId, integrationId: selection.selectedPlatformId,
  });
  if (!integration || integration.platformKey !== 'meta' || !integration.isIntegrated) return result;
  const accessToken = await resolveIntegrationAccessToken(db, integration).catch(() => null);
  if (!accessToken) return result;

  return {
    ...result,
    ...(await detectWhatsAppNumbers({
      accessToken, adAccountExternalId: account.external_account_id, loadSavedAdSets,
      includePortfolio: !sharedFromBusiness(integration.integrationDetails),
    })),
  };
}

/** `null` means "don't use WhatsApp"; the saved number is cleared. */
export async function saveWhatsAppNumber(businessId: string, number: string | null): Promise<void> {
  const db = createAdminClient();
  const { page_phone: pagePhone } = await loadProfile(db, businessId);
  const source = number === null
    ? (pagePhone ? 'skipped' : 'not_available')
    : (sameWhatsAppNumber(number, pagePhone) ? 'page_phone_confirmed' : 'manual');
  const { error } = await db.from('business_profiles').update({
    whatsapp_number: number, whatsapp_number_source: source, whatsapp_setup_completed: true,
    updated_at: new Date().toISOString(),
  }).eq('id', businessId);
  if (error) throw error;
}
