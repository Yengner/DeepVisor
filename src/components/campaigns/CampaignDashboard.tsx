'use client';
import product from '@/components/product/Product.module.css';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  ActionIcon,
  Alert,
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
  IconAlertCircle,
  IconPhoto,
  IconSpeakerphone,
  IconStack2,
  IconChevronLeft,
  IconChevronRight,
  IconFilterOff,
  IconFileText,
  IconPlus,
  IconSearch,
} from '@tabler/icons-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import CampaignTable from './CampaignTable';
import AdSetTable from './AdSetTable';
import { activeDeliveryFirst, campaignTableSelection } from './delivery';
import AdsTable from './AdsTable';
import RunAgainSheet, { type RunAgainSource } from './RunAgainSheet';
import { EmptyCampaignState } from './EmptyStates';
import { RefreshOverview } from '@/app/(root)/dashboard/components/OverviewControls';
import type { AdLifetimeRow, AdSetLifetimeRow } from '@/lib/server/data';
import { TABLE_RANGES, type TableRange } from '@/lib/shared/performance/periodTotals';
import { MetricColumnsContext } from './tableKit';
import { useLabels } from '@/lib/client/hooks/useLabels';
import type { FormattedCampaign } from '@/app/(root)/campaigns/page';
import { fetchAdSetsForCampaign, fetchAdsForAdset } from '@/lib/server/data/queries/components.query';
import { formatRecordedCurrency as formatCurrencyAmount } from './metrics';
import { statusPresentation } from '@/components/product/presentation';
import classes from './CampaignDashboard.module.css';

type TabKey = 'campaigns' | 'adsets' | 'ads';

interface PlatformInfo {
  id: string;
  name: string;
}


