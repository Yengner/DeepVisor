import type {
  ReportBreakdownChartPoint,
  ReportBreakdownRow,
  ReportFilterOptions,
  ReportGroupBy,
  ReportKpi,
  ReportMetricTotals,
  ReportPayload,
  ReportQueryInput,
  ReportScope,
  ReportTimeSeriesPoint,
} from './types';

type DemoPlatform = {
  id: string;
  label: string;
};

type DemoAdAccount = {
  id: string;
  label: string;
  parentId: string;
};

type DemoCampaign = {
  id: string;
  label: string;
  parentId: string;
  objective: string;
  status: string;
};

type DemoAdset = {
  id: string;
  label: string;
  parentId: string;
  audience: string;
  status: string;
};

type DemoAd = {
  id: string;
  label: string;
  parentId: string;
  platformId: string;
  adAccountId: string;
  campaignId: string;
  segment: 'retargeting' | 'prospecting' | 'search';
  spendBase: number;
  ctrBase: number;
  conversionRateBase: number;
  impressionsPerDollar: number;
  frequencyBase: number;
  trend: number;
  phase: number;
  volatility: number;
  note: string;
  status: string;
};

type DemoRawTotals = Pick<
  ReportMetricTotals,
  | 'spend'
  | 'reach'
  | 'impressions'
  | 'clicks'
  | 'linkClicks'
  | 'leads'
  | 'messages'
  | 'calls'
  | 'conversion'
>;

const DAY_MS = 24 * 60 * 60 * 1000;

const DEMO_PLATFORMS: DemoPlatform[] = [
  { id: 'demo-platform-meta', label: 'Meta' },
  { id: 'demo-platform-google', label: 'Google Ads' },
];

const DEMO_AD_ACCOUNTS: DemoAdAccount[] = [
  { id: 'demo-account-meta-main', label: 'DeepVisor Lead Engine', parentId: 'demo-platform-meta' },
  { id: 'demo-account-meta-local', label: 'Neighborhood Growth', parentId: 'demo-platform-meta' },
  { id: 'demo-account-google-search', label: 'High Intent Search', parentId: 'demo-platform-google' },
];

const DEMO_CAMPAIGNS: DemoCampaign[] = [
  {
    id: 'demo-campaign-retargeting',
    label: 'Retargeting Lift Q2',
    parentId: 'demo-account-meta-main',
    objective: 'Lead generation',
    status: 'ACTIVE',
  },
  {
    id: 'demo-campaign-prospecting',
    label: 'Prospecting Spring Push',
    parentId: 'demo-account-meta-main',
    objective: 'Top-of-funnel acquisition',
    status: 'ACTIVE',
  },
  {
    id: 'demo-campaign-local-offer',
    label: 'Local Offer Push',
    parentId: 'demo-account-meta-local',
    objective: 'Offer conversion',
    status: 'ACTIVE',
  },
  {
    id: 'demo-campaign-search-capture',
    label: 'Search Capture',
    parentId: 'demo-account-google-search',
    objective: 'High-intent search demand',
    status: 'ACTIVE',
  },
];

const DEMO_ADSETS: DemoAdset[] = [
  {
    id: 'demo-adset-warm-visitors',
    label: 'Warm site visitors',
    parentId: 'demo-campaign-retargeting',
    audience: 'Retargeting pool · 30-day visitors',
    status: 'ACTIVE',
  },
  {
    id: 'demo-adset-reopened-leads',
    label: 'Lead form reopeners',
    parentId: 'demo-campaign-retargeting',
    audience: 'Warm leads who opened but did not submit',
    status: 'ACTIVE',
  },
  {
    id: 'demo-adset-broad-homeowners',
    label: 'Broad homeowners',
    parentId: 'demo-campaign-prospecting',
    audience: 'Broad prospecting with home-interest signals',
    status: 'ACTIVE',
  },
  {
    id: 'demo-adset-lookalike-past-leads',
    label: 'Past lead lookalike',
    parentId: 'demo-campaign-prospecting',
    audience: 'Lookalike of recent qualified leads',
    status: 'ACTIVE',
  },
  {
    id: 'demo-adset-local-offer-radius',
    label: '10-mile offer radius',
    parentId: 'demo-campaign-local-offer',
    audience: 'Local offer audience around the storefront',
    status: 'ACTIVE',
  },
  {
    id: 'demo-adset-brand-search',
    label: 'Brand + service terms',
    parentId: 'demo-campaign-search-capture',
    audience: 'High-intent search queries',
    status: 'ACTIVE',
  },
];

