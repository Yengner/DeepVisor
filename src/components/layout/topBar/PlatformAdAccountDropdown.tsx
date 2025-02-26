import { createSupabaseClient } from "@/lib/utils/supabase/clients/server";
import ClientDropdown from "./ClientDropdown";

interface LoggedInUser {
  id: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  business_name: string;
  email: string;
  created_at: string;
  updated_at: string;
}

interface PlatformAdAccountDropdownProps {
  loggedInUser: LoggedInUser;
}

export default async function PlatformAdAccountDropdown({ loggedInUser }: PlatformAdAccountDropdownProps) {
  const supabase = await createSupabaseClient();

  const userId = loggedInUser?.id;

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

  return (
    <ClientDropdown
      userInfo={loggedInUser}
      platforms={platforms || []}
      adAccounts={adAccounts || []}
    />
  );
}
