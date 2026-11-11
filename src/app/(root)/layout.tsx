import { headers } from 'next/headers';
import InsightsPopup from '@/components/insights/InsightsView';
import { insightsEnabled } from '@/lib/server/insights/issues';
import LifecyclePopup from '@/components/lifecycle/LifecycleView';
import { lifecycleEnabled } from '@/lib/server/lifecycle/service';
import AiAssistantDrawer from '@/components/layout/AiAssistantDrawer';
import { buildGlobalAiAssistantPayload } from '@/lib/server/intelligence/service';
import AutomaticMetaSync from '@/components/integrations/AutomaticMetaSync';
import Topbar from '@/components/layout/topBar/TopBar';
import Sidebar from '@/components/layout/LeftSidebar';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import { resolveCurrentSelection } from '@/lib/server/actions/app/selection';
import { getPlatformDetails } from '@/lib/server/data';
import { Suspense } from 'react';
import AutonomyIndicator from '@/components/product/AutonomyIndicator';
import AutonomyChrome from '@/components/product/AutonomyChrome';

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
  const showInsightsPreview = process.env.NODE_ENV === 'development'
    && (await headers()).get('host') === 'localhost:3000';
  const hasInsights = insightsEnabled();

  const assistant = await buildGlobalAiAssistantPayload({ businessId, defaultPlatformIntegrationId: selection.selectedPlatformId, defaultAdAccountId: selection.selectedAdAccountId }).catch(() => null);
  return (
    <div className="app-platform-shell h-dvh flex flex-col" data-platform-theme={platformTheme}>
      <header className="app-platform-header w-full z-50 flex-shrink-0">
        <Topbar user={user} businessId={businessId} />
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <Sidebar showInsightsPreview={showInsightsPreview} accountId={selection.selectedAdAccountId} insightsEnabled={hasInsights} />

        <AiAssistantDrawer key={selection.selectedAdAccountId} payload={assistant}><main className="app-platform-main relative min-h-0 min-w-0 mx-auto flex-1 space-y-5 overflow-y-auto pb-[calc(9rem+env(safe-area-inset-bottom))] pl-0 pr-0 pt-3 md:space-y-6 md:pb-24 md:pl-[3.75rem] md:pr-3 md:pt-4">
          {/* <AutonomyChrome><Suspense fallback={<p className="px-4 text-xs text-gray-600" style={{minHeight:44}}>Loading configured mode…</p>}><AutonomyIndicator businessId={businessId}/></Suspense></AutonomyChrome> */}
          <div className="app-status-region">
            <AutomaticMetaSync key={`sync:${selection.selectedAdAccountId}`} accountId={selection.selectedAdAccountId} />
            {hasInsights ? <InsightsPopup key={`insights:${selection.selectedAdAccountId}`} accountId={selection.selectedAdAccountId} /> : lifecycleEnabled() && <LifecyclePopup key={`lifecycle:${selection.selectedAdAccountId}`} accountId={selection.selectedAdAccountId} />}
          </div>
          {children}
        </main></AiAssistantDrawer>
      </div>
    </div>
  );
}