const DEMO_ADS: DemoAd[] = [
  {
    id: 'demo-ad-offer-refresh',
    label: 'Offer refresh - free estimate',
    parentId: 'demo-adset-warm-visitors',
    platformId: 'demo-platform-meta',
    adAccountId: 'demo-account-meta-main',
    campaignId: 'demo-campaign-retargeting',
    segment: 'retargeting',
    spendBase: 84,
    ctrBase: 0.031,
    conversionRateBase: 0.145,
    impressionsPerDollar: 122,
    frequencyBase: 1.9,
    trend: 0.0045,
    phase: 0.2,
    volatility: 0.07,
    note: 'Strong warm-audience offer angle',
    status: 'ACTIVE',
  },
  {
    id: 'demo-ad-testimonial',
    label: 'Testimonial cut - social proof',
    parentId: 'demo-adset-warm-visitors',
    platformId: 'demo-platform-meta',
    adAccountId: 'demo-account-meta-main',
    campaignId: 'demo-campaign-retargeting',
    segment: 'retargeting',
    spendBase: 68,
    ctrBase: 0.028,
    conversionRateBase: 0.132,
    impressionsPerDollar: 118,
    frequencyBase: 2.0,
    trend: 0.0035,
    phase: 1.1,
    volatility: 0.06,
    note: 'Consistent proof-based creative',
    status: 'ACTIVE',
  },
  {
    id: 'demo-ad-reopener',
    label: 'Reminder hook - finish your request',
    parentId: 'demo-adset-reopened-leads',
    platformId: 'demo-platform-meta',
    adAccountId: 'demo-account-meta-main',
    campaignId: 'demo-campaign-retargeting',
    segment: 'retargeting',
    spendBase: 52,
    ctrBase: 0.026,
    conversionRateBase: 0.118,
    impressionsPerDollar: 126,
    frequencyBase: 2.2,
    trend: 0.0028,
    phase: 0.7,
    volatility: 0.05,
    note: 'Warm recovery audience',
    status: 'ACTIVE',
  },
  {
    id: 'demo-ad-benefit-hook',
    label: 'Benefit hook - save time',
    parentId: 'demo-adset-broad-homeowners',
    platformId: 'demo-platform-meta',
    adAccountId: 'demo-account-meta-main',
    campaignId: 'demo-campaign-prospecting',
    segment: 'prospecting',
    spendBase: 92,
    ctrBase: 0.014,
    conversionRateBase: 0.045,
    impressionsPerDollar: 165,
    frequencyBase: 1.55,
    trend: -0.0025,
    phase: 1.8,
    volatility: 0.09,
    note: 'High spend but fatiguing creative',
    status: 'ACTIVE',
  },
  {
    id: 'demo-ad-proof-angle',
    label: 'Proof angle - before and after',
    parentId: 'demo-adset-broad-homeowners',
    platformId: 'demo-platform-meta',
    adAccountId: 'demo-account-meta-main',
    campaignId: 'demo-campaign-prospecting',
    segment: 'prospecting',
    spendBase: 88,
    ctrBase: 0.013,
    conversionRateBase: 0.039,
    impressionsPerDollar: 171,
    frequencyBase: 1.48,
    trend: -0.002,
    phase: 2.6,
    volatility: 0.08,
    note: 'Broad audience with declining response',
    status: 'ACTIVE',
  },
  {
    id: 'demo-ad-lookalike-winner',
    label: 'Lead story - qualified consult',
    parentId: 'demo-adset-lookalike-past-leads',
    platformId: 'demo-platform-meta',
    adAccountId: 'demo-account-meta-main',
    campaignId: 'demo-campaign-prospecting',
    segment: 'prospecting',
    spendBase: 71,
    ctrBase: 0.021,
    conversionRateBase: 0.081,
    impressionsPerDollar: 152,
    frequencyBase: 1.64,
    trend: 0.0018,
    phase: 0.9,
    volatility: 0.07,
    note: 'Best of the cold-audience set',
    status: 'ACTIVE',
  },
  {
    id: 'demo-ad-local-offer',
    label: 'Local offer - same week appointment',
    parentId: 'demo-adset-local-offer-radius',
    platformId: 'demo-platform-meta',
    adAccountId: 'demo-account-meta-local',
    campaignId: 'demo-campaign-local-offer',
    segment: 'retargeting',
    spendBase: 57,
    ctrBase: 0.024,
    conversionRateBase: 0.086,
    impressionsPerDollar: 138,
    frequencyBase: 1.72,
    trend: 0.0015,
    phase: 2.1,
    volatility: 0.06,
    note: 'Local radius offer with steady conversion',
    status: 'ACTIVE',
  },
  {
    id: 'demo-ad-search-emergency',
    label: 'Emergency service search ad',
    parentId: 'demo-adset-brand-search',
    platformId: 'demo-platform-google',
    adAccountId: 'demo-account-google-search',
    campaignId: 'demo-campaign-search-capture',
    segment: 'search',
    spendBase: 64,
    ctrBase: 0.058,
    conversionRateBase: 0.122,
    impressionsPerDollar: 49,
    frequencyBase: 1.18,
    trend: 0.003,
    phase: 1.5,
    volatility: 0.04,
    note: 'Very high-intent demand capture',
    status: 'ACTIVE',
  },
];

