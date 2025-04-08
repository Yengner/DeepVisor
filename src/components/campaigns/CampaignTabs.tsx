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
}

export default function CampaignTabsTop({ campaigns }: CampaignTabsProps) {
  const initialCampaignId = campaigns.length > 0 ? campaigns[0].id : null;
  const [campaignData, setCampaignData] = useState(campaigns);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(initialCampaignId);
  const [activeTab, setActiveTab] = useState<'campaigns' | 'adsets' | 'ads'>('campaigns');

  // Handler when a campaign is selected from the table
  const handleSelectCampaign = (campaignId: string) => {
    setSelectedCampaignId(campaignId);
    // If not on campaigns tab, you can keep the current tab.
  };

  // Handler for toggling campaign status
  const handleToggleCampaign = async (campaignId: string, newStatus: boolean) => {
    // Call your API to update Meta and your database.
    // For now, just update local state.
    setCampaignData(prev =>
      prev.map(c => (c.id === campaignId ? { ...c, delivery: newStatus } : c))
    );
  };

  return (
    <div className="p-4">
      {/* Top-level tab bar */}
      <div className="flex border-b mb-4">
        <button
          className={`px-4 py-2 text-sm mr-4 ${
            activeTab === 'campaigns' ? 'border-b-2 border-emerald-600 font-semibold' : ''
          }`}
          onClick={() => setActiveTab('campaigns')}
        >
          Campaigns
        </button>
        <button
          className={`px-4 py-2 text-sm mr-4 ${
            activeTab === 'adsets' ? 'border-b-2 border-emerald-600 font-semibold' : ''
          }`}
          onClick={() => setActiveTab('adsets')}
          disabled={!selectedCampaignId}
        >
          Ad Sets
        </button>
        <button
          className={`px-4 py-2 text-sm ${
            activeTab === 'ads' ? 'border-b-2 border-emerald-600 font-semibold' : ''
          }`}
          onClick={() => setActiveTab('ads')}
          disabled={!selectedCampaignId}
        >
          Ads
        </button>
      </div>

      {/* Render tab content based on activeTab */}
      {activeTab === 'campaigns' && (
        <CampaignTable
          campaigns={campaignData}
          selectedCampaignId={selectedCampaignId || undefined}
          onSelectCampaign={handleSelectCampaign}
          onToggleCampaign={handleToggleCampaign}
        />
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
