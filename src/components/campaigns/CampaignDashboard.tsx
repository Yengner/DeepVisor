'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Select,
  Tabs,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import {
  IconAdjustments,
  IconChartBar,
  IconChevronLeft,
  IconFilterOff,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconTable,
  IconUsers,
} from '@tabler/icons-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import CampaignTable from './CampaignTable';
import AdSetTable from './AdSetTable';
import AdsTable from './AdsTable';
import { EmptyCampaignState } from './EmptyStates';
import { formatRetryDelay } from '@/lib/shared';
import type { AdLifetimeRow, AdSetLifetimeRow } from '@/lib/server/data';
import type { RefreshIntegrationsResponse } from '@/lib/shared/types/integrations';
import type { FormattedCampaign } from '@/app/(root)/campaigns/page';
import { fetchAdSetsForCampaign, fetchAdsForAdset } from '@/lib/server/data/queries/components.query';
import classes from './CampaignDashboard.module.css';

type TabKey = 'campaigns' | 'adsets' | 'ads';

interface PlatformInfo {
  id: string;
  name: string;
}

interface CampaignDashboardProps {
  campaigns: FormattedCampaign[];
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
  initialAdSets?: AdSetLifetimeRow[];
  initialAds?: AdLifetimeRow[];
}

function isTabKey(value: string | null): value is TabKey {
  return value === 'campaigns' || value === 'adsets' || value === 'ads';
}

