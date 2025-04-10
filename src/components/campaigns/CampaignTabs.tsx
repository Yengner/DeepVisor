'use client';

import { useState, useEffect } from 'react';
import CampaignTable from '@/components/campaigns/CampaignTable';
import AdSetTable from '@/components/campaigns/AdSetTable';
import AdsTable from '@/components/campaigns/AdsTable';

interface Campaign {
  id: string;
  name: string;
  delivery: boolean;
  type: "AI Auto" | "Manual" | "Semi-Auto";
  status: string;
  objective: string;
  startDate: string;
  endDate: string;
  attribution: string;
  spend?: number;
  results?: string;
  reach?: number;
  clicks?: number;
  impressions?: number;
  frequency?: string;
  costPerResult?: string;
  cpm?: number;
  ctr?: number;
  cpc?: number;
  platform?: string;
}

interface CampaignTabsProps {
  campaigns: Campaign[];
  userId: string;
}

export default function CampaignTabsTop({ campaigns, userId }: CampaignTabsProps) {
  const initialCampaignId = campaigns.length > 0 ? campaigns[0].id : null;
  const [campaignData, setCampaignData] = useState(campaigns);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(initialCampaignId);
  const [activeTab, setActiveTab] = useState<'campaigns' | 'adsets' | 'ads'>('campaigns');
  const [deletedCampaigns, setDeletedCampaigns] = useState<string[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);


  // Allow for selecting a campaign when the component mounts
  const handleSelectCampaign = (campaignId: string) => {
    setSelectedCampaignId(campaignId);
  };

  // Handler for refreshing campaigns data
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch('/api/campaign/refreshCampaignData', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });
      if (!response.ok) {
        throw new Error('Failed to refresh campaigns data');
      }
      // Refresh the campaigns data
      window.location.reload();
    } catch (error) {
      console.error('Error refreshing campaigns data:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Handler for toggling campaign status
  const handleToggleCampaign = async (campaignId: string, newStatus: boolean) => {
    const response = await fetch('/api/campaign/toggleCampaign', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId, campaignId, newStatus }),
    });

    if (!response.ok) {
      console.error(await response.text());
      alert('Failed to update campaign on Meta.');
      return;
    }

    setCampaignData(prev =>
      prev.map(c => (c.id === campaignId ? { ...c, delivery: newStatus } : c))
    );
  };

  // Handler for deleting a campaign
  const handleDeleteCampaign = async (campaignId: string) => {

    const response = await fetch('/api/campaign/deleteCampaign', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId, campaignId }),
    });

    if (!response.ok) {
      console.error(await response.text());
      alert('Failed to delete campaign on Meta.');
      return;
    }

    setCampaignData((prev) => prev.filter((c) => c.id !== campaignId));
    if (selectedCampaignId === campaignId) {
      setSelectedCampaignId(null);
    }
  };
  return (
    <div className="p-4">
      <div className="flex justify-end mb-4">
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="px-4 py-2 text-sm border rounded"
        >
          {isRefreshing ? 'Refreshing...' : 'Refresh Data'}
        </button>
      </div>
      {/* Top-level tab bar */}
      <div className="flex border-b mb-4">
        <button
          className={`px-4 py-2 text-sm mr-4 ${activeTab === 'campaigns' ? 'border-b-2 border-emerald-600 font-semibold' : ''
            }`}
          onClick={() => setActiveTab('campaigns')}
        >
          Campaigns
        </button>
        <button
          className={`px-4 py-2 text-sm mr-4 ${activeTab === 'adsets' ? 'border-b-2 border-emerald-600 font-semibold' : ''
            }`}
          onClick={() => setActiveTab('adsets')}
          disabled={!selectedCampaignId}
        >
          Ad Sets
        </button>
        <button
          className={`px-4 py-2 text-sm ${activeTab === 'ads' ? 'border-b-2 border-emerald-600 font-semibold' : ''
            }`}
          onClick={() => setActiveTab('ads')}
          disabled={!selectedCampaignId}
        >
          Ads
        </button>
      </div>

      {/* Render the corresponding tab content */}
      {activeTab === 'campaigns' && (
        <div className="relative">
          {isRefreshing && (
            <div className="absolute inset-0 flex justify-center items-center bg-white/70 z-10">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500" />
            </div>
          )}
          <CampaignTable
            campaigns={campaignData}
            selectedCampaignId={selectedCampaignId || undefined}
            onSelectCampaign={handleSelectCampaign}
            onToggleCampaign={handleToggleCampaign}
            onDeleteCampaign={handleDeleteCampaign}
          />
        </div>
      )}
      {activeTab === 'adsets' && selectedCampaignId && (
        <AdSetTable campaignId={selectedCampaignId} />
      )}
      {activeTab === 'ads' && selectedCampaignId && (
        <AdsTable campaignId={selectedCampaignId} />
      )}
    </div>
  );
}