'use client';

interface Campaign {
  id: string;
  name: string;
  status: string;
  start_time: string;
  stop_time: string;
  impressions: number;
  clicks: number;
  spend: number;
  leads: number;
  messages: number;
}

interface TopCampaignsProps {
  campaignsData: {
    top3ByLeads: Campaign[];
  };
}

const TopCampaigns = ({ campaignsData }: TopCampaignsProps) => {
  if (!campaignsData || !campaignsData.top3ByLeads) {
    return null
  }
  const campaigns = campaignsData.top3ByLeads || [];

  return (
    <div className="shadow-md rounded-lg bg-white dark:bg-gray-900 p-4">
      <h2 className="text-xl text-center font-bold text-[#3e4e38]">Top 3 Campaigns by Leads</h2>
      {campaigns.length === 0 ? (
        <p className="text-sm text-gray-700">No campaigns available.</p>
      ) : (
        <div className="space-y-3 pr-8 pl-8 pb-8 pt-4">
          {campaigns.map((campaign) => (
            <div
              key={campaign.id}
              className="bg-[#faffe3] shadow border border-gray-300 dark:border-gray-700 rounded-md p-4 hover:shadow-lg transition-shadow"
            >
              <h3 className="text-lg font-semibold text-[#5f743b] truncate">
                {campaign.name || 'Unnamed Campaign'}
              </h3>
              <div className="mt-2 text-sm space-y-1">
                <p>
                  <span className="font-medium text-gray-700">Status:</span>{' '}
                  <span
                    className={`px-2 py-1 text-xs font-bold rounded ${
                      campaign.status === 'ACTIVE'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {campaign.status}
                  </span>
                </p>
                <p>
                  <span className="font-medium text-gray-700">Leads:</span>{' '}
                  {campaign.leads.toLocaleString()}
                </p>
                <p>
                  <span className="font-medium text-gray-700">Clicks:</span>{' '}
                  {campaign.clicks.toLocaleString()}
                </p>
                <p>
                  <span className="font-medium text-gray-700">Spend:</span> ${campaign.spend.toLocaleString()}
                </p>
                <p>
                  <span className="font-medium text-gray-700">Impressions:</span>{' '}
                  {campaign.impressions.toLocaleString()}
                </p>
              </div>
              <a
                href={`/campaigns/${campaign.id}`}
                className="block mt-4 text-center text-sm font-medium text-white bg-[#dba866] hover:bg-emerald-800 rounded-md px-4 py-2"
              >
                View Details →
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TopCampaigns;