const EMPTY_RAW_TOTALS: DemoRawTotals = {
  spend: 0,
  reach: 0,
  impressions: 0,
  clicks: 0,
  linkClicks: 0,
  leads: 0,
  messages: 0,
  calls: 0,
  conversion: 0,
};

const PLATFORM_BY_ID = new Map(DEMO_PLATFORMS.map((item) => [item.id, item]));
const AD_ACCOUNT_BY_ID = new Map(DEMO_AD_ACCOUNTS.map((item) => [item.id, item]));
const CAMPAIGN_BY_ID = new Map(DEMO_CAMPAIGNS.map((item) => [item.id, item]));
const ADSET_BY_ID = new Map(DEMO_ADSETS.map((item) => [item.id, item]));
const AD_BY_ID = new Map(DEMO_ADS.map((item) => [item.id, item]));

function toUtcDate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundMetric(value: number): number {
  return Number(value.toFixed(2));
}

function createEmptyRawTotals(): DemoRawTotals {
  return { ...EMPTY_RAW_TOTALS };
}

function addRawTotals(target: DemoRawTotals, source: DemoRawTotals): DemoRawTotals {
  target.spend += source.spend;
  target.reach += source.reach;
  target.impressions += source.impressions;
  target.clicks += source.clicks;
  target.linkClicks += source.linkClicks;
  target.leads += source.leads;
  target.messages += source.messages;
  target.calls += source.calls;
  target.conversion += source.conversion;
  return target;
}

