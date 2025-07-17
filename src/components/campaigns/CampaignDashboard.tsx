'use client';

import { useState, useEffect } from 'react';
import {
    Button, Group, Paper, Title, Text, Tabs, ActionIcon,
    Tooltip, Select, TextInput, Menu, Badge, Stack, Avatar
} from '@mantine/core';
import {
    IconRefresh, IconPlus, IconSearch, IconAdjustments,
    IconFilterOff, IconChartBar, IconTable, IconBrandFacebook,
    IconBrandTiktok, IconBrandGoogle, IconInfoCircle
} from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import CampaignTable from './CampaignTable';
import AdSetTable from './AdSetTable';
import AdsTable from './AdsTable';
import CampaignStats from './CampaignStats';
import { EmptyCampaignState } from './EmptyStates';
import { getPlatformIcon } from '@/utils/utils';

interface Campaign {
    id: string;
    name: string;
    delivery: boolean;
    type: string;
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
    accountName?: string;
    ad_account_id?: string;
}

interface PlatformInfo {
    id: string;
    name: string;
}

interface CampaignDashboardProps {
    campaigns: Campaign[];
    userId: string;
    platform: PlatformInfo;
    accountMetrics: {
        spend: number;
        impressions: number;
        clicks: number;
        link_clicks: number;
        reach: number;
        leads: number;
        messages: number;
        ctr: number;
        cpc: number;
        cpm: number;
    };
}

