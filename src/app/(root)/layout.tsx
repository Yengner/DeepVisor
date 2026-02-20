import Topbar from "@/components/layout/topBar/TopBar";
import Sidebar from "@/components/layout/LeftSidebar";
import { getLoggedInUserOrRedirect } from "@/lib/server/actions/user/account";
import { requireBusinessContextOrRedirect } from "@/lib/server/actions/business/context";
// import { cookies } from "next/headers";
// import { setCookie } from "cookies-next";

export default async function RootLayout({ children }: { children: React.ReactNode }) {

  // const cs = await cookies();
  const user = await getLoggedInUserOrRedirect()
  const ctx = await requireBusinessContextOrRedirect(user.id);

  console.log("User context in RootLayout:", { user });

  /**
   * Depricated process until later
   */
  // let selectedPlatformId = cs.get('platform_integration_id')?.value || null;

  // if (!selectedPlatformId) {
  //   selectedPlatformId = await InitPlatformID(user.id);
  //   setCookie('platform_integration_id', selectedPlatformId, { maxAge: 60 * 60 * 24 * 30 });
  // }

  // let selectedAdAccountId = cs.get('ad_account_row_id')?.value || null;
  // if (!selectedAdAccountId) {
  //   selectedAdAccountId = user?.connected_accounts?.[0]?.accountId || null;
  //   setCookie('ad_account_row_id', selectedAdAccountId, { maxAge: 60 * 60 * 24 * 30 });
  // }


  return (
    <div className="h-screen flex flex-col">
      {/* Topbar */}
      <header className="w-full h-16 bg-white border-b border-gray-300 z-50 flex-shrink-0">
        <Topbar />
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar />

        {/* Main Content */}
        <main className="flex-1 bg-gray-50 overflow-y-auto pl-16 pr-2 pt-10 pb-10 mx-auto space-y-8">
          {children}
        </main>
      </div>
    </div>
  );
}
