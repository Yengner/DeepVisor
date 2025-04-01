'use client';

import AdAccountPerformanceMetrics from './AdAccountPerformanceMetrics';
import { useReportsSidebar } from '../../reports/ReportSidebarContext';
import LatestCampaignResults from './LatestCampaignResults';

// Using `any` for now to avoid TypeScript issues while data structures are finalized
/* eslint-disable */
export default function AdAccountDashboard({ adAccountData, campaignData }: { adAccountData: any, campaignData: any }) {
  /* eslint-enable */
  const { isReportsSidebarOpen } = useReportsSidebar(); // Access the sidebar state

  return (
    <div className='space-y-6'>
      <div className="space-y-1 flex1">
        <h1 className="text-3xl font-bold text-gray-800">{adAccountData.name}</h1>
        <p className="text-sm text-gray-600 flex-col">Your Ad Account Overview</p>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-4 underline underline-offset-8 [text-decoration-style:dotted]">
          Performance metrics
        </h2>
        {/* Latest Ad Account Performance */}
        <AdAccountPerformanceMetrics adAccountData={adAccountData} isReportsSidebarOpen={isReportsSidebarOpen} />
      </div>

      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-4 underline underline-offset-8 [text-decoration-style:dotted]">
          Latest Campaign Results
        </h2>
        <LatestCampaignResults campaignData={campaignData} isReportsSidebarOpen={isReportsSidebarOpen}/>
      </div>
      {/* Other Dashboard Components */}
      <div className="flex-1 space-y-8">
        {/* Performance Graphs, Metrics, etc */}
      </div>

      {/* <LeftInfoCard
        platform={platform}
        overview={platformData}
        topAdAccounts={topCampaignForAdAccounts.topAdAccounts}
        topCampaigns={topCampaignForAdAccounts.topCampaigns}
        isReportsSidebarOpen={isReportsSidebarOpen}
      /> */}

      {/* Main Content */}
      <div className="flex-1 space-y-8">
        {/* Ad Accounts Table */}
        {/* <AdAccountsTable adAccountsData={adAccountsData} platform={platform} isReportsSidebarOpen={isReportsSidebarOpen}
        /> */}

        {/* Featured Campaigns */}
        {/* <FeaturedCampaigns data={topCampaignForAdAccounts} isReportsSidebarOpen={isReportsSidebarOpen}
        /> */}

        {/* Spend Trends Graph */}
        {/* <SpendTrendsGraph data={adAccountsData} isReportsSidebarOpen={isReportsSidebarOpen}
        /> */}
      </div>
    </div>
  );
};