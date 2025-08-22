'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import {
    Button, Group, Paper, Text, Tabs, ActionIcon, Tooltip, Select, TextInput, Menu, Badge, Avatar, Container
} from '@mantine/core';
import { IconRefresh, IconPlus, IconSearch, IconAdjustments, IconFilterOff, IconChartBar, IconTable } from '@tabler/icons-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import CampaignTable from './CampaignTable';
import AdSetTable from './AdSetTable';
import AdsTable from './AdsTable';
import CampaignStats from './CampaignStats';
import { EmptyCampaignState } from './EmptyStates';
import { getPlatformIcon } from '@/utils/utils';
import type { FormattedCampaign } from '@/app/(root)/campaigns/page';
import { fetchAdSetsForCampaign, fetchAdsForAdset } from '@/lib/quieries/components/actions';

type TabKey = 'campaigns' | 'adsets' | 'ads';

interface PlatformInfo {
    id: string;
    name: string;
}

interface CampaignDashboardProps {
    campaigns: FormattedCampaign[];
    userId: string;
    platform: PlatformInfo;
    adAccountId: string;
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
    initialSelection?: {
        tab?: TabKey;
        campaignId?: string | null;
        adsetId?: string | null;
    };
    initialAdSets?: any[];
    initialAds?: any[];
}

