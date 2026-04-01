import Topbar from '@/components/layout/topBar/TopBar';
import AiAssistantDrawer from '@/components/layout/AiAssistantDrawer';
import Sidebar from '@/components/layout/LeftSidebar';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import { resolveCurrentSelection } from '@/lib/server/actions/app/selection';
import { buildGlobalAiAssistantPayload } from '@/lib/server/agency';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { user, businessId } = await getRequiredAppContext();
  const selection = await resolveCurrentSelection(businessId);
  const assistantPayload = await buildGlobalAiAssistantPayload({
    businessId,
    defaultPlatformIntegrationId: selection.selectedPlatformId,
    defaultAdAccountId: selection.selectedAdAccountId,
  });

  return (
    <div className="h-screen flex flex-col">
      <header className="w-full h-16 bg-white border-b border-gray-300 z-50 flex-shrink-0">
        <Topbar user={user} businessId={businessId} />
      </header>

      <div className="flex flex-1 overflow-hidden">
        <Sidebar />

        <main className="flex-1 bg-gray-50 overflow-y-auto pl-16 pr-2 pt-10 pb-10 mx-auto space-y-8">
          {children}
        </main>
      </div>

      <AiAssistantDrawer payload={assistantPayload} />
    </div>
  );
}