function finalizeTotals(raw: DemoRawTotals): ReportMetricTotals {
  const ctr = raw.impressions > 0 ? (raw.clicks / raw.impressions) * 100 : 0;
  const cpc = raw.clicks > 0 ? raw.spend / raw.clicks : 0;
  const cpm = raw.impressions > 0 ? (raw.spend / raw.impressions) * 1000 : 0;
  const costPerResult = raw.conversion > 0 ? raw.spend / raw.conversion : raw.spend;
  const conversionRate = raw.clicks > 0 ? (raw.conversion / raw.clicks) * 100 : 0;
  const frequency = raw.reach > 0 ? raw.impressions / raw.reach : 0;

  return {
    ...raw,
    spend: roundMetric(raw.spend),
    ctr: roundMetric(ctr),
    cpc: roundMetric(cpc),
    cpm: roundMetric(cpm),
    costPerResult: roundMetric(costPerResult),
    conversionRate: roundMetric(conversionRate),
    frequency: roundMetric(frequency),
  };
}

function enumerateDates(dateFrom: string, dateTo: string): string[] {
  const values: string[] = [];
  let current = toUtcDate(dateFrom);
  const end = toUtcDate(dateTo);

  while (current.getTime() <= end.getTime()) {
    values.push(toIsoDate(current));
    current = addDays(current, 1);
  }

  return values;
}

function getPreviousPeriodRange(query: ReportQueryInput) {
  const start = toUtcDate(query.dateFrom);
  const end = toUtcDate(query.dateTo);
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1);
  const previousEnd = addDays(start, -1);
  const previousStart = addDays(previousEnd, -(days - 1));

  return {
    dateFrom: toIsoDate(previousStart),
    dateTo: toIsoDate(previousEnd),
  };
}

function formatDateRange(dateFrom: string, dateTo: string): string {
  const start = toUtcDate(dateFrom);
  const end = toUtcDate(dateTo);

  return `${start.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })} - ${end.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })}`;
}

function formatCurrency(value: number, currencyCode: string | null, digits = 0): string {
  if (!currencyCode || currencyCode === 'MIXED') {
    return digits === 0 ? Math.round(value).toLocaleString('en-US') : value.toFixed(digits);
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function formatKpiValue(key: ReportKpi['key'], value: number, currencyCode: string | null): string {
  switch (key) {
    case 'spend':
    case 'cpc':
    case 'cpm':
    case 'costPerResult':
      return formatCurrency(value, currencyCode, key === 'spend' ? 0 : 2);
    case 'ctr':
      return `${value.toFixed(2)}%`;
    default:
      return value.toLocaleString('en-US');
  }
}

function calculateDeltaPercent(current: number, previous: number | null): number | null {
  if (previous == null) {
    return null;
  }

  if (previous === 0) {
    return current === 0 ? 0 : 100;
  }

  return roundMetric(((current - previous) / previous) * 100);
}

function buildKpis(
  summary: ReportMetricTotals,
  previousTotals: ReportMetricTotals | null,
  currencyCode: string | null
): ReportKpi[] {
  const definitions: Array<{ key: ReportKpi['key']; label: string }> = [
    { key: 'spend', label: 'Spend' },
    { key: 'conversion', label: 'Results' },
    { key: 'impressions', label: 'Impressions' },
    { key: 'clicks', label: 'Clicks' },
    { key: 'ctr', label: 'CTR' },
    { key: 'cpc', label: 'CPC' },
    { key: 'cpm', label: 'CPM' },
    { key: 'costPerResult', label: 'Cost / Result' },
  ];

  return definitions.map((definition) => ({
    key: definition.key,
    label: definition.label,
    value: summary[definition.key],
    formattedValue: formatKpiValue(definition.key, summary[definition.key], currencyCode),
    deltaPercent: calculateDeltaPercent(
      summary[definition.key],
      previousTotals ? previousTotals[definition.key] : null
    ),
  }));
}

function createBucketStart(date: Date, groupBy: ReportGroupBy): Date {
  const next = new Date(date);

  if (groupBy === 'day') {
    return next;
  }

  if (groupBy === 'week') {
    const weekday = (next.getUTCDay() + 6) % 7;
    return addDays(next, -weekday);
  }

  return new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth(), 1));
}

function createBucketEnd(start: Date, groupBy: ReportGroupBy): Date {
  if (groupBy === 'day') {
    return start;
  }

  if (groupBy === 'week') {
    return addDays(start, 6);
  }

  return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0));
}

