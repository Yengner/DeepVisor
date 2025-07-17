import { createSupabaseClient } from "@/lib/utils/supabase/clients/server";
import TopBarClient from './TopBarClient';
import { getLoggedInUser } from "@/lib/actions/user.actions";
import { cookies } from "next/headers";

export default async function Topbar() {
  const user = await getLoggedInUser();

  const supabase = await createSupabaseClient();
  const userId = user?.id;

  const { data: platforms, error: platformError } = await supabase
    .from("platform_integrations")
    .select("id, platform_name")
    .eq("user_id", userId);

  if (platformError) {
    console.error("Error fetching platforms:", platformError.message);
  }

  const { data: adAccounts, error: adAccountError } = await supabase
    .from("ad_accounts")
    .select("id, name, platform_integration_id, ad_account_id")
    .eq("user_id", userId);

  if (adAccountError) {
    console.error("Error fetching ad accounts:", adAccountError.message);
  }

  const { data: notifications, error: notificationsError } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(10);

  if (notificationsError) {
    console.error("Error fetching notifications:", notificationsError.message);
  }

  const cookieStore = await cookies();
  const platformCookie = cookieStore.get('platform_integration_id')?.value;
  const accountCookie = cookieStore.get('ad_account_id')?.value;

  const safePlatforms = platforms ?? [];
  const safeAdAccounts = adAccounts ?? [];
  const safeNotifications = notifications ?? [];

  const selectedPlatformId =
    safePlatforms.find(p => p.id === platformCookie)?.id
    ?? safePlatforms[0]?.id
    ?? null;

  const accountsForPlatform = safeAdAccounts.filter(
    acct => acct.platform_integration_id === selectedPlatformId
  );

  const selectedAccountId =
    accountsForPlatform.find(a => a.id === accountCookie)?.id
    ?? accountsForPlatform[0]?.id
    ?? null;

  return (
    <div className="w-full h-full">
      <TopBarClient
        userInfo={user}
        platforms={safePlatforms}
        adAccounts={safeAdAccounts}
        notifications={safeNotifications}
        initialPlatformId={selectedPlatformId}
        initialAccountId={selectedAccountId}
      />
    </div>
  );
}