export default function CampaignDashboard(props: CampaignDashboardProps) {
    const {
        campaigns, userId, platform, adAccountId, accountMetrics,
        initialSelection, initialAdSets, initialAds
    } = props;

    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const initialCampaignFallback = campaigns.length > 0 ? campaigns[0].id : null;

    const [campaignData, setCampaignData] = useState(campaigns);
    const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(
        initialSelection?.campaignId ?? initialCampaignFallback
    );
    const [selectedAdSetId, setSelectedAdSetId] = useState<string | null>(
        initialSelection?.adsetId ?? null
    );
    const [activeTab, setActiveTab] = useState<TabKey>(
        (initialSelection?.tab as TabKey) || 'campaigns'
    );

    // Caches
    const [adSetsByCampaign, setAdSetsByCampaign] = useState<Record<string, any[]>>(() => {
        const seed: Record<string, any[]> = {};
        if (initialSelection?.campaignId && initialAdSets) {
            seed[initialSelection.campaignId] = initialAdSets;
        }
        return seed;
    });

    const [adsByAdset, setAdsByAdset] = useState<Record<string, any[]>>(() => {
        const seed: Record<string, any[]> = {};
        if (initialSelection?.adsetId && initialAds) {
            seed[initialSelection.adsetId] = initialAds;
        }
        return seed;
    });

    const [isRefreshing, setIsRefreshing] = useState(false);
    const [adsetsLoading, setAdsetsLoading] = useState(false);
    const [adsLoading, setAdsLoading] = useState(false);
    const [isPending, startTransition] = useTransition();

    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string | null>(null);
    const [typeFilter, setTypeFilter] = useState<string | null>(null);

    const types = useMemo(() => Array.from(new Set(campaignData.map(c => c.type))).filter(Boolean), [campaignData]);
    const statuses = useMemo(() => Array.from(new Set(campaignData.map(c => c.status?.toUpperCase()))).filter(Boolean), [campaignData]);

    const getPlatformColor = () => {
        switch (platform.name.toLowerCase()) {
            case 'facebook':
            case 'meta': return 'blue';
            case 'tiktok': return 'dark';
            case 'google': return 'red';
            default: return 'gray';
        }
    };

    const filteredCampaigns = campaignData.filter(c => {
        const matchesSearch = !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = !statusFilter || c.status?.toUpperCase() === statusFilter;
        const matchesType = !typeFilter || c.type === typeFilter;
        return matchesSearch && matchesStatus && matchesType;
    });

    // Keep tab validity coherent with selection
    useEffect(() => {
        if (!selectedCampaignId && activeTab !== 'campaigns') setActiveTab('campaigns');
        if (!selectedAdSetId && activeTab === 'ads') setActiveTab('adsets');
    }, [selectedCampaignId, selectedAdSetId, activeTab]);


    useEffect(() => {
        const sp = new URLSearchParams(searchParams?.toString());
        sp.delete('campaign_id'); sp.delete('adset_id'); sp.delete('tab');
        if (selectedCampaignId) sp.set('campaign_id', selectedCampaignId);
        if (selectedAdSetId) sp.set('adset_id', selectedAdSetId);
        if (activeTab) sp.set('tab', activeTab);
        router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedCampaignId, selectedAdSetId, activeTab]);


    useEffect(() => { setSelectedAdSetId(null); }, [selectedCampaignId]);

    useEffect(() => {
        if (activeTab !== 'adsets') return;
        if (!selectedCampaignId) return;
        if (adSetsByCampaign[selectedCampaignId]) return; // cached

        setAdsetsLoading(true);
        startTransition(async () => {
            try {
                const rows = await fetchAdSetsForCampaign(adAccountId, selectedCampaignId);
                setAdSetsByCampaign(prev => ({ ...prev, [selectedCampaignId]: rows || [] }));
            } finally {
                setAdsetsLoading(false);
            }
        });
    }, [activeTab, selectedCampaignId, adAccountId, adSetsByCampaign]);

    useEffect(() => {
        if (activeTab !== 'ads') return;
        if (!selectedAdSetId) return;
        if (adsByAdset[selectedAdSetId]) return; // cached

        setAdsLoading(true);
        startTransition(async () => {
            try {
                const rows = await fetchAdsForAdset(adAccountId, selectedAdSetId);
                setAdsByAdset(prev => ({ ...prev, [selectedAdSetId]: rows || [] }));
            } finally {
                setAdsLoading(false);
            }
        });
    }, [activeTab, selectedAdSetId, adAccountId, adsByAdset]);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            const res = await fetch('/api/metrics/backfill', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, adAccountId, fullBackfillDays: 350, vendor: 'meta' })
            });
            if (!res.ok) throw new Error('Failed to refresh campaigns data');
            window.location.reload();
        } catch (e) {
            console.error('Error refreshing campaigns data:', e);
        } finally {
            setIsRefreshing(false);
        }
    };

    const resetFilters = () => { setSearchQuery(''); setStatusFilter(null); setTypeFilter(null); };

    if (campaignData.length === 0) return <EmptyCampaignState type="campaigns" platformName={platform.name} />;

    return (
        <Container size="xl" py="md">
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
                                <Button
                                    leftSection={<IconPlus size={18} />}
                                    color={getPlatformColor()}
                                    variant="light"
                                    radius="xl"
                                    onClick={() => router.push(`/campaigns/create?platform=${platform.id}`)}
                                    style={{ fontWeight: 500 }}
                                >
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
            <Paper p="xs" radius="md" withBorder style={{ height: 'auto', display: 'flex', flexDirection: 'column' }}>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <Tabs value={activeTab} onChange={setActiveTab as any}>
                    <Tabs.List>
                        <Tabs.Tab value="campaigns" leftSection={<IconChartBar size={14} />}>Campaigns</Tabs.Tab>
                        <Tabs.Tab value="adsets" leftSection={<IconTable size={14} />} disabled={!selectedCampaignId}>Ad Sets</Tabs.Tab>
                        <Tabs.Tab value="ads" disabled={!selectedAdSetId}>Ads</Tabs.Tab>
                    </Tabs.List>

                    <Tabs.Panel value="campaigns" pt="xs">
                        <CampaignTable
                            campaigns={filteredCampaigns}
                            selectedCampaignId={selectedCampaignId ?? undefined}
                            onSelectCampaign={setSelectedCampaignId}
                            onToggleCampaign={(id, on) => {
                                setCampaignData(prev => prev.map(c => c.id === id ? { ...c, delivery: on } : c));
                            }}
                            onDeleteCampaign={(id) => setCampaignData(prev => prev.filter(c => c.id !== id))}
                            platformColor={getPlatformColor()}
                        />
                    </Tabs.Panel>

                    <Tabs.Panel value="adsets" pt="xs">
                        {selectedCampaignId && (
                            <AdSetTable
                                campaignId={selectedCampaignId}
                                adSets={adSetsByCampaign[selectedCampaignId] ?? []}
                                loading={adsetsLoading || isPending}
                                onSelectAdSet={setSelectedAdSetId}
                                selectedAdSetId={selectedAdSetId}
                                platformColor={getPlatformColor()}
                            />
                        )}
                    </Tabs.Panel>

                    <Tabs.Panel value="ads" pt="xs">
                        {selectedAdSetId && (
                            <AdsTable
                                adsetId={selectedAdSetId}
                                ads={adsByAdset[selectedAdSetId] ?? []}
                                loading={adsLoading || isPending}
                                platformColor={getPlatformColor()}
                            />
                        )}
                    </Tabs.Panel>
                </Tabs>
            </Paper>
        </Container>
    );
}