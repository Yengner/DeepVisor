import Topbar from '@/components/layout/topBar/TopBar';
import Sidebar from '@/components/layout/LeftSidebar';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import { resolveCurrentSelection } from '@/lib/server/actions/app/selection';
import { getPlatformDetails } from '@/lib/server/data';

function resolvePlatformTheme(value: string | null | undefined): 'default' | 'meta' | 'google' | 'tiktok' {
  switch (value) {
    case 'meta':
    case 'facebook':
      return 'meta';
    case 'google':
      return 'google';
    case 'tiktok':
      return 'tiktok';
    default:
      return 'default';
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { user, businessId } = await getRequiredAppContext();
  const selection = await resolveCurrentSelection(businessId);
  const selectedPlatform = selection.selectedPlatformId
    ? await getPlatformDetails(selection.selectedPlatformId, businessId)
    : null;
  const platformTheme = resolvePlatformTheme(selectedPlatform?.vendorKey);

  return (
    <div className="app-platform-shell h-screen flex flex-col" data-platform-theme={platformTheme}>
      <header className="app-platform-header w-full z-50 flex-shrink-0">
        <Topbar user={user} businessId={businessId} />
      </header>

      <div className="flex flex-1 overflow-hidden">
        <Sidebar />

        <main className="app-platform-main mx-auto flex-1 space-y-5 overflow-y-auto pb-[calc(5.5rem+env(safe-area-inset-bottom))] pl-0 pr-0 pt-3 md:space-y-6 md:pb-6 md:pl-[3.75rem] md:pr-3 md:pt-4">
          {children}
        </main>
      </div>
    </div>
  );
}