function createBucketLabel(start: Date, end: Date, groupBy: ReportGroupBy): string {
  if (groupBy === 'day') {
    return start.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    });
  }

  if (groupBy === 'week') {
    return `${start.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    })} - ${end.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    })}`;
  }

  return start.toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function generateAdDailyRaw(ad: DemoAd, isoDate: string): DemoRawTotals {
  const date = toUtcDate(isoDate);
  const absoluteDay = Math.floor(date.getTime() / DAY_MS);
  const weekdayFactor = [0.82, 1.02, 1.08, 1.04, 1.11, 0.94, 0.8][date.getUTCDay()] ?? 1;
  const seasonalFactor = 1 + Math.sin(absoluteDay / 5 + ad.phase) * ad.volatility;
  const trendOffset = (absoluteDay % 45) - 22;
  const trendFactor = 1 + ad.trend * trendOffset;
  const retargetingLift =
    ad.segment === 'retargeting' && isoDate >= '2026-03-18' && isoDate <= '2026-04-10' ? 1.14 : 1;
  const prospectingFatigue =
    ad.segment === 'prospecting' && isoDate >= '2026-03-24' ? 0.84 : 1;
  const searchIntentLift =
    ad.segment === 'search' && date.getUTCDay() >= 1 && date.getUTCDay() <= 4 ? 1.08 : 0.98;

  const spend = Math.max(
    18,
    ad.spendBase * weekdayFactor * seasonalFactor * trendFactor * retargetingLift * prospectingFatigue * searchIntentLift
  );
  const impressions = Math.max(
    300,
    Math.round(spend * ad.impressionsPerDollar * (0.94 + Math.cos(absoluteDay / 6 + ad.phase) * 0.05))
  );
  const ctrDecimal = clamp(
    ad.ctrBase *
      (0.96 + Math.sin(absoluteDay / 7 + ad.phase) * 0.16) *
      (retargetingLift > 1 ? 1.05 : 1) *
      (prospectingFatigue < 1 ? 0.92 : 1),
    0.006,
    0.08
  );
  const clicks = Math.max(0, Math.round(impressions * ctrDecimal));
  const linkClicks = Math.max(0, Math.round(clicks * 0.79));
  const conversionRate = clamp(
    ad.conversionRateBase *
      (0.95 + Math.cos(absoluteDay / 8 + ad.phase) * 0.11) *
      (retargetingLift > 1 ? 1.08 : 1) *
      (prospectingFatigue < 1 ? 0.8 : 1),
    0.012,
    0.28
  );
  const conversion = Math.max(0, Math.round(clicks * conversionRate));
  const leads = ad.segment === 'search' ? Math.round(conversion * 0.9) : conversion;
  const messages =
    ad.segment === 'retargeting'
      ? Math.round(conversion * 0.22)
      : ad.segment === 'search'
        ? Math.round(conversion * 0.08)
        : Math.round(conversion * 0.1);
  const calls =
    ad.segment === 'search'
      ? Math.round(conversion * 0.04)
      : ad.segment === 'retargeting'
        ? Math.round(conversion * 0.02)
        : 0;
  const frequency = clamp(
    ad.frequencyBase * (0.96 + Math.sin(absoluteDay / 9 + ad.phase) * 0.08),
    1.15,
    3.6
  );
  const reach = Math.max(1, Math.round(impressions / frequency));

  return {
    spend: roundMetric(spend),
    reach,
    impressions,
    clicks,
    linkClicks,
    leads,
    messages,
    calls,
    conversion,
  };
}

function getFilteredAds(query: ReportQueryInput): DemoAd[] {
  return DEMO_ADS.filter((ad) => {
    if (query.platformIntegrationId && ad.platformId !== query.platformIntegrationId) {
      return false;
    }

    if (query.adAccountIds.length > 0 && !query.adAccountIds.includes(ad.adAccountId)) {
      return false;
    }

    if (query.campaignIds.length > 0 && !query.campaignIds.includes(ad.campaignId)) {
      return false;
    }

    if (query.adsetIds.length > 0 && !query.adsetIds.includes(ad.parentId)) {
      return false;
    }

    if (query.adIds.length > 0 && !query.adIds.includes(ad.id)) {
      return false;
    }

    return true;
  });
}