function formatCompactNumber(value: number): string {
  if (!Number.isFinite(value)) return '0';
  if (Math.abs(value) >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return Math.round(value).toLocaleString();
}

function formatCurrency(value: number): string {
  return `$${Number(value || 0).toFixed(2)}`;
}

function campaignResults(campaign: FormattedCampaign): number {
  return Number(campaign.leads || 0) + Number(campaign.messages || 0);
}

function getPlatformColor(platformName: string): string {
  switch (platformName.toLowerCase()) {
    case 'facebook':
    case 'meta':
      return 'blue';
    case 'tiktok':
      return 'pink';
    case 'google':
    case 'google ads':
      return 'green';
    default:
      return 'gray';
  }
}

export default function CampaignDashboard(props: CampaignDashboardProps) {
  const {
    campaigns,
    platform,
    adAccountId,
    accountMetrics,
    initialSelection,
    initialAdSets,
    initialAds,
  } = props;

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const platformColor = getPlatformColor(platform.name);
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

  const [adSetsByCampaign, setAdSetsByCampaign] = useState<Record<string, AdSetLifetimeRow[]>>(() => {
    const seed: Record<string, AdSetLifetimeRow[]> = {};

    if (initialSelection?.campaignId && initialAdSets) {
      seed[initialSelection.campaignId] = initialAdSets;
    }

    return seed;
  });

  const [adsByAdset, setAdsByAdset] = useState<Record<string, AdLifetimeRow[]>>(() => {
    const seed: Record<string, AdLifetimeRow[]> = {};

    if (initialSelection?.adsetId && initialAds) {
      seed[initialSelection.adsetId] = initialAds;
    }

    return seed;
  });

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [adsetsLoading, setAdsetsLoading] = useState(false);
  const [adsLoading, setAdsLoading] = useState(false);
  const [refreshFeedback, setRefreshFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const previousCampaignIdRef = useRef<string | null>(selectedCampaignId);

  const types = useMemo(
    () => Array.from(new Set(campaignData.map((campaign) => campaign.type))).filter(Boolean),
    [campaignData]
  );
  const statuses = useMemo(
    () => Array.from(new Set(campaignData.map((campaign) => campaign.status?.toUpperCase()))).filter(Boolean),
    [campaignData]
  );

  const filteredCampaigns = useMemo(
    () =>
      campaignData.filter((campaign) => {
        const matchesSearch =
          !searchQuery || campaign.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = !statusFilter || campaign.status?.toUpperCase() === statusFilter;
        const matchesType = !typeFilter || campaign.type === typeFilter;
        return matchesSearch && matchesStatus && matchesType;
      }),
    [campaignData, searchQuery, statusFilter, typeFilter]
  );

  const selectedCampaign = useMemo(
    () => campaignData.find((campaign) => campaign.id === selectedCampaignId) ?? null,
    [campaignData, selectedCampaignId]
  );
  const selectedCampaignAdSets = selectedCampaignId ? adSetsByCampaign[selectedCampaignId] ?? [] : [];
  const selectedAdSet = useMemo(
    () => selectedCampaignAdSets.find((adSet) => adSet.id === selectedAdSetId) ?? null,
    [selectedAdSetId, selectedCampaignAdSets]
  );
  const selectedAdSetAds = selectedAdSetId ? adsByAdset[selectedAdSetId] ?? [] : [];
  const accountName = campaignData[0]?.accountName ?? 'Selected ad account';

  const accountSummary = useMemo(() => {
    const totalResults = Number(accountMetrics.leads || 0) + Number(accountMetrics.messages || 0);
    const activeCampaigns = campaignData.filter((campaign) => campaign.delivery).length;
    const spend = Number(accountMetrics.spend || 0);
    const costPerResult = totalResults > 0 ? spend / totalResults : 0;

    return {
      totalResults,
      activeCampaigns,
      pausedCampaigns: Math.max(campaignData.length - activeCampaigns, 0),
      costPerResult,
      spend,
    };
  }, [accountMetrics, campaignData]);

  const layerSummary = useMemo(() => {
    if (activeTab === 'adsets') {
      const spend = selectedCampaignAdSets.reduce((sum, item) => sum + Number(item.spend || 0), 0);
      const results = selectedCampaignAdSets.reduce(
        (sum, item) => sum + Number(item.leads || 0) + Number(item.messages || 0),
        0
      );

      return {
        label: 'Ad sets',
        count: selectedCampaignAdSets.length,
        spend,
        results,
        helper: selectedCampaign
          ? `Showing ad sets inside ${selectedCampaign.name}`
          : 'Select a campaign to review ad sets',
        createLabel: 'Create ad set',
        createHref: selectedCampaignId
          ? `/campaigns/create?platform=${platform.id}&scope=adset&campaign_id=${selectedCampaignId}`
          : null,
      };
    }

    if (activeTab === 'ads') {
      const spend = selectedAdSetAds.reduce((sum, item) => sum + Number(item.spend || 0), 0);
      const results = selectedAdSetAds.reduce(
        (sum, item) => sum + Number(item.leads || 0) + Number(item.messages || 0),
        0
      );

      return {
        label: 'Ads',
        count: selectedAdSetAds.length,
        spend,
        results,
        helper: selectedAdSet
          ? `Showing ads inside ${selectedAdSet.name}`
          : 'Select an ad set to review ads',
        createLabel: 'Create ad',
        createHref: selectedAdSetId
          ? `/campaigns/create?platform=${platform.id}&scope=ad&campaign_id=${selectedCampaignId ?? ''}&adset_id=${selectedAdSetId}`
          : null,
      };
    }

    const spend = filteredCampaigns.reduce((sum, item) => sum + Number(item.spend || 0), 0);
    const results = filteredCampaigns.reduce((sum, item) => sum + campaignResults(item), 0);

    return {
      label: 'Campaigns',
      count: filteredCampaigns.length,
      spend,
      results,
      helper: 'Campaign-level table for the selected ad account',
      createLabel: 'Create campaign',
      createHref: `/campaigns/create?platform=${platform.id}`,
    };
  }, [
    activeTab,
    filteredCampaigns,
    platform.id,
    selectedAdSet,
    selectedAdSetAds,
    selectedAdSetId,
    selectedCampaign,
    selectedCampaignAdSets,
    selectedCampaignId,
  ]);

  useEffect(() => {
    if (!selectedCampaignId && activeTab !== 'campaigns') setActiveTab('campaigns');
    if (!selectedAdSetId && activeTab === 'ads') setActiveTab('adsets');
  }, [selectedCampaignId, selectedAdSetId, activeTab]);

  useEffect(() => {
    setCampaignData(campaigns);
    setSelectedCampaignId((current) =>
      current && campaigns.some((campaign) => campaign.id === current)
        ? current
        : campaigns[0]?.id ?? null
    );
  }, [campaigns]);

  useEffect(() => {
    const sp = new URLSearchParams(searchParams?.toString());
    sp.delete('campaign_id');
    sp.delete('adset_id');
    sp.delete('tab');

    if (selectedCampaignId) sp.set('campaign_id', selectedCampaignId);
    if (selectedAdSetId) sp.set('adset_id', selectedAdSetId);
    if (activeTab) sp.set('tab', activeTab);

    const query = sp.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCampaignId, selectedAdSetId, activeTab]);

  useEffect(() => {
    if (previousCampaignIdRef.current === selectedCampaignId) {
      return;
    }

    previousCampaignIdRef.current = selectedCampaignId;
    setSelectedAdSetId(null);
  }, [selectedCampaignId]);

  useEffect(() => {
    if (activeTab !== 'adsets') return;
    if (!selectedCampaignId) return;
    if (adSetsByCampaign[selectedCampaignId]) return;

    let cancelled = false;
    setAdsetsLoading(true);

    void (async () => {
      try {
        const rows = await fetchAdSetsForCampaign(adAccountId, selectedCampaignId);

        if (cancelled) {
          return;
        }

        setAdSetsByCampaign((previous) => ({ ...previous, [selectedCampaignId]: rows || [] }));
      } finally {
        if (!cancelled) {
          setAdsetsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeTab, selectedCampaignId, adAccountId, adSetsByCampaign]);

  useEffect(() => {
    if (activeTab !== 'ads') return;
    if (!selectedAdSetId) return;
    if (adsByAdset[selectedAdSetId]) return;

    let cancelled = false;
    setAdsLoading(true);

    void (async () => {
      try {
        const rows = await fetchAdsForAdset(adAccountId, selectedAdSetId);

        if (cancelled) {
          return;
        }

        setAdsByAdset((previous) => ({ ...previous, [selectedAdSetId]: rows || [] }));
      } finally {
        if (!cancelled) {
          setAdsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeTab, selectedAdSetId, adAccountId, adsByAdset]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setRefreshFeedback(null);

    try {
      const response = await fetch('/api/sync/refresh', {
        method: 'POST',
      });
      const result = (await response.json()) as RefreshIntegrationsResponse;

      if (!response.ok || !result.success) {
        if (response.status === 429) {
          throw new Error(result.message || formatRetryDelay(result.retryAfterMs));
        }

        throw new Error(result.message || 'Failed to refresh campaign data');
      }

      setAdSetsByCampaign({});
      setAdsByAdset({});
      setRefreshFeedback({
        type: 'success',
        message: `Sync completed: ${result.refreshedCount} updated, ${result.failedCount} failed.`,
      });
      router.refresh();
    } catch (error) {
      console.error('Error refreshing campaigns data:', error);
      setRefreshFeedback({
        type: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to refresh campaign data.',
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleOpenCampaign = (campaignId: string) => {
    setSelectedCampaignId(campaignId);
    setActiveTab('adsets');
  };

  const handleOpenAdSet = (adSetId: string) => {
    setSelectedAdSetId(adSetId);
    setActiveTab('ads');
  };

  const resetFilters = () => {
    setSearchQuery('');
    setStatusFilter(null);
    setTypeFilter(null);
  };

  if (campaignData.length === 0) {
    return <EmptyCampaignState type="campaigns" platformName={platform.name} />;
  }

  return (
    <div className={`${classes.pageShell} campaigns-page-shell`}>
      <Card withBorder radius="xl" p={0} className={classes.tableSurface}>
        {refreshFeedback ? (
          <Alert
            color={refreshFeedback.type === 'success' ? 'green' : 'red'}
            icon={<IconRefresh size={16} />}
            radius={0}
            className={classes.feedback}
          >
            {refreshFeedback.message}
          </Alert>
        ) : null}

        <Tabs
          value={activeTab}
          onChange={(value) => {
            if (isTabKey(value)) {
              setActiveTab(value);
            }
          }}
          className={classes.tabs}
        >
          <div className={classes.tableHeader}>
            <Group justify="space-between" align="flex-start" gap="md" wrap="wrap">
              <div className={classes.titleBlock}>
                <Group gap="xs" wrap="wrap">
                  <Badge variant="light" className="app-platform-page-badge">
                    Campaigns
                  </Badge>
                  <Badge color={platformColor} variant="light">
                    {platform.name}
                  </Badge>
                  <Badge color="gray" variant="outline">
                    {accountName}
                  </Badge>
                </Group>

                <Title order={2} mt={6} className={classes.title}>
                  Campaign table
                </Title>
                <Group gap="xs" mt={8} wrap="wrap">
                  <Badge color="green" variant="light">
                    {accountSummary.activeCampaigns} active
                  </Badge>
                  <Badge color="yellow" variant="light">
                    {accountSummary.pausedCampaigns} inactive
                  </Badge>
                  <Badge color="gray" variant="light">
                    {formatCurrency(accountSummary.spend)} spend
                  </Badge>
                  <Badge color="gray" variant="light">
                    {formatCompactNumber(accountSummary.totalResults)} results
                  </Badge>
                  <Badge color="gray" variant="light">
                    {formatCurrency(accountSummary.costPerResult)} / result
                  </Badge>
                </Group>
              </div>

              <Group gap="sm" wrap="wrap" className={classes.actionGroup}>
                {activeTab !== 'campaigns' ? (
                  <Button
                    variant="default"
                    radius="xl"
                    leftSection={<IconChevronLeft size={16} />}
                    onClick={() => setActiveTab(activeTab === 'ads' ? 'adsets' : 'campaigns')}
                  >
                    Back
                  </Button>
                ) : null}

                {activeTab === 'campaigns' ? (
                  <Button
                    leftSection={<IconPlus size={16} />}
                    radius="xl"
                    className="app-platform-page-action-primary"
                    onClick={() => router.push(`/campaigns/create?platform=${platform.id}`)}
                  >
                    Create campaign
                  </Button>
                ) : (
                  <Button
                    leftSection={<IconPlus size={16} />}
                    radius="xl"
                    disabled={!layerSummary.createHref}
                    onClick={() => {
                      if (layerSummary.createHref) {
                        router.push(layerSummary.createHref);
                      }
                    }}
                    className="app-platform-page-action-primary"
                  >
                    {layerSummary.createLabel}
                  </Button>
                )}

                <Tooltip label="Refresh data">
                  <ActionIcon
                    onClick={handleRefresh}
                    loading={isRefreshing}
                    variant="light"
                    color="gray"
                    size="lg"
                    radius="xl"
                  >
                    <IconRefresh size={18} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            </Group>

            <Group justify="space-between" align="center" gap="md" wrap="wrap" mt="md">
              <Tabs.List>
                <Tabs.Tab value="campaigns" leftSection={<IconChartBar size={14} />}>
                  Campaigns
                </Tabs.Tab>
                <Tabs.Tab value="adsets" leftSection={<IconTable size={14} />} disabled={!selectedCampaignId}>
                  Ad Sets
                </Tabs.Tab>
                <Tabs.Tab value="ads" leftSection={<IconUsers size={14} />} disabled={!selectedAdSetId}>
                  Ads
                </Tabs.Tab>
              </Tabs.List>

              <Group gap="xs" wrap="wrap" className={classes.layerSummary}>
                <Badge variant="light" color={platformColor}>
                  {layerSummary.count} {layerSummary.label.toLowerCase()}
                </Badge>
                <Badge variant="light" color="green">
                  {formatCurrency(layerSummary.spend)} spend
                </Badge>
                <Badge variant="outline" color="gray">
                  {formatCompactNumber(layerSummary.results)} results
                </Badge>
                <Text size="sm" c="dimmed" lineClamp={1}>
                  {layerSummary.helper}
                </Text>
              </Group>
            </Group>

            {activeTab === 'campaigns' ? (
              <Group gap="sm" mt="md" className={classes.filterBar}>
                <TextInput
                  placeholder="Search campaigns"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.currentTarget.value)}
                  leftSection={<IconSearch size={14} />}
                  className={classes.searchInput}
                  size="sm"
                />
                <Select
                  placeholder="Status"
                  value={statusFilter}
                  onChange={setStatusFilter}
                  data={statuses.map((status) => ({ value: status, label: status }))}
                  clearable
                  leftSection={<IconAdjustments size={14} />}
                  className={classes.filterSelect}
                  size="sm"
                />
                <Select
                  placeholder="Type"
                  value={typeFilter}
                  onChange={setTypeFilter}
                  data={types.map((type) => ({ value: type, label: type }))}
                  clearable
                  className={classes.filterSelect}
                  size="sm"
                />
                {searchQuery || statusFilter || typeFilter ? (
                  <Tooltip label="Clear filters">
                    <ActionIcon onClick={resetFilters} variant="subtle" size="lg" radius="xl">
                      <IconFilterOff size={16} />
                    </ActionIcon>
                  </Tooltip>
                ) : null}
              </Group>
            ) : null}
          </div>

          <div className={classes.tableBody}>
            <Tabs.Panel value="campaigns" className={classes.tablePanel}>
              <div className={classes.tablePanelInner}>
                <CampaignTable
                  campaigns={filteredCampaigns}
                  selectedCampaignId={selectedCampaignId ?? undefined}
                  onSelectCampaign={setSelectedCampaignId}
                  onOpenCampaign={handleOpenCampaign}
                  onToggleCampaign={(id, on) => {
                    setCampaignData((previous) =>
                      previous.map((campaign) => (campaign.id === id ? { ...campaign, delivery: on } : campaign))
                    );
                  }}
                  onDeleteCampaign={(id) => setCampaignData((previous) => previous.filter((campaign) => campaign.id !== id))}
                  platformColor={platformColor}
                  fillHeight
                />
              </div>
            </Tabs.Panel>

            <Tabs.Panel value="adsets" className={classes.tablePanel}>
              <div className={classes.tablePanelInner}>
                {selectedCampaignId ? (
                  <AdSetTable
                    adSets={adSetsByCampaign[selectedCampaignId] ?? []}
                    loading={adsetsLoading}
                    onSelectAdSet={setSelectedAdSetId}
                    onOpenAdSet={handleOpenAdSet}
                    selectedAdSetId={selectedAdSetId}
                    platformColor={platformColor}
                    fillHeight
                  />
                ) : null}
              </div>
            </Tabs.Panel>

            <Tabs.Panel value="ads" className={classes.tablePanel}>
              <div className={classes.tablePanelInner}>
                {selectedAdSetId ? (
                  <AdsTable
                    ads={adsByAdset[selectedAdSetId] ?? []}
                    loading={adsLoading}
                    platformColor={platformColor}
                    fillHeight
                  />
                ) : null}
              </div>
            </Tabs.Panel>
          </div>
        </Tabs>
      </Card>
    </div>
  );
}
