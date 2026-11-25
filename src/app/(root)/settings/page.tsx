import { isLocale } from '@/i18n/locales';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import { resolveCurrentSelection } from '@/lib/server/actions/app/selection';
import { getUnreadUserNotificationIds } from '@/lib/server/actions/user/settings';
import { loadAdFacts } from '@/lib/server/agent/facts';
import { getNotificationPreference } from '@/lib/server/intelligence/repositories/notificationPreferences';
import { listArchivedReports } from '@/lib/server/intelligence/repositories/reportArchive';
import { getReportSubscription } from '@/lib/server/intelligence/repositories/reportSubscriptions';
import { createAdminClient } from '@/lib/server/supabase/admin';
import { createServerClient } from '@/lib/server/supabase/server';
import { ALERT_PREFERENCES_AVAILABLE } from '@/lib/shared/productAvailability';
import SettingsView, { type SettingsIntegration } from './SettingsView';

type IntegrationRow = {
  id: string;
  status: string;
  connected_at: string | null;
  last_synced_at: string | null;
  last_error: string | null;
  token_expires_at: string | null;
  platforms: { key: string; name: string } | { key: string; name: string }[] | null;
};

/** Loads everything for the signed-in person's business and selected ad account; SettingsView draws it. */
export default async function SettingsPage() {
  const supabase = await createServerClient();
  const { user, businessId, organizationName, role } = await getRequiredAppContext();
  const selection = await resolveCurrentSelection(businessId);

  const [businessResult, integrationsResult, accountsResult, unreadIds, alertPreferences, archivedReports, localeRow] = await Promise.all([
    supabase
      .from('business_profiles')
      .select('business_name, industry, website, description, monthly_budget, booking_link, business_location, customer_radius, most_valuable_service, promoted_services, preferred_contact_method')
      .eq('id', businessId)
      .maybeSingle(),
    supabase
      .from('platform_integrations')
      .select('id, status, connected_at, last_synced_at, last_error, token_expires_at, platforms ( key, name )')
      .eq('business_id', businessId)
      .order('created_at', { ascending: true }),
    // Settings shows only how many accounts there are, the last sync and the selected name.
    supabase.from('ad_accounts').select('id, name, last_synced').eq('business_id', businessId),
    getUnreadUserNotificationIds(user.id),
    // Saved preferences are only read while the form that edits them is shown.
    ALERT_PREFERENCES_AVAILABLE
      ? Promise.all([
        getNotificationPreference(supabase, { businessId, userId: user.id }),
        getReportSubscription(supabase, { businessId, userId: user.id }),
      ]).then(([notification, report]) => ({ notification, report }))
      : Promise.resolve(null),
    listArchivedReports(supabase, { businessId, limit: 60 }),
    supabase.from('users').select('preferred_locale').eq('id', user.id).maybeSingle(),
  ]);

  // Owner answers plus what the selected account's ad sets show. Failure is shown, not hidden.
  const adFacts = await loadAdFacts(createAdminClient(), { businessId, adAccountId: selection.selectedAdAccountId }).catch(error => {
    console.error('Settings ad facts unavailable', { code: (error as { code?: string })?.code ?? (error as Error)?.message });
    return null;
  });

  if (accountsResult.error) console.error('Settings ad accounts unavailable', { code: accountsResult.error.code });
  const accounts = accountsResult.data ?? [];
  const lastSyncedAt = accounts.reduce<string | null>((latest, account) =>
    account.last_synced && (!latest || Date.parse(account.last_synced) > Date.parse(latest)) ? account.last_synced : latest, null);

  const business = businessResult.data;
  const integrations: SettingsIntegration[] = ((integrationsResult.data ?? []) as IntegrationRow[]).map(row => {
    const platform = Array.isArray(row.platforms) ? row.platforms[0] : row.platforms;
    return {
      id: row.id,
      name: platform?.name ?? 'Meta',
      connected: String(row.status).toLowerCase() === 'connected',
      connectedAt: row.connected_at,
      lastSyncedAt: row.last_synced_at,
      tokenExpiresAt: row.token_expires_at,
      hasError: Boolean(row.last_error),
    };
  });
  const savedLocale = localeRow.data?.preferred_locale ?? null;

  return (
    <SettingsView data={{
      user,
      role,
      business: {
        businessName: business?.business_name ?? organizationName,
        industry: business?.industry ?? '',
        website: business?.website ?? '',
        monthlyBudget: business?.monthly_budget ?? '',
        description: business?.description ?? '',
        mainService: business?.most_valuable_service ?? '',
        businessLocation: business?.business_location ?? '',
        customerRadius: business?.customer_radius ?? '',
        preferredContactMethod: business?.preferred_contact_method ?? '',
        bookingLink: business?.booking_link ?? '',
      },
      businessLoadFailed: Boolean(businessResult.error && !business),
      promotedServices: (business?.promoted_services ?? []) as string[],
      savedLocale: isLocale(savedLocale) ? savedLocale : null,
      adFacts: adFacts ? { facts: adFacts.facts, accountCurrency: adFacts.accountCurrency } : null,
      alertPreferences,
      unreadCount: unreadIds.length,
      integrations,
      lastSyncedAt,
      accountCount: accounts.length,
      selectedAdAccountName: accounts.find(account => account.id === selection.selectedAdAccountId)?.name ?? null,
      archivedReports,
    }} />
  );
}
