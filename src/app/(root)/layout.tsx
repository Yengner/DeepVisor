import Topbar from "@/components/layout/topBar/TopBar";
import Sidebar from "@/components/layout/LeftSidebar";
import { getLoggedInUser, InitPlatformID } from "@/lib/actions/user";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { setCookie } from "cookies-next";

export default async function RootLayout({ children }: { children: React.ReactNode }) {

  const cookieStore = await cookies();
  const user = await getLoggedInUser().then((user: { id: string, onboarding_completed: boolean, connected_accounts: [{ accountId: string }] }) => user);
  let selectedPlatformId = cookieStore.get('platform_integration_id')?.value || null;
  if (!selectedPlatformId) {
    selectedPlatformId = await InitPlatformID(user.id);
    setCookie('platform_integration_id', selectedPlatformId, { maxAge: 60 * 60 * 24 * 30 });
  }
  let selectedAdAccountId = cookieStore.get('ad_account_id')?.value || null;
  if (!selectedAdAccountId) {
    selectedAdAccountId = user?.connected_accounts?.[0]?.accountId || null;
    setCookie('ad_account_id', selectedAdAccountId, { maxAge: 60 * 60 * 24 * 30 });
  }


  if (user.onboarding_completed === false) {
    console.warn('User onboarding not completed. Redirecting to /onboarding.');
    redirect('/onboarding');
  }



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
