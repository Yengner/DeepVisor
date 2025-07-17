'use client';

import SpendTrendsGraph from './SpendTrendsGraph';
import FeaturedCampaigns from './FeaturedCampaigns';
import AdAccountsTable from './AdAccountsTable';
import LeftInfoCard from './LeftInfoCard';
import { useReportsSidebar } from '../reports/ReportSidebarContext';
// import CampaignsTable from './platforms/CampaignsTable';

// Main Platform Page

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PlatformPages = ({ adAccountsData, topCampaignForAdAccounts, platform, platformData }: any) => {
    const { isReportsSidebarOpen } = useReportsSidebar(); // Access the sidebar state

    return (
        <div
            className="duration-300 flex flex-col lg:flex-row space-y-8 lg:space-y-0 lg:space-x-6 ">
            <LeftInfoCard
                platform={platform}
                overview={platformData}
                topAdAccounts={topCampaignForAdAccounts.topAdAccounts}
                topCampaigns={topCampaignForAdAccounts.topCampaigns}
                isReportsSidebarOpen={isReportsSidebarOpen}
            />

            {/* Main Content */}
            <div className="flex-1 space-y-8">
                {/* Ad Accounts Table */}
                <AdAccountsTable adAccountsData={adAccountsData} platform={platform} isReportsSidebarOpen={isReportsSidebarOpen}
                />

                {/* Featured Campaigns */}
                <FeaturedCampaigns data={topCampaignForAdAccounts} isReportsSidebarOpen={isReportsSidebarOpen}
                />

                {/* Spend Trends Graph */}
                <SpendTrendsGraph data={adAccountsData} isReportsSidebarOpen={isReportsSidebarOpen}
                />
            </div>
        </div>
    );
};

export default PlatformPages;