function buildSummaryForRange(query: ReportQueryInput, ads: DemoAd[]): ReportMetricTotals {
  const totals = createEmptyRawTotals();

  enumerateDates(query.dateFrom, query.dateTo).forEach((isoDate) => {
    ads.forEach((ad) => {
      addRawTotals(totals, generateAdDailyRaw(ad, isoDate));
    });
  });

  return finalizeTotals(totals);
}

function buildSeries(query: ReportQueryInput, ads: DemoAd[]): ReportTimeSeriesPoint[] {
  const buckets = new Map<
    string,
    {
      startDate: string;
      endDate: string;
      label: string;
      raw: DemoRawTotals;
    }
  >();

  enumerateDates(query.dateFrom, query.dateTo).forEach((isoDate) => {
    const date = toUtcDate(isoDate);
    const bucketStart = createBucketStart(date, query.groupBy);
    const bucketEnd = createBucketEnd(bucketStart, query.groupBy);
    const bucketKey = toIsoDate(bucketStart);
    const existing = buckets.get(bucketKey) ?? {
      startDate: toIsoDate(bucketStart),
      endDate: toIsoDate(bucketEnd),
      label: createBucketLabel(bucketStart, bucketEnd, query.groupBy),
      raw: createEmptyRawTotals(),
    };

    ads.forEach((ad) => {
      addRawTotals(existing.raw, generateAdDailyRaw(ad, isoDate));
    });

    buckets.set(bucketKey, existing);
  });

  return [...buckets.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, bucket]) => ({
      key,
      label: bucket.label,
      startDate: bucket.startDate,
      endDate: bucket.endDate,
      ...finalizeTotals(bucket.raw),
    }));
}

function resolveBreakdownLevel(scope: ReportScope): ReportBreakdownRow['level'] {
  if (scope === 'campaign') {
    return 'adset';
  }

  if (scope === 'adset' || scope === 'ad') {
    return 'ad';
  }

  return 'campaign';
}

function resolveBreakdownTitle(scope: ReportScope): string {
  if (scope === 'campaign') {
    return 'Ad set breakdown';
  }

  if (scope === 'ad') {
    return 'Selected ads';
  }

  if (scope === 'adset') {
    return 'Ad breakdown';
  }

  return 'Campaign breakdown';
}

