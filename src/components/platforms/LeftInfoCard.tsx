import Image from 'next/image';

interface platformData {
    ad_accounts_length: number;
    total_spend: number;
    total_leads: number;
    total_clicks: number;
    total_ctr: number;
    total_link_clicks: number;
    total_impressions: number;
    total_messages: number;
    total_conversions: number;
}

interface topAdAccounts {
    ad_account_name: string;
    spend: number;
}

interface topCampaigns {
    campaign_name: string;
    spend: number;
    conversion: number;
}

interface SidebarProps {
    platform: string;
    overview: platformData;
    topAdAccounts: topAdAccounts[];
    topCampaigns: topCampaigns[];
    isReportsSidebarOpen: boolean;
}

const LeftSidebar: React.FC<SidebarProps> = ({ platform, overview, topAdAccounts, topCampaigns, isReportsSidebarOpen }) => {
    return (
        <div
            className={`transition-all duration-300 bg-white space-y-4 shadow-lg p-6 rounded-lg ${
                isReportsSidebarOpen ? 'w-1/5' : 'w-1/4'
            }`}
        >            {/* Platform Logo and Name */}
            <div className="text-center">
                <Image
                    src={`/images/platforms/logo/${platform}.png`}
                    alt={`${platform} Logo`}
                    className="h-24 w-24 rounded-full mx-auto mb-4"
                    width={96} 
                    height={96}
                />
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-200">
                    {platform.charAt(0).toUpperCase() + platform.slice(1)}
                </h2>
            </div>

            {/* Overview */}
            <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg shadow space-y-2">
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">Overview</h3>
                <ul className="text-sm text-gray-600 dark:text-gray-300">
                    <li>Total Ad Accounts: <span className="font-semibold">{overview.ad_accounts_length}</span></li>
                    <li>Total Spend: <span className="font-semibold">${overview.total_spend.toLocaleString()}</span></li>
                    <li>Total Impressions: <span className="font-semibold">{overview.total_impressions.toLocaleString()}</span></li>
                    <li>Total Leads: <span className="font-semibold">{overview.total_leads.toLocaleString()}</span></li>
                    <li>Total Clicks: <span className="font-semibold">{overview.total_clicks.toLocaleString()}</span></li>
                    <li>Total Link Clicks: <span className="font-semibold">{overview.total_link_clicks.toLocaleString()}</span></li>
                    <li>Total Messages: <span className="font-semibold">{overview.total_messages.toLocaleString()}</span></li>
                    <li>Total Conversions: <span className="font-semibold">{overview.total_conversions.toLocaleString()}</span></li>
                    <li>Total CTR: <span className="font-semibold">{overview.total_ctr.toFixed(2)}%</span></li>
                </ul>
            </div>

            {/* Quick Actions */}
            <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg shadow space-y-4 relative">
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">Quick Actions</h3>
                <ul className="space-y-2">
                    {/* Create Campaign */}
                    <li className="relative group">
                        <button className="w-full bg-blue-500 hover:bg-blue-600 text-white text-sm px-4 py-2 rounded-lg shadow disabled-button">
                            Create Campaign
                        </button>
                        <div className="coming-soon-overlay">Coming Soon</div>
                    </li>

                    {/* View Performance */}
                    <li className="relative group">
                        <button className="w-full bg-green-500 hover:bg-green-600 text-white text-sm px-4 py-2 rounded-lg shadow disabled-button">
                            View Performance
                        </button>
                        <div className="coming-soon-overlay">Coming Soon</div>
                    </li>

                    {/* Adjust Budget */}
                    <li className="relative group">
                        <button className="w-full bg-yellow-500 hover:bg-yellow-600 text-white text-sm px-4 py-2 rounded-lg shadow disabled-button">
                            Adjust Budget
                        </button>
                        <div className="coming-soon-overlay">Coming Soon</div>
                    </li>
                </ul>
            </div>


            {/* Top Ad Accounts */}
            <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg shadow space-y-4">
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">Top Ad Accounts</h3>
                <ul className="space-y-3">
                    {topAdAccounts.map((account, index) => (
                        <li
                            key={index}
                            className="flex justify-between items-center p-2 bg-white dark:bg-gray-800 rounded-lg shadow hover:bg-gray-50 dark:hover:bg-gray-600"
                        >
                            <div className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                                {account.ad_account_name}
                            </div>
                            <div
                                className={`text-sm font-bold ${account.spend > 1000
                                    ? "text-green-600 dark:text-green-400"
                                    : account.spend > 500
                                        ? "text-yellow-600 dark:text-yellow-400"
                                        : "text-red-600 dark:text-red-400"
                                    }`}
                            >
                                ${account.spend.toLocaleString()}
                            </div>
                        </li>
                    ))}
                </ul>
            </div>


            {/* Top Campaigns */}
            <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg shadow space-y-4">
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">Top Campaigns</h3>
                <ul className="space-y-3">
                    {topCampaigns.map((campaign, idx) => (
                        <li
                            key={idx}
                            className="flex justify-between items-center p-2 bg-white dark:bg-gray-800 rounded-lg shadow hover:bg-gray-50 dark:hover:bg-gray-600"
                        >
                            <div className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                                {campaign.campaign_name}
                            </div>

                            <div
                                className={`text-sm font-bold ${campaign.spend > 500
                                    ? "text-green-600 dark:text-green-400"
                                    : campaign.spend > 200
                                        ? "text-yellow-600 dark:text-yellow-400"
                                        : "text-red-600 dark:text-red-400"
                                    }`}
                            >
                                ${campaign.spend.toLocaleString()}
                            </div>

                        </li>
                    ))}
                </ul>
            </div>

        </div>
    );
};

export default LeftSidebar;