'use client';

import { useState, useEffect } from 'react';
import {
    Button,
    Group,
    Paper,
    Title,
    Text,
    Tabs,
    ActionIcon,
    Tooltip,
    Select,
    TextInput,
    Menu,
    Box,
    Badge
} from '@mantine/core';
import {
    IconRefresh,
    IconPlus,
    IconSearch,
    IconAdjustments,
    IconFilterOff,
    IconChartBar,
    IconPresentationAnalytics,
    IconTable
} from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import CampaignTable from './CampaignTable';
import AdSetTable from './AdSetTable';
import AdsTable from './AdsTable';
import CampaignStats from './CampaignStats';

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
    accountName?: string;
    auto_optimize: boolean;
    ad_account_id?: string;
}

interface CampaignDashboardProps {
    campaigns: Campaign[];
    userId: string;
}

export default function CampaignDashboard({ campaigns, userId }: CampaignDashboardProps) {
    const router = useRouter();
    const initialCampaignId = campaigns.length > 0 ? campaigns[0].id : null;
    const [campaignData, setCampaignData] = useState(campaigns);
    const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(initialCampaignId);
    const [activeTab, setActiveTab] = useState<string>('overview');
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [platformFilter, setPlatformFilter] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState<string | null>(null);
    const [typeFilter, setTypeFilter] = useState<string | null>(null);
    const [selectedAdSetId, setSelectedAdSetId] = useState<string | null>(null);

    // Get unique platforms for filter dropdown
    const platforms = Array.from(new Set(campaignData.map(c => c.platform))).filter(Boolean);
    const types = Array.from(new Set(campaignData.map(c => c.type))).filter(Boolean);
    const statuses = Array.from(new Set(campaignData.map(c => c.status?.toUpperCase()))).filter(Boolean);

    // Filtered campaigns
    const filteredCampaigns = campaignData.filter(campaign => {
        const matchesSearch = !searchQuery ||
            campaign.name.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesPlatform = !platformFilter ||
            campaign.platform?.toLowerCase() === platformFilter.toLowerCase();

        const matchesStatus = !statusFilter ||
            campaign.status?.toUpperCase() === statusFilter;

        const matchesType = !typeFilter ||
            campaign.type === typeFilter;

        return matchesSearch && matchesPlatform && matchesStatus && matchesType;
    });

    // Handler for auto-optimization toggle
    const handleToggleAuto = async (campaignId: string, autoOptimize: boolean) => {
        try {
            const response = await fetch('/api/campaigns/autoOptimize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ campaignId, autoOptimize }),
            });

            if (!response.ok) {
                throw new Error(await response.text());
            }

            setCampaignData(prev =>
                prev.map(c => (c.id === campaignId ? { ...c, auto_optimize: autoOptimize } : c))
            );
        } catch (error) {
            console.error('Failed to update auto-optimization:', error);
        }
    }

    // Handler for refreshing campaigns data
    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            const response = await fetch('/api/campaigns/refreshCampaignData', {
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

    // Reset all filters
    const resetFilters = () => {
        setSearchQuery('');
        setPlatformFilter(null);
        setStatusFilter(null);
        setTypeFilter(null);
    };

    // Calculate summary statistics
    const totalSpend = filteredCampaigns.reduce((sum, c) => sum + (typeof c.spend === 'string' ? parseFloat(c.spend) : (c.spend || 0)), 0);
    const totalImpressions = filteredCampaigns.reduce((sum, c) => sum + (c.impressions || 0), 0);
    const totalClicks = filteredCampaigns.reduce((sum, c) => sum + (c.clicks || 0), 0);
    const avgCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

    const selectedCampaign = selectedCampaignId
        ? campaignData.find(c => c.id === selectedCampaignId)
        : null;

    // Reset selected adset when campaign changes
    useEffect(() => {
        setSelectedAdSetId(null);
    }, [selectedCampaignId]);

    // Handle tab transitions
    useEffect(() => {
        // When an adset is selected, enable the ads tab
        if (selectedAdSetId && activeTab === 'adsets') {
            // Optional: Auto-switch to ads tab when adset is selected
            // setActiveTab('ads');
        }

        // If we're on ads tab but no adset is selected, go back to adsets tab
        if (!selectedAdSetId && activeTab === 'ads') {
            setActiveTab('adsets');
        }

        // If we're on adsets tab but no campaign is selected, go back to overview
        if (!selectedCampaignId && activeTab === 'adsets') {
            setActiveTab('overview');
        }
    }, [selectedAdSetId, selectedCampaignId, activeTab]);

    return (
        <div className="p-4">
            <Paper p="md" radius="md" withBorder mb="md">
                <Group justify="apart" mb="md">
                    <div>
                        <Title order={3}>Campaign Manager</Title>
                        <Text size="sm" c="dimmed">Manage and optimize your marketing campaigns</Text>
                    </div>
                    <Group>
                        <Menu position="bottom-end" shadow="md">
                            <Menu.Target>
                                <Button leftSection={<IconPlus size={16} />} color="blue">
                                    Create New
                                </Button>
                            </Menu.Target>
                            <Menu.Dropdown>
                                <Menu.Label>Campaign Type</Menu.Label>
                                <Menu.Item
                                    leftSection={<IconPresentationAnalytics size={16} />}
                                    onClick={() => router.push('/campaigns/create?mode=smart')}
                                >
                                    Smart Campaign
                                </Menu.Item>
                                <Menu.Item
                                    leftSection={<IconTable size={16} />}
                                    onClick={() => router.push('/campaigns/create?mode=manual')}
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
                                color="blue"
                                size="lg"
                            >
                                <IconRefresh size={18} />
                            </ActionIcon>
                        </Tooltip>
                    </Group>
                </Group>

                {/* Overview Cards */}
                <CampaignStats
                    totalCampaigns={filteredCampaigns.length}
                    totalSpend={totalSpend}
                    totalImpressions={totalImpressions}
                    totalClicks={totalClicks}
                    avgCTR={avgCTR}
                />
            </Paper>

            {/* Filters */}
            <Paper p="md" radius="md" withBorder mb="md">
                <Group justify="apart" mb="xs">
                    <Text fw={500}>Filters</Text>
                    <Tooltip label="Reset filters">
                        <ActionIcon onClick={resetFilters} variant="light" color="gray">
                            <IconFilterOff size={16} />
                        </ActionIcon>
                    </Tooltip>
                </Group>
                <Group grow>
                    <TextInput
                        placeholder="Search campaigns..."
                        leftSection={<IconSearch size={16} />}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <Select
                        placeholder="Platform"
                        clearable
                        value={platformFilter}
                        onChange={setPlatformFilter}
                        data={platforms.filter((p): p is string => !!p).map(p => ({ value: p, label: p }))}
                        leftSection={<IconAdjustments size={16} />}
                    />
                    <Select
                        placeholder="Status"
                        clearable
                        value={statusFilter}
                        onChange={setStatusFilter}
                        data={statuses.map(s => ({ value: s, label: s }))}
                    />
                    <Select
                        placeholder="Campaign Type"
                        clearable
                        value={typeFilter}
                        onChange={setTypeFilter}
                        data={types.map(t => ({ value: t, label: t }))}
                    />
                </Group>
            </Paper>

            {/* Selected Campaign Badge */}
            {selectedCampaign && (
                <Box mb="md">
                    <Group gap="xs">
                        <Text size="sm">Selected campaign:</Text>
                        <Badge color="blue" variant="light">
                            {selectedCampaign.name}
                        </Badge>
                        {selectedCampaign.auto_optimize && (
                            <Badge color="green" variant="light">
                                AI Optimized
                            </Badge>
                        )}
                    </Group>
                </Box>
            )}

            {/* Selection hierarchy badges */}
            <Group mb="md">
                {selectedCampaign && (
                    <Badge color="blue" variant="light">
                        Campaign: {selectedCampaign.name}
                    </Badge>
                )}

                {selectedAdSetId && (
                    <Badge color="green" variant="light">
                        Selected Ad Set: ID {selectedAdSetId}
                    </Badge>
                )}
            </Group>

            {/* Tabs for different views */}

            <Tabs value={activeTab} onChange={setActiveTab as any}>
                <Tabs.List>
                    <Tabs.Tab
                        value="overview"
                        leftSection={<IconChartBar size={16} />}
                    >
                        Campaigns
                    </Tabs.Tab>
                    <Tabs.Tab
                        value="adsets"
                        leftSection={<IconTable size={16} />}
                        disabled={!selectedCampaignId}
                    >
                        Ad Sets
                    </Tabs.Tab>
                    <Tabs.Tab
                        value="ads"
                        leftSection={<IconPresentationAnalytics size={16} />}
                        disabled={!selectedAdSetId}
                    >
                        Ads
                    </Tabs.Tab>
                </Tabs.List>

                <Paper p="md" radius="md" withBorder mt="md">
                    <Tabs.Panel value="overview">
                        {filteredCampaigns.length > 0 ? (
                            <CampaignTable
                                campaigns={filteredCampaigns}
                                selectedCampaignId={selectedCampaignId || undefined}
                                onSelectCampaign={setSelectedCampaignId}
                                onToggleCampaign={handleToggleCampaign}
                                onDeleteCampaign={handleDeleteCampaign}
                                onAutoOptimize={handleToggleAuto}
                            />
                        ) : (
                            <div className="p-8 text-center">
                                <Text size="lg" c="dimmed">No campaigns match your filters</Text>
                                {(searchQuery || platformFilter || statusFilter || typeFilter) && (
                                    <Button variant="subtle" onClick={resetFilters} mt="md">
                                        Clear Filters
                                    </Button>
                                )}
                            </div>
                        )}
                    </Tabs.Panel>

                    <Tabs.Panel value="adsets">
                        {selectedCampaignId && (
                            <AdSetTable
                                campaignId={selectedCampaignId}
                                onSelectAdSet={setSelectedAdSetId}
                                selectedAdSetId={selectedAdSetId}
                            />
                        )}
                    </Tabs.Panel>

                    <Tabs.Panel value="ads">
                        {selectedAdSetId && <AdsTable adsetId={selectedAdSetId} />}
                    </Tabs.Panel>
                </Paper>
            </Tabs>
        </div>
    );
}