interface CampaignDashboardProps {
  /** Saved plans and new-ad drafts for this account; a small button appears when above 0. */
  draftCount?: number;
  /** Period for every number on the page; changing it reloads the page data. */
  range?: TableRange;
  /** Last successful Meta sync for the account, shown on the refresh control. */
  syncedAt?: string | null;
  campaigns: FormattedCampaign[];
  deliveryState: { activeKeys: string[]; available: boolean };
  platform: PlatformInfo;
  adAccountId: string;
  currencyCode: string | null;
  accountTimezone?: string | null;
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

function formatCompactNumber(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  if (Math.abs(value) >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return Math.round(value).toLocaleString();
}

function campaignResults(campaign: FormattedCampaign): number {
  return Number(campaign.leads || 0) + Number(campaign.messages || 0) + Number(campaign.calls || 0);
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
    currencyCode,
    accountTimezone,
    initialSelection,
    initialAdSets,
    initialAds,
  } = props;
  const range: TableRange = props.range ?? 'lifetime';
  // "More metrics" is a per-browser preference; storage can be unavailable, so it is best-effort.
  const [allMetrics, setAllMetrics] = useState(false);
  useEffect(() => { try { setAllMetrics(window.localStorage.getItem('dv:campaigns:all-metrics') === '1'); } catch { /* default view */ } }, []);
  const toggleMetrics = () => setAllMetrics((current) => {
    try { window.localStorage.setItem('dv:campaigns:all-metrics', current ? '0' : '1'); } catch { /* not persisted */ }
    return !current;
  });

  const router = useRouter();
  const tCampaigns = useTranslations('campaigns');
  const t = useTranslations('table');
  const labels = useLabels();
  const tDrafts = useTranslations('drafts');
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const platformColor = getPlatformColor(platform.name);
  const isMetaPlatform = ['facebook', 'meta'].includes(platform.name.toLowerCase());
  const initialCampaignId = campaignTableSelection(campaigns,
    initialSelection?.tab && initialSelection.tab !== 'campaigns' ? initialSelection.campaignId : null);


  const [campaignData, setCampaignData] = useState(campaigns);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(
    initialCampaignId
  );
  const [selectedAdSetId, setSelectedAdSetId] = useState<string | null>(
    initialSelection?.tab !== 'campaigns' && initialCampaignId === initialSelection?.campaignId
      ? initialSelection?.adsetId ?? null : null
  );
  const [selectedAdId, setSelectedAdId] = useState<string | null>(null);
  const [reuseSource, setReuseSource] = useState<RunAgainSource | null>(null);
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

  const [adsetsLoading, setAdsetsLoading] = useState(false);
  const [adsLoading, setAdsLoading] = useState(false);

  const [drilldownError, setDrilldownError] = useState<{
    scope: 'adsets' | 'ads';
    message: string;
  } | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [deliveryFilter, setDeliveryFilter] = useState<'delivering' | 'not-delivering' | null>(null);
  const previousCampaignIdRef = useRef<string | null>(selectedCampaignId);

  const statuses = useMemo(
    () => Array.from(new Set(campaignData.map((campaign) => campaign.status?.toUpperCase()))).filter(Boolean),
    [campaignData]
  );

  const filteredCampaigns = useMemo(
    () =>
      activeDeliveryFirst(campaignData.filter((campaign) => {
        const matchesSearch =
          !searchQuery || campaign.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = !statusFilter || campaign.status?.toUpperCase() === statusFilter;
        const matchesDelivery = !deliveryFilter || (deliveryFilter === 'delivering') === Boolean(campaign.delivery);
        return matchesSearch && matchesStatus && matchesDelivery;
      })),
    [campaignData, searchQuery, statusFilter, deliveryFilter]
  );

  const selectedCampaign = useMemo(
    () => campaignData.find((campaign) => campaign.id === selectedCampaignId) ?? null,
    [campaignData, selectedCampaignId]
  );
  const activeKeys = new Set(props.deliveryState.activeKeys);
  const selectedCampaignAdSets = activeDeliveryFirst((selectedCampaignId ? adSetsByCampaign[selectedCampaignId] ?? [] : [])
    .map(row => ({ ...row, delivery: activeKeys.has(`adset:${row.id}`) })));
  const selectedAdSet = useMemo(
    () => selectedCampaignAdSets.find((adSet) => adSet.id === selectedAdSetId) ?? null,
    [selectedAdSetId, selectedCampaignAdSets]
  );
  const selectedAdSetAds = activeDeliveryFirst((selectedAdSetId ? adsByAdset[selectedAdSetId] ?? [] : [])
    .map(row => ({ ...row, delivery: activeKeys.has(`ad:${row.ad_id ?? row.id}`) })));
  const accountName = campaignData[0]?.accountName ?? t('selectedAccount');

  const accountSummary = useMemo(() => {
    const observed = campaignData.filter(c => c.metricsAvailable !== false);
    const totalResults = observed.length ? observed.reduce((sum, c) => sum + campaignResults(c), 0) : null;
    const activeCampaigns = campaignData.filter((campaign) => campaign.delivery).length;
    const spend = observed.length ? observed.reduce((sum, c) => sum + c.spend, 0) : null;
    // A lead, a conversation and a sale are different results: with several objectives, one blended
    // cost per result is misleading, so it is shown per objective instead.
    const byObjective = new Map<string, { spend: number; results: number }>();
    for (const c of observed) {
      const results = campaignResults(c);
      if (results <= 0 && c.spend <= 0) continue;
      const key = labels.objective(c.objective);
      const entry = byObjective.get(key) ?? { spend: 0, results: 0 };
      entry.spend += c.spend; entry.results += results;
      byObjective.set(key, entry);
    }
    const objectives = [...byObjective].map(([objective, v]) => ({ objective, results: v.results, costPerResult: v.results > 0 ? v.spend / v.results : null }))
      .sort((a, b) => b.results - a.results);
    const mixed = objectives.length > 1;
    const costPerResult = !mixed && totalResults && totalResults > 0 && spend !== null ? spend / totalResults : null;

    return {
      objectives,
      mixed,
      totalResults,
      activeCampaigns,
      pausedCampaigns: Math.max(campaignData.length - activeCampaigns, 0),
      costPerResult,
      spend,
    };
  }, [campaignData, labels]);

  const layerSummary = useMemo(() => {
    if (activeTab === 'adsets') {
      const spend = selectedCampaignAdSets.reduce((sum, item) => sum + Number(item.spend || 0), 0);
      const results = selectedCampaignAdSets.reduce(
        (sum, item) => sum + Number(item.leads || 0) + Number(item.messages || 0) + Number(item.calls || 0),
        0
      );

      return {
        layer: 'adsets' as const,
        count: selectedCampaignAdSets.length,
        spend: selectedCampaignAdSets.some(item => item.metricsAvailable !== false) ? spend : null,
        results: selectedCampaignAdSets.some(item => item.metricsAvailable !== false) ? results : null,
        createLabel: t('createAdSet'),
        createHref: selectedCampaignId
          ? `/campaigns/create?platform=${platform.id}&scope=adset&campaign_id=${selectedCampaignId}`
          : null,
      };
    }

    if (activeTab === 'ads') {
      const spend = selectedAdSetAds.reduce((sum, item) => sum + Number(item.spend || 0), 0);
      const results = selectedAdSetAds.reduce(
        (sum, item) => sum + Number(item.leads || 0) + Number(item.messages || 0) + Number(item.calls || 0),
        0
      );

      return {
        layer: 'ads' as const,
        count: selectedAdSetAds.length,
        spend: selectedAdSetAds.some(item => item.metricsAvailable !== false) ? spend : null,
        results: selectedAdSetAds.some(item => item.metricsAvailable !== false) ? results : null,
        createLabel: t('createAd'),
        createHref: selectedAdSetId
          ? `/campaigns/create?platform=${platform.id}&scope=ad&campaign_id=${selectedCampaignId ?? ''}&adset_id=${selectedAdSetId}`
          : null,
      };
    }

    const spend = filteredCampaigns.reduce((sum, item) => sum + Number(item.spend || 0), 0);
    const results = filteredCampaigns.reduce((sum, item) => sum + campaignResults(item), 0);

    return {
      layer: 'campaigns' as const,
      count: filteredCampaigns.length,
      spend: filteredCampaigns.some(item => item.metricsAvailable !== false) ? spend : null,
      results: filteredCampaigns.some(item => item.metricsAvailable !== false) ? results : null,
      createLabel: t('createCampaign'),
      createHref: `/campaigns/create?platform=${platform.id}`,
    };
  }, [
    t,
    activeTab,
    filteredCampaigns,
    platform.id,
    selectedAdSetAds,
    selectedAdSetId,
    selectedCampaignAdSets,
    selectedCampaignId,
  ]);

  useEffect(() => {
    if (!selectedCampaignId && activeTab !== 'campaigns') setActiveTab('campaigns');
    if (!selectedAdSetId && activeTab === 'ads') setActiveTab('adsets');
  }, [selectedCampaignId, selectedAdSetId, activeTab]);

  useEffect(() => {
    setCampaignData(campaigns);
  }, [campaigns]);

  useEffect(() => {
    setSelectedCampaignId(current => campaignTableSelection(filteredCampaigns, current));
  }, [filteredCampaigns]);

  useEffect(() => {
    const sp = new URLSearchParams(searchParams?.toString());
    sp.delete('campaign_id');
    sp.delete('adset_id');
    sp.delete('tab');

    if (selectedCampaignId) sp.set('campaign_id', selectedCampaignId);
    if (selectedAdSetId) sp.set('adset_id', selectedAdSetId);
    if (activeTab) sp.set('tab', activeTab);

    const query = sp.toString();
    // These selections are already loaded by the scoped drilldown actions. Avoid
    // a second server navigation competing with those actions on every click.
    window.history.replaceState(null, '', query ? `${pathname}?${query}` : pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCampaignId, selectedAdSetId, activeTab]);

  useEffect(() => {
    if (previousCampaignIdRef.current === selectedCampaignId) {
      return;
    }

    previousCampaignIdRef.current = selectedCampaignId;
    setSelectedAdSetId(null);
    setSelectedAdId(null);
  }, [selectedCampaignId]);

  useEffect(() => {
    setSelectedAdId(null);
  }, [selectedAdSetId]);

  useEffect(() => {
    if (activeTab !== 'adsets') return;
    if (!selectedCampaignId) return;
    setDrilldownError((current) => (current?.scope === 'adsets' ? null : current));
    if (adSetsByCampaign[selectedCampaignId]) {
      setAdsetsLoading(false);
      return;
    }

    let cancelled = false;
    setAdsetsLoading(true);

    void (async () => {
      try {
        const rows = await fetchAdSetsForCampaign(adAccountId, selectedCampaignId, range);

        if (cancelled) {
          return;
        }

        setAdSetsByCampaign((previous) => ({ ...previous, [selectedCampaignId]: rows || [] }));
      } catch (error) {
        console.error('Error loading campaign ad sets:', error);
        if (!cancelled) {
          setDrilldownError({
            scope: 'adsets',
            message: t('adSetsError'),
          });
        }
      } finally {
        if (!cancelled) {
          setAdsetsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeTab, selectedCampaignId, adAccountId, adSetsByCampaign, range, t]);

  useEffect(() => {
    if (activeTab !== 'ads') return;
    if (!selectedAdSetId) return;
    setDrilldownError((current) => (current?.scope === 'ads' ? null : current));
    if (adsByAdset[selectedAdSetId]) {
      setAdsLoading(false);
      return;
    }

    let cancelled = false;
    setAdsLoading(true);

    void (async () => {
      try {
        const rows = await fetchAdsForAdset(adAccountId, selectedAdSetId, range);

        if (cancelled) {
          return;
        }

        setAdsByAdset((previous) => ({ ...previous, [selectedAdSetId]: rows || [] }));
      } catch (error) {
        console.error('Error loading ad set ads:', error);
        if (!cancelled) {
          setDrilldownError({
            scope: 'ads',
            message: t('adsError'),
          });
        }
      } finally {
        if (!cancelled) {
          setAdsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeTab, selectedAdSetId, adAccountId, adsByAdset, range, t]);

  const handleOpenCampaign = (campaignId: string) => {
    setSelectedCampaignId(campaignId);
    setActiveTab('adsets');
  };

  const handleOpenAdSet = (adSetId: string) => {
    setSelectedAdSetId(adSetId);
    setActiveTab('ads');
  };

  const handleRunAdSet = (adSet: AdSetLifetimeRow) => {
    setReuseSource({
      sourceType: 'adset',
      campaignId: adSet.campaign_id,
      adSetId: adSet.id,
      name: adSet.name,
      campaignName: adSet.campaign_name,
      status: adSet.status,
      objective: adSet.objective || adSet.optimization_goal || undefined,
      spend: Number(adSet.spend || 0),
      results: Number(adSet.leads || 0) + Number(adSet.messages || 0) + Number(adSet.calls || 0),
      ctr: adSet.ctr != null && Number.isFinite(Number(adSet.ctr)) ? Number(adSet.ctr) : null,
      activityStart: adSet.start_date,
      activityEnd: adSet.end_date,
      creativeAvailable: false,
    });
  };

  const handleRunAd = (ad: AdLifetimeRow) => {
    const adId = ad.ad_id ?? ad.id;
    const parentCampaign = campaignData.find((campaign) => campaign.id === ad.campaign_id);
    const parentAdSet = selectedAdSet?.id === ad.adset_id ? selectedAdSet : null;

    setReuseSource({
      sourceType: 'ad',
      campaignId: ad.campaign_id,
      adSetId: ad.adset_id,
      adId,
      name: ad.name || t('unnamedAd'),
      campaignName: ad.campaign_name,
      adSetName: ad.adset_name,
      status: ad.status,
      objective: parentAdSet?.objective || parentAdSet?.optimization_goal || parentCampaign?.objective,
      spend: Number(ad.spend || 0),
      results: Number(ad.leads || 0) + Number(ad.messages || 0) + Number(ad.calls || 0),
      ctr: ad.ctr != null && Number.isFinite(Number(ad.ctr)) ? Number(ad.ctr) : null,
      activityStart: ad.start_date,
      activityEnd: ad.end_date,
      creativeAvailable: Boolean(ad.creative_id),
    });
  };

  const resetFilters = () => {
    setSearchQuery('');
    setStatusFilter(null);
    setDeliveryFilter(null);
  };

  if (campaignData.length === 0) {
    return <EmptyCampaignState type="campaigns" platformName={platform.name} />;
  }

  return (
    <div className={`${classes.pageShell} ${product.page} campaigns-page-shell`}>
      <Card withBorder radius="xl" p={0} className={classes.tableSurface}>
        {drilldownError?.scope === activeTab ? (
          <Alert
            color="red"
            icon={<IconAlertCircle size={16} />}
            radius={0}
            className={classes.feedback}
            withCloseButton
            closeButtonLabel={t('dismissError')}
            onClose={() => setDrilldownError(null)}
          >
            {drilldownError.message}
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
          <div className={classes.tableHeader} data-drilled={activeTab !== 'campaigns' || undefined}>
            <Group justify="space-between" align="flex-start" gap="md" wrap="wrap">
              <div className={classes.titleBlock}>
                <Title order={1} className={classes.title}>
                  {t('title')}
                </Title>
                <Text className={classes.subtitle}>
                  <span className={classes.platformName}>{platform.name}</span> · {accountName}
                </Text>
                <section className={classes.summaryBlock} aria-labelledby="campaigns-summary-caption">
                  <div className={classes.summaryHead}>
                    <p id="campaigns-summary-caption" className={classes.summaryCaption}>{t('accountCaption', { range: t(`caption.${range}`) })}</p>
                    <div className={classes.rangeSwitch} role="group" aria-label={t('period')}>
                      {TABLE_RANGES.map((key) => (
                        <button
                          key={key}
                          type="button"
                          aria-pressed={range === key}
                          onClick={() => {
                            if (key === range) return;
                            const next = new URLSearchParams(searchParams.toString());
                            if (key === 'lifetime') next.delete('range'); else next.set('range', key);
                            router.push(`${pathname}${next.size ? `?${next}` : ''}`, { scroll: false });
                          }}
                        >
                          {t(`range.${key}`)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className={classes.summary}>
                    <div className={classes.summaryTile} data-tile="spend"><span className={classes.tileLabel}>{t('metric.spend')}</span><span className={classes.tileValue}>{accountSummary.spend === null ? '—' : formatCurrencyAmount(accountSummary.spend, currencyCode)}</span></div>
                    <div className={classes.summaryTile} data-tile="results"><span className={classes.tileLabel}>{t('metric.results')}</span><span className={classes.tileValue}>{formatCompactNumber(accountSummary.totalResults)}</span>{accountSummary.mixed && <span className={classes.tileNote}>{accountSummary.objectives.map(o => `${o.objective} ${formatCompactNumber(o.results)}`).join(' · ')}</span>}</div>
                    {accountSummary.mixed ? (
                      <div className={classes.summaryTile} data-tile="cost-mixed" title={t('mixedHint')}>
                        <span className={classes.tileLabel}>{t('costByObjective')}</span>
                        <span className={classes.tileObjectives}>{accountSummary.objectives.map(o => <span key={o.objective}><b>{o.costPerResult === null ? '—' : formatCurrencyAmount(o.costPerResult, currencyCode)}</b> {o.objective}</span>)}</span>
                      </div>
                    ) : (
                      <div className={classes.summaryTile} data-tile="cost"><span className={classes.tileLabel}>{t('metric.costPerResult')}</span><span className={classes.tileValue}>{accountSummary.costPerResult === null ? '—' : formatCurrencyAmount(accountSummary.costPerResult, currencyCode)}</span></div>
                    )}
                    {([['delivering', t('delivering'), accountSummary.activeCampaigns], ['not-delivering', t('notDelivering'), accountSummary.pausedCampaigns]] as const).map(([key, label, count]) => (
                      <button
                        key={key}
                        type="button"
                        className={classes.summaryTile}
                        data-tile={key}
                        data-filter
                        aria-pressed={deliveryFilter === key}
                        disabled={!props.deliveryState.available}
                        title={deliveryFilter === key ? t('showAll') : t('showOnly', { key: key === 'delivering' ? 'delivering' : 'not' })}
                        onClick={() => {
                          setDeliveryFilter((current) => (current === key ? null : key));
                          setActiveTab('campaigns');
                        }}
                      >
                        <span className={classes.tileLabel}>{label}</span>
                        <span className={classes.tileValue}>{props.deliveryState.available ? count : '—'}</span>
                      </button>
                    ))}
                  </div>
                </section>
              </div>

              <Group gap="sm" wrap="wrap" className={classes.actionGroup}>
                {activeTab === 'campaigns' ? (
                  <>
                    {props.draftCount ? (
                      <Button radius="xl" variant="subtle" data-action="drafts" leftSection={<IconFileText size={16} />} onClick={() => router.push('/campaigns/drafts')}>
                        {tDrafts('button', { count: props.draftCount })}
                      </Button>
                    ) : null}
                    <Button radius="xl" variant="default" data-action="quick" onClick={() => router.push('/campaigns/quick')}>
                      {tCampaigns('quickAd')}
                    </Button>
                    <Button
                      leftSection={<IconPlus size={16} />}
                      radius="xl"
                      data-action="create"
                      className="app-platform-page-action-primary"
                      onClick={() => router.push(`/campaigns/create?platform=${platform.id}`)}
                    >
                      {t('createCampaign')}
                    </Button>
                  </>
                ) : (
                  <Button
                    leftSection={<IconPlus size={16} />}
                    radius="xl"
                    data-action="create"
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

                <div data-action="refresh">
                  <RefreshOverview label={t('refreshLabel')} updatedAt={props.syncedAt ?? null} onCompleted={() => {
                    setAdSetsByCampaign({});
                    setAdsByAdset({});
                  }} />
                </div>
              </Group>
            </Group>

            <Group justify="space-between" align="center" gap="md" wrap="wrap" mt="md">
              <Tabs.List>
                <Tabs.Tab value="campaigns" leftSection={<IconSpeakerphone size={14} />}>
                  {t('tab.campaigns')}
                </Tabs.Tab>
                <Tooltip label={t('tabAdSetsHint')} disabled={Boolean(selectedCampaignId)} withinPortal>
                  <Tabs.Tab value="adsets" leftSection={<IconStack2 size={14} />} disabled={!selectedCampaignId}>
                    {t('tab.adSets')}
                  </Tabs.Tab>
                </Tooltip>
                <Tooltip label={t('tabAdsHint')} disabled={Boolean(selectedAdSetId)} withinPortal>
                  <Tabs.Tab value="ads" leftSection={<IconPhoto size={14} />} disabled={!selectedAdSetId}>
                    {t('tab.ads')}
                  </Tabs.Tab>
                </Tooltip>
              </Tabs.List>

              <Group gap="sm" wrap="nowrap" className={classes.layerBar}>
              <Button variant={allMetrics ? 'light' : 'subtle'} size="xs" radius="xl" onClick={toggleMetrics} aria-pressed={allMetrics} className={classes.metricsToggle}>
                {allMetrics ? t('fewerMetrics') : t('moreMetrics')}
              </Button>
              <Text size="sm" c="dimmed" className={classes.layerSummary} aria-live="polite">
                {(activeTab === 'adsets' && adsetsLoading) || (activeTab === 'ads' && adsLoading) ? t('loadingShort') : (<>
                {t.rich('count', { layer: layerSummary.layer, count: layerSummary.count, b: chunks => <strong>{chunks}</strong> })}
                {activeTab !== 'campaigns' && layerSummary.spend !== null ? (
                  t('layerTotals', { spend: formatCurrencyAmount(layerSummary.spend, currencyCode), results: formatCompactNumber(layerSummary.results) })
                ) : null}
                </>)}
              </Text>
              </Group>
            </Group>

            {activeTab !== 'campaigns' ? (
              <nav aria-label={t('drillPath')} className={classes.breadcrumb}>
                <button type="button" onClick={() => setActiveTab('campaigns')}>
                  <IconChevronLeft size={14} aria-hidden="true" /> {t('allCampaigns')}
                </button>
                {selectedCampaign ? (
                  <>
                    <IconChevronRight size={14} aria-hidden="true" className={classes.crumbSep} />
                    {activeTab === 'ads' ? (
                      <button type="button" onClick={() => setActiveTab('adsets')} title={selectedCampaign.name}>
                        {selectedCampaign.name}
                      </button>
                    ) : (
                      <span aria-current="page" title={selectedCampaign.name}>{selectedCampaign.name}</span>
                    )}
                  </>
                ) : null}
                {activeTab === 'ads' && selectedAdSet ? (
                  <>
                    <IconChevronRight size={14} aria-hidden="true" className={classes.crumbSep} />
                    <span aria-current="page" title={selectedAdSet.name}>{selectedAdSet.name}</span>
                  </>
                ) : null}
              </nav>
            ) : null}

            {activeTab === 'campaigns' ? (
              <Group gap="sm" mt="md" className={classes.filterBar}>
                <TextInput
                  placeholder={t('search')}
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.currentTarget.value)}
                  leftSection={<IconSearch size={14} />}
                  className={classes.searchInput}
                  size="sm"
                />
                <Select
                  placeholder={t('allStatuses')}
                  aria-label={t('filterStatus')}
                  value={statusFilter}
                  onChange={setStatusFilter}
                  data={statuses.map((status) => ({ value: status, label: labels.status(statusPresentation(status).label) }))}
                  clearable
                  leftSection={<IconAdjustments size={14} />}
                  className={classes.filterSelect}
                  size="sm"
                />
                {searchQuery || statusFilter || deliveryFilter ? (
                  <Tooltip label={t('clearFilters')}>
                    <ActionIcon onClick={resetFilters} variant="subtle" size="lg" radius="xl">
                      <IconFilterOff size={16} />
                    </ActionIcon>
                  </Tooltip>
                ) : null}
              </Group>
            ) : null}
          </div>

          <div className={classes.tableBody}>
            {/* The delivering rule lives in the Status column's ⓘ; only an outage is worth a line here. */}
            {!props.deliveryState.available ? (
              <p className={classes.legend} role="status">{t('deliveryUnavailable')}</p>
            ) : null}
            <MetricColumnsContext.Provider value={allMetrics}>
            <Tabs.Panel value="campaigns" className={classes.tablePanel}>
              <div className={classes.tablePanelInner}>
                <CampaignTable
                  campaigns={filteredCampaigns}
                  selectedCampaignId={selectedCampaignId ?? undefined}
                  onSelectCampaign={setSelectedCampaignId}
                  onOpenCampaign={handleOpenCampaign}
                  platformIntegrationId={platform.id}
                  adAccountId={adAccountId}
                  currencyCode={currencyCode}
                  platformColor={platformColor}
                  timezone={accountTimezone}
                  range={range}
                />
              </div>
            </Tabs.Panel>

            <Tabs.Panel value="adsets" className={classes.tablePanel}>
              <div className={classes.tablePanelInner}>
                {selectedCampaignId ? (
                  <AdSetTable
                    adSets={selectedCampaignAdSets}
                    loading={adsetsLoading}
                    onSelectAdSet={setSelectedAdSetId}
                    onOpenAdSet={handleOpenAdSet}
                    onRunAgain={isMetaPlatform ? handleRunAdSet : undefined}
                    selectedAdSetId={selectedAdSetId}
                    platformIntegrationId={platform.id}
                    adAccountId={adAccountId}
                    currencyCode={currencyCode}
                    platformColor={platformColor}
                    timezone={accountTimezone}
                    range={range}
                  />
                ) : null}
              </div>
            </Tabs.Panel>

            <Tabs.Panel value="ads" className={classes.tablePanel}>
              <div className={classes.tablePanelInner}>
                {selectedAdSetId ? (
                  <AdsTable
                    ads={selectedAdSetAds}
                    loading={adsLoading}
                    selectedAdId={selectedAdId}
                    onSelectAd={setSelectedAdId}
                    onRunAgain={isMetaPlatform ? handleRunAd : undefined}
                    platformIntegrationId={platform.id}
                    adAccountId={adAccountId}
                    currencyCode={currencyCode}
                    platformColor={platformColor}
                    timezone={accountTimezone}
                    range={range}
                  />
                ) : null}
              </div>
            </Tabs.Panel>
            </MetricColumnsContext.Provider>
            <p className={classes.tableFooter} aria-hidden="true">
              {t('countPlain', { layer: layerSummary.layer, count: layerSummary.count })}
              {t('delivering_count', { count: (activeTab === 'campaigns' ? filteredCampaigns : activeTab === 'adsets' ? selectedCampaignAdSets : selectedAdSetAds).filter((row) => row.delivery).length })}
            </p>
          </div>
        </Tabs>
      </Card>
      <RunAgainSheet
        opened={Boolean(reuseSource)}
        source={reuseSource}
        currencyCode={currencyCode}
        accountTimezone={accountTimezone}
        onClose={() => setReuseSource(null)}
      />
    </div>
  );
}