function buildBreakdownRows(query: ReportQueryInput, ads: DemoAd[]): ReportBreakdownRow[] {
  const level = resolveBreakdownLevel(query.scope);
  const grouped = new Map<
    string,
    {
      raw: DemoRawTotals;
    }
  >();

  enumerateDates(query.dateFrom, query.dateTo).forEach((isoDate) => {
    ads.forEach((ad) => {
      const entityId =
        level === 'campaign' ? ad.campaignId : level === 'adset' ? ad.parentId : ad.id;
      const current = grouped.get(entityId) ?? { raw: createEmptyRawTotals() };
      addRawTotals(current.raw, generateAdDailyRaw(ad, isoDate));
      grouped.set(entityId, current);
    });
  });

  return [...grouped.entries()]
    .map(([entityId, value]) => {
      if (level === 'campaign') {
        const campaign = CAMPAIGN_BY_ID.get(entityId);
        const adAccount = campaign ? AD_ACCOUNT_BY_ID.get(campaign.parentId) : null;
        const platform = adAccount ? PLATFORM_BY_ID.get(adAccount.parentId) : null;

        return {
          id: entityId,
          name: campaign?.label ?? 'Unknown campaign',
          level,
          status: campaign?.status ?? 'ACTIVE',
          primaryContext: adAccount?.label ?? null,
          secondaryContext: platform ? `${platform.label} · ${campaign?.objective ?? ''}` : null,
          startDate: query.dateFrom,
          endDate: query.dateTo,
          ...finalizeTotals(value.raw),
        } satisfies ReportBreakdownRow;
      }

      if (level === 'adset') {
        const adset = ADSET_BY_ID.get(entityId);
        const campaign = adset ? CAMPAIGN_BY_ID.get(adset.parentId) : null;

        return {
          id: entityId,
          name: adset?.label ?? 'Unknown ad set',
          level,
          status: adset?.status ?? 'ACTIVE',
          primaryContext: campaign?.label ?? null,
          secondaryContext: adset?.audience ?? null,
          startDate: query.dateFrom,
          endDate: query.dateTo,
          ...finalizeTotals(value.raw),
        } satisfies ReportBreakdownRow;
      }

      const ad = AD_BY_ID.get(entityId);
      const adset = ad ? ADSET_BY_ID.get(ad.parentId) : null;

      return {
        id: entityId,
        name: ad?.label ?? 'Unknown ad',
        level,
        status: ad?.status ?? 'ACTIVE',
        primaryContext: adset?.label ?? null,
        secondaryContext: ad?.note ?? null,
        startDate: query.dateFrom,
        endDate: query.dateTo,
        ...finalizeTotals(value.raw),
      } satisfies ReportBreakdownRow;
    })
    .sort((left, right) => right.spend - left.spend);
}

function buildBreakdownChart(rows: ReportBreakdownRow[]): ReportBreakdownChartPoint[] {
  return rows.slice(0, 6).map((row) => ({
    id: row.id,
    label: row.name,
    spend: row.spend,
    conversion: row.conversion,
    clicks: row.clicks,
  }));
}

function resolveScopeMeta(
  query: ReportQueryInput,
  businessName: string
): { title: string; subtitle: string; scopeLabel: string } {
  if (query.scope === 'platform') {
    const platform = PLATFORM_BY_ID.get(query.platformIntegrationId || '');
    return {
      title: platform?.label ?? businessName,
      subtitle: 'Platform performance report',
      scopeLabel: 'Platform',
    };
  }

  if (query.scope === 'ad_account') {
    const adAccount = query.adAccountIds.length === 1 ? AD_ACCOUNT_BY_ID.get(query.adAccountIds[0]) : null;
    return {
      title: adAccount?.label ?? 'Selected ad accounts',
      subtitle: 'Ad account performance report',
      scopeLabel: 'Ad Account',
    };
  }

  if (query.scope === 'campaign') {
    const campaign = query.campaignIds.length === 1 ? CAMPAIGN_BY_ID.get(query.campaignIds[0]) : null;
    return {
      title: campaign?.label ?? 'Selected campaigns',
      subtitle: 'Campaign performance report',
      scopeLabel: 'Campaign',
    };
  }

  if (query.scope === 'adset') {
    const adset = query.adsetIds.length === 1 ? ADSET_BY_ID.get(query.adsetIds[0]) : null;
    return {
      title: adset?.label ?? 'Selected ad sets',
      subtitle: 'Ad set performance report',
      scopeLabel: 'Ad Set',
    };
  }

  if (query.scope === 'ad') {
    const ad = query.adIds.length === 1 ? AD_BY_ID.get(query.adIds[0]) : null;
    return {
      title: ad?.label ?? 'Selected ads',
      subtitle: 'Ad performance report',
      scopeLabel: 'Ad',
    };
  }

  if (query.scope === 'business') {
    return {
      title: businessName,
      subtitle: 'Business performance report',
      scopeLabel: 'Business',
    };
  }

  return {
    title: businessName,
    subtitle: 'Business performance report',
    scopeLabel: 'Business',
  };
}