export default function CampaignDashboard({ campaigns, userId, platform, accountMetrics }: CampaignDashboardProps) {
    const router = useRouter();
    const initialCampaignId = campaigns.length > 0 ? campaigns[0].id : null;
    const [campaignData, setCampaignData] = useState(campaigns);
    const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(initialCampaignId);
    const [activeTab, setActiveTab] = useState<string>('campaigns');
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string | null>(null);
    const [typeFilter, setTypeFilter] = useState<string | null>(null);
    const [selectedAdSetId, setSelectedAdSetId] = useState<string | null>(null);

    // Get unique statuses and types for filter dropdowns
    const types = Array.from(new Set(campaignData.map(c => c.type))).filter(Boolean);
    const statuses = Array.from(new Set(campaignData.map(c => c.status?.toUpperCase()))).filter(Boolean);

    // Get platform color and icon
    const getPlatformColor = () => {
        switch (platform.name.toLowerCase()) {
            case 'facebook':
            case 'meta': return 'blue';
            case 'tiktok': return 'dark';
            case 'google': return 'red';
            default: return 'gray';
        }
    };

    // Filtered campaigns
    const filteredCampaigns = campaignData.filter(campaign => {
        const matchesSearch = !searchQuery ||
            campaign.name.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesStatus = !statusFilter ||
            campaign.status?.toUpperCase() === statusFilter;

        const matchesType = !typeFilter ||
            campaign.type === typeFilter;

        return matchesSearch && matchesStatus && matchesType;
    });

    // Handler for toggling campaign status
    const handleToggleCampaign = async (campaignId: string, newStatus: boolean) => {
        try {
            const campaign = campaignData.find(c => c.id === campaignId);
            const response = await fetch('/api/campaigns/toggleCampaign', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId,
                    campaignId,
                    newStatus,
                    platform: campaign?.platform,
                    adAccountId: campaign?.ad_account_id
                }),
            });

            if (!response.ok) {
                throw new Error(await response.text());
            }

            setCampaignData(prev =>
                prev.map(c => (c.id === campaignId ? { ...c, delivery: newStatus } : c))
            );
        } catch (error) {
            console.error('Failed to toggle campaign:', error);
        }
    };

    // Handler for deleting a campaign
    const handleDeleteCampaign = async (campaignId: string) => {
        try {
            const campaign = campaignData.find(c => c.id === campaignId);
            const response = await fetch('/api/campaigns/deleteCampaign', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId,
                    campaignId,
                    platform: campaign?.platform,
                    adAccountId: campaign?.ad_account_id
                }),
            });

            if (!response.ok) {
                throw new Error(await response.text());
            }

            setCampaignData((prev) => prev.filter((c) => c.id !== campaignId));
            if (selectedCampaignId === campaignId) {
                setSelectedCampaignId(null);
            }
        } catch (error) {
            console.error('Failed to delete campaign:', error);
        }
    };

    // Handler for refreshing campaigns data
    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            const response = await fetch('/api/campaigns/refreshCampaignData', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId,
                    platformId: platform.id
                }),
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

    // Reset all filters
    const resetFilters = () => {
        setSearchQuery('');
        setStatusFilter(null);
        setTypeFilter(null);
    };

    // Calculate summary statistics
    const totalSpend = filteredCampaigns.reduce((sum, c) =>
        sum + (typeof c.spend === 'string' ? parseFloat(c.spend) : (c.spend || 0)), 0);
    const totalImpressions = filteredCampaigns.reduce((sum, c) => sum + (c.impressions || 0), 0);
    const totalClicks = filteredCampaigns.reduce((sum, c) => sum + (c.clicks || 0), 0);
    const avgCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

    // Reset selected adset when campaign changes
    useEffect(() => {
        setSelectedAdSetId(null);
    }, [selectedCampaignId]);

    // Handle tab transitions
    useEffect(() => {
        // If we're on adsets tab but no campaign is selected, go back to campaigns
        if (!selectedCampaignId && activeTab === 'adsets') {
            setActiveTab('campaigns');
        }

        // If we're on ads tab but no adset is selected, go back to adsets
        if (!selectedAdSetId && activeTab === 'ads') {
            setActiveTab('adsets');
        }
    }, [selectedAdSetId, selectedCampaignId, activeTab]);

    // Show empty state if no campaigns
    if (campaignData.length === 0) {
        return <EmptyCampaignState type="campaigns" platformName={platform.name} />;
    }

    return (
        <div className="p-2">
            {/* Header with more compact layout */}
            <Paper p="md" radius="md" withBorder mb="xs">
                <Group justify="apart" mb="xs">
                    <Group>
                        <Avatar
                            color={getPlatformColor()}
                            radius="xl"
                            size="md"
                        >
                            {getPlatformIcon(platform.name, 24)}
                        </Avatar>
                        <div>
                            <Group gap="xs">
                                <Text fw={600} size="lg">
                                    {platform.name.charAt(0).toUpperCase() + platform.name.slice(1)} Campaigns
                                </Text>
                                <Badge color={getPlatformColor()}>
                                    {filteredCampaigns.length}
                                </Badge>
                            </Group>
                        </div>
                    </Group>
                    <Group>
                        <Menu position="bottom-end" shadow="md">
                            <Menu.Target>
                                <Button leftSection={<IconPlus size={16} />} color={getPlatformColor()} size='compact-md'>
                                    Create Campaign
                                </Button>
                            </Menu.Target>
                            <Menu.Dropdown>
                                <Menu.Label>Campaign Type</Menu.Label>
                                <Menu.Item
                                    onClick={() => router.push(`/campaigns/create?mode=smart&platform=${platform.id}`)}
                                >
                                    AI-Assisted Campaign
                                </Menu.Item>
                                <Menu.Item
                                    onClick={() => router.push(`/campaigns/create?mode=manual&platform=${platform.id}`)}
                                >
                                    Custom Campaign
                                </Menu.Item>
                            </Menu.Dropdown>
                        </Menu>
                        <Tooltip label="Refresh data">
                            <ActionIcon
                                onClick={handleRefresh}
                                loading={isRefreshing}
                                variant="light"
                                color={getPlatformColor()}
                                size="lg"
                            >
                                <IconRefresh size={18} />
                            </ActionIcon>
                        </Tooltip>
                    </Group>
                </Group>

                {/* More compact stats */}
                <CampaignStats
                    totalCampaigns={filteredCampaigns.length}
                    accountMetrics={accountMetrics}
                    platformColor={getPlatformColor()}
                />
            </Paper>

            {/* Filters - make more compact */}
            <Paper p="xs" radius="md" withBorder mb="xs">
                <Group gap="xs" justify="apart">
                    <Text size="sm" fw={500}>Filters</Text>
                    {(searchQuery || statusFilter || typeFilter) && (
                        <Tooltip label="Clear all filters">
                            <ActionIcon onClick={resetFilters} variant="subtle" size="sm">
                                <IconFilterOff size={14} />
                            </ActionIcon>
                        </Tooltip>
                    )}
                </Group>

                <Group gap="xs" mt="xs">
                    <TextInput
                        placeholder="Search campaigns..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.currentTarget.value)}
                        leftSection={<IconSearch size={14} />}
                        style={{ flexGrow: 1 }}
                        size="xs"
                    />
                    <Select
                        placeholder="Status"
                        value={statusFilter}
                        onChange={setStatusFilter}
                        data={statuses.map(s => ({ value: s, label: s }))}
                        clearable
                        leftSection={<IconAdjustments size={14} />}
                        style={{ width: 120 }}
                        size="xs"
                    />
                    <Select
                        placeholder="Type"
                        value={typeFilter}
                        onChange={setTypeFilter}
                        data={types.map(t => ({ value: t, label: t }))}
                        clearable
                        style={{ width: 120 }}
                        size="xs"
                    />
                </Group>
            </Paper>

            {/* Campaign Hierarchy Tabs - now with more space for table */}
            <Paper p="xs" radius="md" withBorder style={{ height: 'calc(100vh - 240px)', display: 'flex', flexDirection: 'column' }}>
                <Tabs value={activeTab} onChange={setActiveTab as any}>
                    <Tabs.List>
                        <Tabs.Tab
                            value="campaigns"
                            leftSection={<IconChartBar size={14} />}
                        >
                            Campaigns
                        </Tabs.Tab>
                        <Tabs.Tab
                            value="adsets"
                            leftSection={<IconTable size={14} />}
                            disabled={!selectedCampaignId}
                        >
                            Ad Sets
                        </Tabs.Tab>
                        <Tabs.Tab
                            value="ads"
                            disabled={!selectedAdSetId}
                        >
                            Ads
                        </Tabs.Tab>
                    </Tabs.List>

                    <Tabs.Panel value="campaigns" pt="xs" style={{ height: 'calc(100% - 36px)' }}>
                        {filteredCampaigns.length > 0 ? (
                            <CampaignTable
                                campaigns={filteredCampaigns}
                                selectedCampaignId={selectedCampaignId || undefined}
                                onSelectCampaign={setSelectedCampaignId}
                                onToggleCampaign={handleToggleCampaign}
                                onDeleteCampaign={handleDeleteCampaign}
                                platformColor={getPlatformColor()}
                            />
                        ) : (
                            <div className="p-4 text-center">
                                <Text size="sm" c="dimmed">No campaigns match your filters</Text>
                                {(searchQuery || statusFilter || typeFilter) && (
                                    <Button variant="subtle" onClick={resetFilters} mt="md" size="xs">
                                        Clear Filters
                                    </Button>
                                )}
                            </div>
                        )}
                    </Tabs.Panel>

                    <Tabs.Panel value="adsets" pt="xs">
                        {selectedCampaignId && (
                            <AdSetTable
                                campaignId={selectedCampaignId}
                                onSelectAdSet={setSelectedAdSetId}
                                selectedAdSetId={selectedAdSetId}
                            />
                        )}
                    </Tabs.Panel>

                    <Tabs.Panel value="ads" pt="xs">
                        {selectedAdSetId && (
                            <AdsTable
                                adsetId={selectedAdSetId}
                            />
                        )}
                    </Tabs.Panel>
                </Tabs>
            </Paper>
        </div>
    );
}