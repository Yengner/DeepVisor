import { getLoggedInUser } from '@/lib/actions/user.actions';
import { createSupabaseClient } from "@/lib/utils/supabase/clients/server";
import TopBarClient from './TopBarClient';

export default async function Topbar() {
  const user = await getLoggedInUser();

  const supabase = await createSupabaseClient();
  const userId = user?.id;

  // Fetch platform integrations
  const { data: platforms, error: platformError } = await supabase
    .from("platform_integrations")
    .select("id, platform_name")
    .eq("user_id", userId);

  if (platformError) {
    console.error("Error fetching platforms:", platformError.message);
  }

  // Fetch ad accounts
  const { data: adAccounts, error: adAccountError } = await supabase
    .from("ad_accounts")
    .select("id, name, platform_integration_id, ad_account_id")
    .eq("user_id", userId);

  if (adAccountError) {
    console.error("Error fetching ad accounts:", adAccountError.message);
  }

  // Fetch user notifications
  const { data: notifications, error: notificationsError } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(10);

  if (notificationsError) {
    console.error("Error fetching notifications:", notificationsError.message);
  }

  return (
    <div className="w-full h-full">
      <TopBarClient
        userInfo={user}
        platforms={platforms || []}
        adAccounts={adAccounts || []}
        notifications={notifications || []}
      />
    </div>
  );
}