function buildFilterSummary(query: ReportQueryInput) {
  const platform = PLATFORM_BY_ID.get(query.platformIntegrationId || '');
  const adAccounts = DEMO_AD_ACCOUNTS.filter((item) => query.adAccountIds.includes(item.id)).map(
    (item) => item.label
  );
  const campaigns = DEMO_CAMPAIGNS.filter((item) => query.campaignIds.includes(item.id)).map(
    (item) => item.label
  );
  const adsets = DEMO_ADSETS.filter((item) => query.adsetIds.includes(item.id)).map(
    (item) => item.label
  );
  const ads = DEMO_ADS.filter((item) => query.adIds.includes(item.id)).map((item) => item.label);

  return [
    {
      label: 'Date range',
      value: formatDateRange(query.dateFrom, query.dateTo),
    },
    {
      label: 'Compare',
      value: query.compareMode === 'previous_period' ? 'Previous period' : 'None',
    },
    {
      label: 'Grouping',
      value: query.groupBy,
    },
    {
      label: 'Platform',
      value: platform?.label ?? 'All platforms',
    },
    {
      label: 'Ad accounts',
      value: adAccounts.length > 0 ? adAccounts.join(', ') : 'All ad accounts',
    },
    {
      label: 'Campaigns',
      value: campaigns.length > 0 ? campaigns.join(', ') : 'All campaigns',
    },
    {
      label: 'Ad sets',
      value: adsets.length > 0 ? adsets.join(', ') : 'All ad sets',
    },
    {
      label: 'Ads',
      value: ads.length > 0 ? ads.join(', ') : 'All ads',
    },
  ];
}

export function buildDemoReportPayload(
  query: ReportQueryInput,
  businessName: string = 'My Business'
): ReportPayload {
  const ads = getFilteredAds(query);
  const previousRange =
    query.compareMode === 'previous_period' ? getPreviousPeriodRange(query) : null;
  const previousQuery = previousRange
    ? {
        ...query,
        dateFrom: previousRange.dateFrom,
        dateTo: previousRange.dateTo,
      }
    : null;
  const summary = buildSummaryForRange(query, ads);
  const previousTotals = previousQuery ? buildSummaryForRange(previousQuery, ads) : null;
  const scopeMeta = resolveScopeMeta(query, businessName);
  const generatedAt = new Date().toISOString();
  const filterSummary = buildFilterSummary(query);
  const breakdownRows = buildBreakdownRows(query, ads);

  return {
    query,
    meta: {
      businessName,
      title: scopeMeta.title,
      subtitle: scopeMeta.subtitle,
      scopeLabel: scopeMeta.scopeLabel,
      currencyCode: 'USD',
      generatedAt,
    },
    summary,
    kpis: buildKpis(summary, previousTotals, 'USD'),
    series: buildSeries(query, ads),
    comparison: {
      previousDateFrom: previousRange?.dateFrom ?? null,
      previousDateTo: previousRange?.dateTo ?? null,
      previousTotals,
    },
    breakdown: {
      title: resolveBreakdownTitle(query.scope),
      rows: breakdownRows,
      chart: buildBreakdownChart(breakdownRows),
    },
    export: {
      title: scopeMeta.title,
      subtitle: scopeMeta.subtitle,
      generatedAt,
      filterSummary,
    },
  };
}

export function getDemoReportFilterOptions(): ReportFilterOptions {
  return {
    platforms: DEMO_PLATFORMS.map((item) => ({
      id: item.id,
      label: item.label,
      parentId: null,
    })),
    adAccounts: DEMO_AD_ACCOUNTS.map((item) => ({
      id: item.id,
      label: item.label,
      parentId: item.parentId,
    })),
    campaigns: DEMO_CAMPAIGNS.map((item) => ({
      id: item.id,
      label: item.label,
      parentId: item.parentId,
    })),
    adsets: DEMO_ADSETS.map((item) => ({
      id: item.id,
      label: item.label,
      parentId: item.parentId,
    })),
    ads: DEMO_ADS.map((item) => ({
      id: item.id,
      label: item.label,
      parentId: item.parentId,
    })),
  };
}
