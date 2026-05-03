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
      <header className="app-platform-header w-full h-16 z-50 flex-shrink-0">
        <Topbar user={user} businessId={businessId} />
      </header>

      <div className="flex flex-1 overflow-hidden">
        <Sidebar />

        <main className="app-platform-main flex-1 overflow-y-auto pl-16 pr-2 pt-10 pb-10 mx-auto space-y-8">
          {children}
        </main>
      </div>
    </div>
  );
}
