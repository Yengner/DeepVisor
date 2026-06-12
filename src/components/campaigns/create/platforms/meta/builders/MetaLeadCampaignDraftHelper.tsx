'use client';

import '@mantine/dates/styles.css';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Container,
  Divider,
  FileInput,
  Grid,
  Group,
  NumberInput,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
  Textarea,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import {
  IconAlertTriangle,
  IconBrandInstagram,
  IconCalendar,
  IconChartLine,
  IconCheck,
  IconCirclePlus,
  IconDeviceMobileMessage,
  IconFileDescription,
  IconLayersIntersect,
  IconMapPin,
  IconMessageCircle,
  IconPhone,
  IconPhoto,
  IconPlus,
  IconSparkles,
  IconStarFilled,
  IconTargetArrow,
  IconTrash,
  IconUpload,
  IconVideo,
} from '@tabler/icons-react';
import type {
  CampaignDraftTargetMode,
  CampaignDraftPayload,
  ManualCampaignDraftForm,
  LeadCampaignAdSetDraft,
  LeadCampaignCreativeDraft,
  LeadCampaignMethodSettings,
  LeadCampaignLeadMethod,
} from '@/lib/shared/types/campaignDrafts';
import type { ConfiguredWhatsAppNumber } from '@/lib/shared/types/whatsappSetup';
import type { CampaignTreeAdsetNode, CampaignTreeNode } from '@/lib/server/data';
import type { MetaPage } from '@/lib/server/actions/meta/pages/actions';
import MediaSelectionModal from '../components/MediaSelectionModal';

type MetaLeadCampaignDraftHelperProps = {
  platformData: {
    id: string;
    platform_name: string;
  };
  adAccountId: string;
  campaigns: CampaignTreeNode[];
  draft?: ManualCampaignDraftForm | null;
  draftId?: string | null;
  metaPages?: MetaPage[];
  pagesError?: string | null;
  configuredWhatsAppNumbers?: ConfiguredWhatsAppNumber[];
};

type CreativeState = LeadCampaignCreativeDraft & {
  uploadedFiles: File[];
};

type AdSetState = Omit<LeadCampaignAdSetDraft, 'pageId' | 'targeting' | 'creatives'> & {
  ageMin: number;
  ageMax: number;
  genders: string[];
  interestsText: string;
  creatives: CreativeState[];
};

type HelperState = {
  draftTargetMode: CampaignDraftTargetMode;
  existingCampaignId: string;
  existingAdSetId: string;
  campaignName: string;
  leadMethod: LeadCampaignLeadMethod;
  pageId: string;
  serviceArea: string;
  radius: number;
  budgetAmount: number;
  startDate: Date;
  endDate: Date | null;
  adSets: AdSetState[];
  methodSettings: LeadCampaignMethodSettings;
};

type SaveDraftResponse = {
  success?: boolean;
  error?: string;
  data?: {
    draftId: string;
    href: string;
    status: 'created' | 'updated';
  };
};

type LeadEstimatePoint = {
  budget: number;
  outcomes: number;
};

type VisualSelectOption = {
  value: string;
  label: string;
  description?: string;
  imageUrl?: string | null;
};

function avatarLabel(name: string | null | undefined): string {
  const trimmed = name?.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : 'P';
}

function instagramLabelForPage(
  page: Pick<
    MetaPage,
    'instagram_account_id' | 'instagram_account_name' | 'instagram_account_username'
  > | null | undefined
): string | null {
  if (!page?.instagram_account_id) {
    return null;
  }

  if (page.instagram_account_username?.trim()) {
    return `@${page.instagram_account_username}`;
  }

  return page.instagram_account_name?.trim() || 'Connected Instagram account';
}

type LeadEstimate = {
  label: string;
  sourceLabel: string;
  sourceDetail: string;
  estimate: number;
  low: number;
  high: number;
  costPerOutcome: number;
  points: LeadEstimatePoint[];
  usesFallback: boolean;
};

type InitialStateDefaults = {
  pageId?: string;
  whatsappPhoneNumber?: ConfiguredWhatsAppNumber | null;
};

const LEADS_OBJECTIVE = 'OUTCOME_LEADS';
const FORM_DESTINATION = 'ON_AD';
const MESSAGE_DESTINATION = 'MESSENGER';
const WHATSAPP_DESTINATION = 'WHATSAPP';
const CALL_DESTINATION = 'PHONE_CALL';
const DEFAULT_BID_STRATEGY = 'LOWEST_COST_WITHOUT_CAP';
const DEFAULT_BUYING_TYPE = 'AUCTION';
const DEFAULT_BILLING_EVENT = 'IMPRESSIONS';
const DEFAULT_FORM_GOAL = 'LEAD_GENERATION';
const DEFAULT_CALL_GOAL = 'QUALITY_CALL';
const META_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif'];
const META_VIDEO_EXTENSIONS = [
  '.3g2',
  '.3gp',
  '.3gpp',
  '.asf',
  '.avi',
  '.dat',
  '.divx',
  '.dv',
  '.f4v',
  '.flv',
  '.m2ts',
  '.m4v',
  '.mkv',
  '.mod',
  '.mov',
  '.mp4',
  '.mpe',
  '.mpeg',
  '.mpeg4',
  '.mpg',
  '.mts',
  '.nsv',
  '.ogm',
  '.ogv',
  '.qt',
  '.tod',
  '.ts',
  '.vob',
  '.wmv',
];
const META_CREATIVE_ACCEPT = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'video/*',
  ...META_IMAGE_EXTENSIONS,
  ...META_VIDEO_EXTENSIONS,
].join(',');

const DEFAULT_CREATIVE_COPY = {
  headline: 'Message us to book',
  primaryText: 'Send a message and the business will help you choose the right next step.',
  description: 'Message request',
  cta: 'CONTACT_US',
};

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toIso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function dateFromIso(value: string | null | undefined, fallback: Date | null): Date | null {
  if (!value) {
    return fallback;
  }

  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : fallback;
}

function pickerValueToDate(value: string | Date | null, fallback: Date | null): Date | null {
  if (!value) {
    return fallback;
  }

  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value : fallback;
  }

  return dateFromIso(value, fallback);
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value >= 100 ? 0 : 2,
  }).format(value);
}

function formatOutcomeCount(value: number): string {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: value >= 10 ? 0 : 1,
  }).format(Math.max(value, 0));
}

function fileExtension(fileName: string): string {
  const dotIndex = fileName.lastIndexOf('.');
  return dotIndex >= 0 ? fileName.slice(dotIndex).toLowerCase() : '';
}

function isMetaImageFile(file: File): boolean {
  return file.type.startsWith('image/') || META_IMAGE_EXTENSIONS.includes(fileExtension(file.name));
}

function isMetaVideoFile(file: File): boolean {
  return file.type.startsWith('video/') || META_VIDEO_EXTENSIONS.includes(fileExtension(file.name));
}

function isBrowserPreviewableVideo(file: File): boolean {
  const extension = fileExtension(file.name);
  return file.type.startsWith('video/') || ['.mp4', '.mov', '.m4v', '.webm', '.ogv'].includes(extension);
}

function formatPerformance(item: CampaignTreeNode | CampaignTreeAdsetNode | null): string {
  if (!item?.performance) {
    return 'No synced performance yet';
  }

  const cost = item.performance.costPerResult != null
    ? `${formatMoney(item.performance.costPerResult)}/result`
    : 'cost pending';

  return `${item.performance.results} results, ${cost}`;
}

function leadEstimateLabel(method: LeadCampaignLeadMethod): string {
  if (method === 'messages') {
    return 'message leads';
  }

  if (method === 'calls') {
    return 'call leads';
  }

  return 'form leads';
}

function fallbackCostPerOutcome(method: LeadCampaignLeadMethod): number {
  if (method === 'messages') {
    return 18;
  }

  if (method === 'calls') {
    return 35;
  }

  return 24;
}

function outcomeCountForMethod(
  performance: NonNullable<CampaignTreeNode['performance']>,
  method: LeadCampaignLeadMethod
): number {
  if (method === 'messages') {
    return performance.messages;
  }

  if (method === 'calls') {
    return performance.calls;
  }

  return performance.leads;
}

function aggregateCampaignPerformance(campaigns: CampaignTreeNode[]): NonNullable<CampaignTreeNode['performance']> | null {
  const summaries = campaigns
    .map((campaign) => campaign.performance)
    .filter((summary): summary is NonNullable<CampaignTreeNode['performance']> => Boolean(summary));

  if (summaries.length === 0) {
    return null;
  }

  const total = summaries.reduce(
    (current, summary) => ({
      spend: current.spend + summary.spend,
      results: current.results + summary.results,
      leads: current.leads + summary.leads,
      messages: current.messages + summary.messages,
      calls: current.calls + summary.calls,
      ctrTotal: current.ctrTotal + (summary.ctr ?? 0),
      ctrCount: current.ctrCount + (summary.ctr == null ? 0 : 1),
      score: current.score + summary.score,
    }),
    {
      spend: 0,
      results: 0,
      leads: 0,
      messages: 0,
      calls: 0,
      ctrTotal: 0,
      ctrCount: 0,
      score: 0,
    }
  );

  return {
    spend: total.spend,
    results: total.results,
    leads: total.leads,
    messages: total.messages,
    calls: total.calls,
    costPerResult: total.results > 0 ? total.spend / total.results : null,
    ctr: total.ctrCount > 0 ? total.ctrTotal / total.ctrCount : null,
    lastDay: null,
    score: total.score,
  };
}

function estimateOutcomes(input: {
  budget: number;
  sourceSpend: number;
  sourceOutcomes: number;
  fallbackCost: number;
}): number {
  const budget = Math.max(input.budget, 0);
  if (budget === 0) {
    return 0;
  }

  const hasHistory = input.sourceSpend > 0 && input.sourceOutcomes > 0;
  const referenceSpend = hasHistory ? input.sourceSpend : input.fallbackCost * 12;
  const referenceOutcomes = hasHistory ? input.sourceOutcomes : 12;
  const ratio = budget / Math.max(referenceSpend, 1);

  return referenceOutcomes * Math.pow(ratio, 0.84);
}

function buildLeadEstimate(input: {
  campaigns: CampaignTreeNode[];
  selectedCampaign: CampaignTreeNode | null;
  selectedAdSet: CampaignTreeAdsetNode | null;
  leadMethod: LeadCampaignLeadMethod;
  budgetAmount: number;
}): LeadEstimate {
  const fallbackCost = fallbackCostPerOutcome(input.leadMethod);
  const candidates = [
    {
      label: input.selectedAdSet?.name ?? 'Selected ad set',
      detail: 'Selected ad set history',
      performance: input.selectedAdSet?.performance ?? null,
    },
    {
      label: input.selectedCampaign?.name ?? 'Selected campaign',
      detail: 'Selected campaign history',
      performance: input.selectedCampaign?.performance ?? null,
    },
    {
      label: 'Account average',
      detail: 'Synced account history',
      performance: aggregateCampaignPerformance(input.campaigns),
    },
  ];
  const source = candidates.find((candidate) => {
    if (!candidate.performance || candidate.performance.spend <= 0) {
      return false;
    }

    return outcomeCountForMethod(candidate.performance, input.leadMethod) > 0 || candidate.performance.results > 0;
  });
  const sourcePerformance = source?.performance ?? null;
  const methodOutcomes = sourcePerformance ? outcomeCountForMethod(sourcePerformance, input.leadMethod) : 0;
  const sourceOutcomes = methodOutcomes > 0 ? methodOutcomes : sourcePerformance?.results ?? 0;
  const sourceSpend = sourcePerformance?.spend ?? 0;
  const costPerOutcome =
    sourceSpend > 0 && sourceOutcomes > 0
      ? sourceSpend / sourceOutcomes
      : fallbackCost;
  const safeBudget = Math.max(input.budgetAmount, 0);
  const estimate = estimateOutcomes({
    budget: safeBudget,
    sourceSpend,
    sourceOutcomes,
    fallbackCost,
  });
  const multipliers = [0.25, 0.5, 0.75, 1, 1.25, 1.5];
  const points = multipliers.map((multiplier) => ({
    budget: Math.max(50, Math.round(safeBudget * multiplier)),
    outcomes: estimateOutcomes({
      budget: Math.max(50, safeBudget * multiplier),
      sourceSpend,
      sourceOutcomes,
      fallbackCost,
    }),
  }));

  return {
    label: leadEstimateLabel(input.leadMethod),
    sourceLabel: source?.label ?? 'Benchmark fallback',
    sourceDetail: source?.detail ?? 'No reliable synced result history yet',
    estimate,
    low: estimate * 0.75,
    high: estimate * 1.25,
    costPerOutcome,
    points,
    usesFallback: !source,
  };
}

function LeadEstimateChart({ points }: { points: LeadEstimatePoint[] }) {
  const width = 320;
  const height = 118;
  const padding = 16;
  const maxBudget = Math.max(...points.map((point) => point.budget), 1);
  const minBudget = Math.min(...points.map((point) => point.budget), 0);
  const maxOutcomes = Math.max(...points.map((point) => point.outcomes), 1);
  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;
  const path = points
    .map((point, index) => {
      const x = padding + ((point.budget - minBudget) / Math.max(maxBudget - minBudget, 1)) * usableWidth;
      const y = height - padding - (point.outcomes / maxOutcomes) * usableHeight;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');

  return (
    <Box>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label="Estimated leads by budget">
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="var(--mantine-color-gray-3)" />
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="var(--mantine-color-gray-3)" />
        <path d={path} fill="none" stroke="var(--mantine-color-blue-6)" strokeWidth="3" strokeLinecap="round" />
        {points.map((point) => {
          const x = padding + ((point.budget - minBudget) / Math.max(maxBudget - minBudget, 1)) * usableWidth;
          const y = height - padding - (point.outcomes / maxOutcomes) * usableHeight;
          return (
            <circle
              key={`${point.budget}-${point.outcomes}`}
              cx={x}
              cy={y}
              r={3.5}
              fill="white"
              stroke="var(--mantine-color-blue-6)"
              strokeWidth="2"
            />
          );
        })}
      </svg>
      <Group justify="space-between" mt={-6}>
        <Text size="xs" c="dimmed">{formatMoney(points[0]?.budget ?? 0)}</Text>
        <Text size="xs" c="dimmed">{formatMoney(points[points.length - 1]?.budget ?? 0)}</Text>
      </Group>
    </Box>
  );
}

function CreativeAdPreview({
  creative,
  pageName,
  fullHeight = false,
}: {
  creative: CreativeState;
  pageName: string;
  fullHeight?: boolean;
}) {
  const uploadedFile = creative.uploadedFiles[0] ?? null;
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);

  useEffect(() => {
    setPreviewFailed(false);

    if (!uploadedFile || (!isMetaImageFile(uploadedFile) && !isBrowserPreviewableVideo(uploadedFile))) {
      setPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(uploadedFile);
    setPreviewUrl(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [uploadedFile]);

  const assetLabel =
    creative.contentSource === 'existing'
      ? creative.selectedCreativeName || creative.existingCreativeIds[0] || 'Choose an existing creative'
      : uploadedFile?.name || creative.uploadedFileNames?.[0] || 'Upload Meta-supported media';
  const showImagePreview = Boolean(previewUrl && uploadedFile && isMetaImageFile(uploadedFile) && !previewFailed);
  const showVideoPreview = Boolean(previewUrl && uploadedFile && isMetaVideoFile(uploadedFile) && !previewFailed);

  return (
    <Paper withBorder radius="md" p="sm" bg="gray.0" h={fullHeight ? '100%' : undefined}>
      <Stack gap="xs" h={fullHeight ? '100%' : undefined}>
        <Group gap="xs" align="center">
          <Box
            w={28}
            h={28}
            style={{
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--mantine-color-blue-5), var(--mantine-color-violet-5))',
            }}
          />
          <div>
            <Text size="sm" fw={800} lineClamp={1}>
              {pageName}
            </Text>
            <Text size="xs" c="dimmed">
              Sponsored
            </Text>
          </div>
        </Group>

        <Text size="sm" lineClamp={3}>
          {creative.adPrimaryText || 'Primary text preview will show here.'}
        </Text>

        <Box
          h={fullHeight ? undefined : 164}
          mih={fullHeight ? 280 : undefined}
          style={{
            borderRadius: 12,
            overflow: 'hidden',
            border: '1px solid var(--mantine-color-gray-3)',
            background: 'white',
            display: 'flex',
            flex: fullHeight ? 1 : undefined,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {showImagePreview ? (
            <img
              src={previewUrl ?? undefined}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              onError={() => setPreviewFailed(true)}
            />
          ) : showVideoPreview ? (
            <video
              src={previewUrl ?? undefined}
              controls
              muted
              playsInline
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', background: 'black' }}
              onError={() => setPreviewFailed(true)}
            />
          ) : (
            <Stack gap={4} align="center" px="md">
              <ThemeIcon
                color={creative.contentSource === 'existing' || uploadedFile ? 'blue' : 'gray'}
                variant="light"
                radius="xl"
              >
                {uploadedFile && isMetaVideoFile(uploadedFile) ? (
                  <IconVideo size={18} />
                ) : creative.contentSource === 'existing' || (uploadedFile ? isMetaImageFile(uploadedFile) : false) ? (
                  <IconPhoto size={18} />
                ) : (
                  <IconUpload size={18} />
                )}
              </ThemeIcon>
              <Text size="xs" c="dimmed" ta="center" lineClamp={2}>
                {assetLabel}
              </Text>
            </Stack>
          )}
        </Box>

        <Group justify="space-between" align="center" gap="sm" wrap="nowrap">
          <div style={{ minWidth: 0 }}>
            <Text size="xs" c="dimmed" tt="uppercase">
              Lead ad
            </Text>
            <Text size="sm" fw={800} lineClamp={1}>
              {creative.adHeadline || 'Headline preview'}
            </Text>
            <Text size="xs" c="dimmed" lineClamp={1}>
              {creative.adDescription || 'Description preview'}
            </Text>
          </div>
          <Button size="xs" variant="default" radius="md" style={{ flexShrink: 0 }}>
            {creative.adCallToAction.replaceAll('_', ' ')}
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}

function findCampaign(campaigns: CampaignTreeNode[], campaignId: string): CampaignTreeNode | null {
  return campaigns.find((campaign) => campaign.id === campaignId) ?? null;
}

function findAdSet(campaign: CampaignTreeNode | null, adSetId: string): CampaignTreeAdsetNode | null {
  return campaign?.adset_metrics.find((adSet) => adSet.id === adSetId) ?? null;
}

function bestCampaign(campaigns: CampaignTreeNode[]): CampaignTreeNode | null {
  return campaigns.find((campaign) => campaign.isBest) ?? campaigns[0] ?? null;
}

function bestAdSet(campaign: CampaignTreeNode | null): CampaignTreeAdsetNode | null {
  return campaign?.adset_metrics.find((adSet) => adSet.isBest) ?? campaign?.adset_metrics[0] ?? null;
}

function defaultCampaignForTarget(
  campaigns: CampaignTreeNode[],
  mode: CampaignDraftTargetMode
): CampaignTreeNode | null {
  if (mode === 'existing_adset') {
    return campaigns.find((campaign) => campaign.adset_metrics.length > 0) ?? campaigns[0] ?? null;
  }

  return campaigns[0] ?? null;
}

function destinationForLeadMethod(method: LeadCampaignLeadMethod, settings?: LeadCampaignMethodSettings): string {
  if (method === 'messages') {
    if (settings?.messages.channel === 'whatsapp') {
      return WHATSAPP_DESTINATION;
    }

    return MESSAGE_DESTINATION;
  }

  if (method === 'calls') {
    return CALL_DESTINATION;
  }

  return FORM_DESTINATION;
}

function leadMethodFromDestination(destination: string | undefined): LeadCampaignLeadMethod {
  if (destination === MESSAGE_DESTINATION || destination === WHATSAPP_DESTINATION) {
    return 'messages';
  }

  if (destination === CALL_DESTINATION) {
    return 'calls';
  }

  return 'instant_form';
}

function optimizationGoalForLeadMethod(method: LeadCampaignLeadMethod): string {
  return method === 'calls' ? DEFAULT_CALL_GOAL : DEFAULT_FORM_GOAL;
}

function defaultMethodSettings(): LeadCampaignMethodSettings {
  return {
    instantForm: {
      formStyle: 'higher_intent',
      privacyPolicyUrl: '',
      qualifyingQuestions: ['Preferred service', 'Preferred appointment day', 'Phone number'],
    },
    messages: {
      channel: 'whatsapp',
      whatsappPhoneNumberId: '',
      whatsappPhoneNumber: '',
      whatsappBusinessAccountId: '',
      whatsappBusinessAccountName: '',
      whatsappBusinessReady: false,
      responseReady: false,
    },
    calls: {
      phoneNumber: '',
      staffedHoursAcknowledged: false,
      callWindow: 'Business hours only',
    },
  };
}

function defaultCreative(
  role: 'primary' | 'challenger',
  index = 0
): CreativeState {
  const angleNumber = index + 1;
  const suffix = role === 'challenger' ? ` - angle ${angleNumber}` : '';

  return {
    id: role === 'primary' ? 'primary' : `angle-${angleNumber}`,
    role,
    contentSource: 'upload',
    existingCreativeIds: [],
    selectedCreativeName: '',
    uploadedFileNames: [],
    uploadedFiles: [],
    imageHash: '',
    adHeadline: `${DEFAULT_CREATIVE_COPY.headline}${suffix}`.slice(0, 40),
    adPrimaryText: DEFAULT_CREATIVE_COPY.primaryText,
    adDescription: role === 'challenger' ? `Angle ${angleNumber}` : DEFAULT_CREATIVE_COPY.description,
    adCallToAction: DEFAULT_CREATIVE_COPY.cta,
  };
}

function normalizeMethodSettings(settings: LeadCampaignMethodSettings): LeadCampaignMethodSettings {
  return {
    ...settings,
    messages: {
      ...settings.messages,
      channel: settings.messages.channel ?? 'whatsapp',
      whatsappPhoneNumberId: settings.messages.whatsappPhoneNumberId ?? '',
      whatsappPhoneNumber: settings.messages.whatsappPhoneNumber ?? '',
      whatsappBusinessAccountId: settings.messages.whatsappBusinessAccountId ?? '',
      whatsappBusinessAccountName: settings.messages.whatsappBusinessAccountName ?? '',
      whatsappBusinessReady: settings.messages.whatsappBusinessReady ?? false,
      responseReady: settings.messages.responseReady ?? false,
    },
  };
}

function applyWhatsAppPhoneNumberDefaults(
  settings: LeadCampaignMethodSettings,
  phoneNumber: ConfiguredWhatsAppNumber | null | undefined
): LeadCampaignMethodSettings {
  if (!phoneNumber || settings.messages.whatsappPhoneNumberId) {
    return settings;
  }

  return {
    ...settings,
    messages: {
      ...settings.messages,
      whatsappPhoneNumberId: phoneNumber.id,
      whatsappPhoneNumber: phoneNumber.display_phone_number,
      whatsappBusinessAccountId: '',
      whatsappBusinessAccountName: '',
      whatsappBusinessReady: false,
    },
  };
}

function defaultAdSet(role: 'primary' | 'challenger'): AdSetState {
  return {
    id: role,
    role,
    adSetName: role === 'primary' ? 'Core lead audience' : 'Challenger audience',
    optimizationGoal: DEFAULT_FORM_GOAL,
    useAdvantageAudience: true,
    useAdvantagePlacements: true,
    billingEvent: DEFAULT_BILLING_EVENT,
    ageMin: 18,
    ageMax: 65,
    genders: [],
    interestsText: '',
    creatives: [defaultCreative('primary', 0)],
  };
}

function creativeFromDraft(
  draftCreative: Partial<LeadCampaignCreativeDraft> | undefined,
  role: 'primary' | 'challenger',
  index = 0
): CreativeState {
  const fallback = defaultCreative(role, index);

  return {
    ...fallback,
    ...draftCreative,
    id: draftCreative?.id ?? fallback.id,
    role,
    existingCreativeIds: draftCreative?.existingCreativeIds ?? [],
    uploadedFileNames: draftCreative?.uploadedFileNames ?? [],
    uploadedFiles: [],
  };
}

function buildInitialState(
  draft: ManualCampaignDraftForm | null | undefined,
  defaults: InitialStateDefaults = {}
): HelperState {
  const startDate = dateFromIso(draft?.startDate, new Date()) ?? new Date();
  const leadMethod = draft?.leadMethod ?? (draft?.destinationType ? leadMethodFromDestination(draft.destinationType) : 'messages');
  const firstDraftAdSet = draft?.adSets?.[0] ?? null;
  const fallbackAdSet: LeadCampaignAdSetDraft = {
    id: 'primary',
    role: 'primary',
    adSetName: draft?.adSetName || 'Core lead audience',
    pageId: draft?.pageId || '',
    optimizationGoal: draft?.optimizationGoal || optimizationGoalForLeadMethod(leadMethod),
    useAdvantageAudience: draft?.useAdvantageAudience ?? true,
    useAdvantagePlacements: draft?.useAdvantagePlacements ?? true,
    billingEvent: draft?.billingEvent || DEFAULT_BILLING_EVENT,
    targeting: draft?.targeting ?? {
      markerPosition: null,
      locationLabel: '',
      radius: 5,
      ageMin: 18,
      ageMax: 65,
      genders: [],
      interests: [],
    },
    creatives: [
      {
        ...defaultCreative('primary', 0),
        ...(draft?.creative ?? {}),
        id: 'primary',
        role: 'primary',
      },
    ],
  };
  const draftAdSets: LeadCampaignAdSetDraft[] = draft?.adSets && draft.adSets.length > 0
    ? draft.adSets
    : [fallbackAdSet];
  const draftTargetMode = draft?.draftTarget?.mode ?? 'new_campaign';
  const hydratedAdSets: AdSetState[] = draftAdSets.map((adSet, index) => ({
    id: adSet.id || (index === 0 ? 'primary' : 'challenger'),
    role: index === 0 ? 'primary' as const : 'challenger' as const,
    existingCampaignId: adSet.existingCampaignId ?? null,
    existingAdSetId: adSet.existingAdSetId ?? null,
    adSetName: adSet.adSetName || (index === 0 ? 'Core lead audience' : 'Challenger audience'),
    optimizationGoal: adSet.optimizationGoal || optimizationGoalForLeadMethod(leadMethod),
    useAdvantageAudience: adSet.useAdvantageAudience ?? true,
    useAdvantagePlacements: adSet.useAdvantagePlacements ?? true,
    billingEvent: adSet.billingEvent || DEFAULT_BILLING_EVENT,
    ageMin: adSet.targeting.ageMin || 18,
    ageMax: adSet.targeting.ageMax || 65,
    genders: adSet.targeting.genders ?? [],
    interestsText: (adSet.targeting.interests ?? []).join(', '),
    creatives: (adSet.creatives?.length
      ? adSet.creatives
      : [fallbackAdSet.creatives[0]]
    ).map((creative, creativeIndex) =>
      creativeFromDraft(
        creative,
        creativeIndex === 0 ? 'primary' : 'challenger',
        creativeIndex
      )
    ),
  }));
  const methodSettings = normalizeMethodSettings({
    ...defaultMethodSettings(),
    ...(draft?.methodSettings ?? {}),
    instantForm: {
      ...defaultMethodSettings().instantForm,
      ...(draft?.methodSettings?.instantForm ?? {}),
    },
    messages: {
      ...defaultMethodSettings().messages,
      ...(draft?.methodSettings?.messages ?? {}),
    },
    calls: {
      ...defaultMethodSettings().calls,
      ...(draft?.methodSettings?.calls ?? {}),
    },
  });
  const hydratedMethodSettings =
    leadMethod === 'messages' && methodSettings.messages.channel === 'whatsapp'
      ? applyWhatsAppPhoneNumberDefaults(methodSettings, defaults.whatsappPhoneNumber)
      : methodSettings;

  return {
    draftTargetMode,
    existingCampaignId: draft?.draftTarget?.existingCampaignId ?? firstDraftAdSet?.existingCampaignId ?? '',
    existingAdSetId: draft?.draftTarget?.existingAdSetId ?? firstDraftAdSet?.existingAdSetId ?? '',
    campaignName: draft?.campaignName || 'Lead campaign',
    leadMethod,
    pageId: firstDraftAdSet?.pageId || draft?.pageId || defaults.pageId || '',
    serviceArea: firstDraftAdSet?.targeting.locationLabel || draft?.targeting.locationLabel || '',
    radius: firstDraftAdSet?.targeting.radius || draft?.targeting.radius || 5,
    budgetAmount:
      draft?.budgetType === 'daily'
        ? Math.max(150, Math.round((draft.budgetAmount || 20) * 30))
        : draft?.budgetAmount || 600,
    startDate,
    endDate: dateFromIso(draft?.endDate, addDays(startDate, 30)),
    methodSettings: hydratedMethodSettings,
    adSets: draftTargetMode === 'existing_adset' ? hydratedAdSets.slice(0, 1) : hydratedAdSets,
  };
}

function splitCsv(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function stripRuntimeCreativeFields(creative: CreativeState): LeadCampaignCreativeDraft {
  return {
    id: creative.id,
    role: creative.role,
    contentSource: creative.contentSource,
    existingCreativeIds: creative.existingCreativeIds,
    selectedCreativeName: creative.selectedCreativeName,
    uploadedFileNames:
      creative.uploadedFiles.length > 0
        ? creative.uploadedFiles.map((file) => file.name)
        : creative.uploadedFileNames,
    imageHash: creative.imageHash,
    adHeadline: creative.adHeadline,
    adPrimaryText: creative.adPrimaryText,
    adDescription: creative.adDescription,
    adCallToAction: creative.adCallToAction,
  };
}

function buildPayload(
  state: HelperState,
  selectedCampaign: CampaignTreeNode | null,
  selectedAdSet: CampaignTreeAdsetNode | null,
  selectedPage: MetaPage | null
): CampaignDraftPayload {
  const destinationType = destinationForLeadMethod(state.leadMethod, state.methodSettings);
  const optimizationGoal = optimizationGoalForLeadMethod(state.leadMethod);
  const persistedAdSets: LeadCampaignAdSetDraft[] = state.adSets.map((adSet) => ({
    id: adSet.id,
    role: adSet.role,
    existingCampaignId: state.draftTargetMode === 'new_campaign' ? null : state.existingCampaignId,
    existingAdSetId: state.draftTargetMode === 'existing_adset' ? state.existingAdSetId : null,
    adSetName: state.draftTargetMode === 'existing_adset'
      ? selectedAdSet?.name ?? adSet.adSetName
      : adSet.adSetName,
    pageId: state.pageId,
    instagramAccountId: selectedPage?.instagram_account_id ?? null,
    instagramAccountName: selectedPage?.instagram_account_name ?? null,
    instagramAccountUsername: selectedPage?.instagram_account_username ?? null,
    instagramAccountPictureUrl: selectedPage?.instagram_account_picture_url ?? null,
    optimizationGoal,
    useAdvantageAudience: adSet.useAdvantageAudience,
    useAdvantagePlacements: adSet.useAdvantagePlacements,
    billingEvent: adSet.billingEvent,
    targeting: {
      markerPosition: null,
      locationLabel: state.serviceArea,
      radius: state.radius,
      ageMin: adSet.ageMin,
      ageMax: adSet.ageMax,
      genders: adSet.genders,
      interests: splitCsv(adSet.interestsText),
    },
    creatives: adSet.creatives.map(stripRuntimeCreativeFields),
  }));
  const firstAdSet = persistedAdSets[0];
  const firstCreative = firstAdSet.creatives[0];

  return {
    mode: 'manual',
    form: {
      campaignName: state.draftTargetMode === 'new_campaign'
        ? state.campaignName
        : selectedCampaign?.name ?? state.campaignName,
      objective: LEADS_OBJECTIVE,
      destinationType,
      specialAdCategories: ['NONE'],
      bidStrategy: DEFAULT_BID_STRATEGY,
      buyingType: DEFAULT_BUYING_TYPE,
      budgetAmount: state.budgetAmount,
      budgetType: 'lifetime',
      budgetOptimization: state.draftTargetMode !== 'existing_adset' && persistedAdSets.length > 1,
      startDate: state.startDate.toISOString(),
      endDate: toIso(state.endDate),
      draftTarget: {
        mode: state.draftTargetMode,
        existingCampaignId: state.draftTargetMode === 'new_campaign' ? null : state.existingCampaignId,
        existingCampaignName: state.draftTargetMode === 'new_campaign' ? null : selectedCampaign?.name ?? null,
        existingAdSetId: state.draftTargetMode === 'existing_adset' ? state.existingAdSetId : null,
        existingAdSetName: state.draftTargetMode === 'existing_adset' ? selectedAdSet?.name ?? null : null,
      },
      leadMethod: state.leadMethod,
      methodSettings: state.methodSettings,
      adSets: persistedAdSets,
      adSetName: firstAdSet.adSetName,
      pageId: state.pageId,
      instagramAccountId: selectedPage?.instagram_account_id ?? null,
      instagramAccountName: selectedPage?.instagram_account_name ?? null,
      instagramAccountUsername: selectedPage?.instagram_account_username ?? null,
      instagramAccountPictureUrl: selectedPage?.instagram_account_picture_url ?? null,
      optimizationGoal,
      useAdvantageAudience: firstAdSet.useAdvantageAudience,
      useAdvantagePlacements: firstAdSet.useAdvantagePlacements,
      billingEvent: firstAdSet.billingEvent,
      targeting: firstAdSet.targeting,
      creative: {
        contentSource: firstCreative.contentSource,
        existingCreativeIds: firstCreative.existingCreativeIds,
        imageHash: firstCreative.imageHash,
        adHeadline: firstCreative.adHeadline,
        adPrimaryText: firstCreative.adPrimaryText,
        adDescription: firstCreative.adDescription,
        adCallToAction: firstCreative.adCallToAction,
      },
    },
  };
}

export default function MetaLeadCampaignDraftHelper({
  platformData,
  adAccountId,
  campaigns,
  draft,
  draftId,
  metaPages = [],
  pagesError = null,
  configuredWhatsAppNumbers = [],
}: MetaLeadCampaignDraftHelperProps) {
  const router = useRouter();
  const [state, setState] = useState<HelperState>(() =>
    buildInitialState(draft, {
      pageId: metaPages[0]?.page_id,
      whatsappPhoneNumber: configuredWhatsAppNumbers[0] ?? null,
    })
  );
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(draftId ?? null);
  const [savedDraft, setSavedDraft] = useState<SaveDraftResponse['data'] | null>(null);
  const [mediaTarget, setMediaTarget] = useState<{ adSetId: string; creativeId: string } | null>(null);

  useEffect(() => {
    setCurrentDraftId(draftId ?? null);
  }, [draftId]);

  const selectedCampaign = useMemo(
    () => findCampaign(campaigns, state.existingCampaignId),
    [campaigns, state.existingCampaignId]
  );
  const selectedAdSet = useMemo(
    () => findAdSet(selectedCampaign, state.existingAdSetId),
    [selectedCampaign, state.existingAdSetId]
  );
  const recommendedCampaign = useMemo(() => bestCampaign(campaigns), [campaigns]);
  const recommendedAdSet = useMemo(() => bestAdSet(selectedCampaign ?? recommendedCampaign), [recommendedCampaign, selectedCampaign]);
  const selectedPage = useMemo(
    () => metaPages.find((page) => page.page_id === state.pageId) ?? null,
    [metaPages, state.pageId]
  );
  const selectedPageName = selectedPage?.name ?? 'Selected Page';
  const selectedInstagramLabel = instagramLabelForPage(selectedPage);
  const pageSelectOptions = useMemo<VisualSelectOption[]>(
    () =>
      metaPages.map((page) => {
        const instagramLabel = instagramLabelForPage(page);
        return {
          value: page.page_id,
          label: page.name,
          description: [
            page.phone ? `Page phone: ${page.phone}` : 'No Page phone found',
            instagramLabel ? `Instagram: ${instagramLabel}` : null,
          ]
            .filter(Boolean)
            .join(' - '),
          imageUrl: page.picture_url ?? null,
        };
      }),
    [metaPages]
  );
  const whatsappPhoneNumberOptions = useMemo(
    () =>
      configuredWhatsAppNumbers.map((phoneNumber) => ({
        value: phoneNumber.id,
        label: phoneNumber.display_phone_number,
        description: phoneNumber.label || phoneNumber.pageName || 'Saved during Meta setup',
        imageUrl: phoneNumber.pagePictureUrl ?? null,
      })),
    [configuredWhatsAppNumbers]
  );
  const selectedWhatsAppPhoneNumber = useMemo(
    () =>
      configuredWhatsAppNumbers.find(
        (phoneNumber) => phoneNumber.id === state.methodSettings.messages.whatsappPhoneNumberId
      ) ?? null,
    [state.methodSettings.messages.whatsappPhoneNumberId, configuredWhatsAppNumbers]
  );


  useEffect(() => {
    if (state.draftTargetMode === 'new_campaign' || campaigns.length === 0) {
      return;
    }

    if (!state.existingCampaignId || !campaigns.some((campaign) => campaign.id === state.existingCampaignId)) {
      setState((current) => ({
        ...current,
        existingCampaignId: campaigns[0].id,
        existingAdSetId: current.draftTargetMode === 'existing_adset'
          ? campaigns[0].adset_metrics[0]?.id ?? ''
          : '',
      }));
    }
  }, [campaigns, state.draftTargetMode, state.existingCampaignId]);

  useEffect(() => {
    if (state.draftTargetMode !== 'existing_adset') {
      return;
    }

    if (!selectedCampaign) {
      return;
    }

    if (!state.existingAdSetId || !selectedCampaign.adset_metrics.some((adSet) => adSet.id === state.existingAdSetId)) {
      setState((current) => ({
        ...current,
        existingAdSetId: selectedCampaign.adset_metrics[0]?.id ?? '',
      }));
    }
  }, [selectedCampaign, state.draftTargetMode, state.existingAdSetId]);

  const dailyEquivalent = useMemo(() => {
    if (!state.endDate) {
      return null;
    }

    const days = Math.max(
      1,
      Math.ceil((state.endDate.getTime() - state.startDate.getTime()) / (1000 * 60 * 60 * 24))
    );

    return {
      days,
      amount: Math.round((state.budgetAmount / days) * 100) / 100,
    };
  }, [state.budgetAmount, state.endDate, state.startDate]);
  const leadEstimate = useMemo(
    () =>
      buildLeadEstimate({
        campaigns,
        selectedCampaign,
        selectedAdSet,
        leadMethod: state.leadMethod,
        budgetAmount: state.budgetAmount,
      }),
    [campaigns, selectedCampaign, selectedAdSet, state.budgetAmount, state.leadMethod]
  );

  const activeMediaCreative = mediaTarget
    ? state.adSets
        .find((adSet) => adSet.id === mediaTarget.adSetId)
        ?.creatives.find((creative) => creative.id === mediaTarget.creativeId) ?? null
    : null;

  function patchState(patch: Partial<HelperState>) {
    setState((current) => ({ ...current, ...patch }));
  }

  function updateDraftTargetMode(mode: CampaignDraftTargetMode) {
    setState((current) => {
      const defaultCampaign = defaultCampaignForTarget(campaigns, mode);
      const currentCampaign = findCampaign(campaigns, current.existingCampaignId);
      const campaign =
        mode === 'existing_adset' && !currentCampaign?.adset_metrics.length
          ? defaultCampaign
          : currentCampaign ?? defaultCampaign;
      const existingCampaignId = mode === 'new_campaign' ? '' : campaign?.id || '';

      return {
        ...current,
        draftTargetMode: mode,
        existingCampaignId,
        existingAdSetId:
          mode === 'existing_adset'
            ? current.existingAdSetId || campaign?.adset_metrics[0]?.id || ''
            : '',
        adSets: mode === 'existing_adset' ? current.adSets.slice(0, 1) : current.adSets,
      };
    });
  }

  function updateExistingCampaign(campaignId: string | null) {
    const nextCampaignId = campaignId ?? '';
    const nextCampaign = findCampaign(campaigns, nextCampaignId);

    setState((current) => ({
      ...current,
      existingCampaignId: nextCampaignId,
      existingAdSetId:
        current.draftTargetMode === 'existing_adset'
          ? nextCampaign?.adset_metrics[0]?.id ?? ''
          : '',
    }));
  }

  function updateMethodSettings(patch: Partial<LeadCampaignMethodSettings>) {
    setState((current) => ({
      ...current,
      methodSettings: {
        ...current.methodSettings,
        ...patch,
      },
    }));
  }

  function updateAdSet(adSetId: string, patch: Partial<AdSetState>) {
    setState((current) => ({
      ...current,
      adSets: current.adSets.map((adSet) =>
        adSet.id === adSetId ? { ...adSet, ...patch } : adSet
      ),
    }));
  }

  function updateCreative(adSetId: string, creativeId: string, patch: Partial<CreativeState>) {
    setState((current) => ({
      ...current,
      adSets: current.adSets.map((adSet) =>
        adSet.id === adSetId
          ? {
              ...adSet,
              creatives: adSet.creatives.map((creative) =>
                creative.id === creativeId ? { ...creative, ...patch } : creative
              ),
            }
          : adSet
      ),
    }));
  }

  function addCreativeAngle(adSetId: string) {
    setState((current) => ({
      ...current,
      adSets: current.adSets.map((adSet) => {
        if (adSet.id !== adSetId) {
          return adSet;
        }

        const nextIndex = adSet.creatives.length;
        const nextCreative = {
          ...defaultCreative(nextIndex === 0 ? 'primary' : 'challenger', nextIndex),
          id: `angle-${nextIndex + 1}-${Date.now()}`,
        };

        return {
          ...adSet,
          creatives: [...adSet.creatives, nextCreative],
        };
      }),
    }));
  }

  function removeCreativeAngle(adSetId: string, creativeId: string) {
    setState((current) => ({
      ...current,
      adSets: current.adSets.map((adSet) => {
        if (adSet.id !== adSetId || adSet.creatives.length <= 1) {
          return adSet;
        }

        return {
          ...adSet,
          creatives: adSet.creatives.filter((creative) => creative.id !== creativeId || creative.role === 'primary'),
        };
      }),
    }));
  }

  function toggleChallengerAdSet(enabled: boolean) {
    setState((current) => {
      if (enabled && current.adSets.length === 1) {
        return {
          ...current,
          adSets: [...current.adSets, defaultAdSet('challenger')],
        };
      }

      if (!enabled) {
        return {
          ...current,
          adSets: current.adSets.slice(0, 1),
        };
      }

      return current;
    });
  }

  function validate(): string[] {
    const nextErrors: string[] = [];
    const primaryAdSet = state.adSets[0];
    const primaryCreative = primaryAdSet.creatives[0];

    if (state.draftTargetMode === 'new_campaign' && !state.campaignName.trim()) {
      nextErrors.push('Add a campaign name.');
    }

    if (state.draftTargetMode === 'existing_campaign' && !selectedCampaign) {
      nextErrors.push('Choose the existing campaign to build the new ad set inside.');
    }

    if (state.draftTargetMode === 'existing_adset') {
      if (!selectedCampaign) {
        nextErrors.push('Choose the existing campaign that contains the ad set.');
      }

      if (!selectedAdSet) {
        nextErrors.push('Choose the existing ad set for the new creative.');
      }
    }

    if (!state.pageId) {
      nextErrors.push('Select the Facebook Page that will run the ad.');
    }

    if (
      state.leadMethod === 'messages' &&
      state.methodSettings.messages.channel === 'instagram' &&
      !selectedPage?.instagram_account_id
    ) {
      nextErrors.push('Select a Facebook Page with a connected Instagram account for Instagram DM leads.');
    }

    if (state.draftTargetMode !== 'existing_adset' && !state.serviceArea.trim()) {
      nextErrors.push('Enter the service area or city.');
    }

    if (state.draftTargetMode !== 'existing_adset' && (!state.radius || state.radius <= 0)) {
      nextErrors.push('Set a location radius.');
    }

    if (!state.budgetAmount || state.budgetAmount < 50) {
      nextErrors.push('Set a lifetime budget of at least $50.');
    }

    if (!state.endDate) {
      nextErrors.push('Set a fixed campaign end date.');
    }

    if (!primaryCreative.adHeadline.trim() || !primaryCreative.adPrimaryText.trim()) {
      nextErrors.push('Add a headline and primary text for the primary ad.');
    }

    if (state.leadMethod === 'messages') {
      if (state.methodSettings.messages.channel === 'whatsapp') {
        if (!state.methodSettings.messages.whatsappPhoneNumber?.trim()) {
          nextErrors.push('Select the WhatsApp number customers should message from ads.');
        } else if (configuredWhatsAppNumbers.length > 0 && !selectedWhatsAppPhoneNumber) {
          nextErrors.push('Select a saved WhatsApp number for this business.');
        }
      }

      if (!state.methodSettings.messages.responseReady) {
        nextErrors.push('Confirm the business can respond quickly before using messages.');
      }
    }

    if (state.leadMethod === 'calls') {
      if (!state.methodSettings.calls.phoneNumber.trim()) {
        nextErrors.push('Add the phone number for call ads.');
      }

      if (!state.methodSettings.calls.staffedHoursAcknowledged) {
        nextErrors.push('Confirm calls will only run when the phone can be answered.');
      }
    }

    return nextErrors;
  }

  async function handleSaveDraft() {
    const nextErrors = validate();
    setErrors(nextErrors);
    setSavedDraft(null);

    if (nextErrors.length > 0) {
      return;
    }

    setSaving(true);
    try {
      const payloadJson = buildPayload(state, selectedCampaign, selectedAdSet, selectedPage);
      const response = await fetch('/api/campaign-drafts', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          draftId: currentDraftId,
          title: draftTitle,
          reviewNotes: `Meta lead helper draft. Lead method: ${state.leadMethod}.`,
          payloadJson,
        }),
      });
      const result = (await response.json().catch(() => ({}))) as SaveDraftResponse;

      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error || 'Failed to save campaign draft.');
      }

      setSavedDraft(result.data);
      setCurrentDraftId(result.data.draftId);
      if (!currentDraftId) {
        router.replace(result.data.href);
      } else {
        router.refresh();
      }
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'Failed to save campaign draft.']);
    } finally {
      setSaving(false);
    }
  }

  const methodCardCopy = {
    messages: {
      title: 'Messages',
      icon: IconMessageCircle,
      description: 'Primary focus for now: start a WhatsApp conversation quickly, with DMs available as backup.',
    },
    instant_form: {
      title: 'Instant Form',
      icon: IconFileDescription,
      description: 'Optional later path for mobile form capture.',
    },
    calls: {
      title: 'Calls',
      icon: IconPhone,
      description: 'Use for staffed phone windows, same-day openings, or consult booking.',
    },
  } satisfies Record<LeadCampaignLeadMethod, { title: string; icon: typeof IconFileDescription; description: string }>;
  const targetCardCopy = [
    {
      mode: 'new_campaign' as const,
      title: 'New campaign',
      description: 'Create a clean Leads campaign draft with one primary ad set.',
      icon: IconCirclePlus,
    },
    {
      mode: 'existing_campaign' as const,
      title: 'Existing campaign',
      description: 'Use a current campaign and draft a new ad set inside it.',
      icon: IconLayersIntersect,
    },
    {
      mode: 'existing_adset' as const,
      title: 'Existing ad set',
      description: 'Keep the winning ad set context and draft new creative into it.',
      icon: IconTargetArrow,
    },
  ];
  const campaignSelectData = campaigns.map((campaign) => ({
    value: campaign.id,
    label: `${campaign.isBest ? 'Best performer - ' : ''}${campaign.name}`,
  }));
  const adSetSelectData = (selectedCampaign?.adset_metrics ?? []).map((adSet) => ({
      value: adSet.id,
      label: `${adSet.isBest ? 'Best performer - ' : ''}${adSet.name}`,
    }));
  const recommendedTarget =
    state.draftTargetMode === 'existing_adset'
      ? recommendedAdSet
      : state.draftTargetMode === 'existing_campaign'
        ? recommendedCampaign
        : null;
  const selectedTarget =
    state.draftTargetMode === 'existing_adset'
      ? selectedAdSet
      : state.draftTargetMode === 'existing_campaign'
        ? selectedCampaign
        : null;
  const draftTitle =
    state.draftTargetMode === 'new_campaign'
      ? state.campaignName
      : state.draftTargetMode === 'existing_adset'
        ? `New creative for ${selectedAdSet?.name ?? selectedCampaign?.name ?? 'existing ad set'}`
        : `New ad set for ${selectedCampaign?.name ?? 'existing campaign'}`;

  function renderCreativeFields(adSet: AdSetState, creative: CreativeState) {
    return (
      <>
        <SimpleGrid cols={2} spacing="xs">
          <Button
            variant={creative.contentSource === 'upload' ? 'filled' : 'light'}
            leftSection={<IconUpload size={15} />}
            onClick={() => updateCreative(adSet.id, creative.id, { contentSource: 'upload' })}
          >
            Upload
          </Button>
          <Button
            variant={creative.contentSource === 'existing' ? 'filled' : 'light'}
            leftSection={<IconPhoto size={15} />}
            onClick={() => updateCreative(adSet.id, creative.id, { contentSource: 'existing' })}
          >
            Existing
          </Button>
        </SimpleGrid>

        {creative.contentSource === 'existing' ? (
          <Button
            variant="default"
            leftSection={<IconPhoto size={16} />}
            onClick={() => setMediaTarget({ adSetId: adSet.id, creativeId: creative.id })}
          >
            {creative.selectedCreativeName || creative.existingCreativeIds[0]
              ? 'Change existing creative'
              : 'Choose existing creative'}
          </Button>
        ) : (
          <FileInput
            label="Upload creative"
            description="Supports Meta image and video upload formats. Browser-previewable videos play here."
            placeholder="Choose image, GIF, or video"
            accept={META_CREATIVE_ACCEPT}
            leftSection={<IconUpload size={16} />}
            value={creative.uploadedFiles[0] ?? null}
            onChange={(file) =>
              updateCreative(adSet.id, creative.id, {
                contentSource: 'upload',
                uploadedFiles: file ? [file] : [],
              })
            }
          />
        )}

        {creative.selectedCreativeName ? (
          <Text size="xs" c="dimmed">
            Selected: {creative.selectedCreativeName}
          </Text>
        ) : null}

        <TextInput
          label="Headline"
          maxLength={40}
          value={creative.adHeadline}
          onChange={(event) => updateCreative(adSet.id, creative.id, { adHeadline: event.currentTarget.value })}
        />
        <Textarea
          label="Primary text"
          autosize
          minRows={3}
          maxLength={180}
          value={creative.adPrimaryText}
          onChange={(event) => updateCreative(adSet.id, creative.id, { adPrimaryText: event.currentTarget.value })}
        />
        <TextInput
          label="Description"
          maxLength={40}
          value={creative.adDescription}
          onChange={(event) => updateCreative(adSet.id, creative.id, { adDescription: event.currentTarget.value })}
        />
        <Select
          label="Call to action"
          data={[
            { value: 'GET_OFFER', label: 'Get Offer' },
            { value: 'BOOK_NOW', label: 'Book Now' },
            { value: 'LEARN_MORE', label: 'Learn More' },
            { value: 'CONTACT_US', label: 'Contact Us' },
            { value: 'CALL_NOW', label: 'Call Now' },
            { value: 'SIGN_UP', label: 'Sign Up' },
          ]}
          value={creative.adCallToAction}
          onChange={(value) => updateCreative(adSet.id, creative.id, { adCallToAction: value || 'LEARN_MORE' })}
          allowDeselect={false}
        />
      </>
    );
  }

  function renderLeadMethodSetup() {
    return (
      <Paper withBorder radius="lg" p="md" bg={state.leadMethod === 'messages' ? 'green.0' : undefined}>
        <Stack gap="md">
          <Group gap="sm">
            <ThemeIcon color={state.leadMethod === 'messages' ? 'green' : 'blue'} variant="light" radius="xl">
              <IconDeviceMobileMessage size={18} />
            </ThemeIcon>
            <div>
              <Title order={4}>Lead method setup</Title>
              <Text size="sm" c="dimmed">
                {state.leadMethod === 'messages'
                  ? 'WhatsApp is the default message path. Keep response time tight so chats turn into booked leads.'
                  : 'Configure the selected lead path before saving the draft.'}
              </Text>
            </div>
          </Group>

          {state.leadMethod === 'instant_form' ? (
            <Stack gap="sm">
              <Select
                label="Instant form style"
                data={[
                  { value: 'higher_intent', label: 'Higher intent' },
                  { value: 'more_volume', label: 'More volume' },
                ]}
                value={state.methodSettings.instantForm.formStyle}
                onChange={(value) =>
                  updateMethodSettings({
                    instantForm: {
                      ...state.methodSettings.instantForm,
                      formStyle: (value as 'higher_intent' | 'more_volume') || 'higher_intent',
                    },
                  })
                }
                allowDeselect={false}
              />
              <TextInput
                label="Privacy policy URL"
                placeholder="https://example.com/privacy"
                value={state.methodSettings.instantForm.privacyPolicyUrl}
                onChange={(event) =>
                  updateMethodSettings({
                    instantForm: {
                      ...state.methodSettings.instantForm,
                      privacyPolicyUrl: event.currentTarget.value,
                    },
                  })
                }
              />
              <Textarea
                label="Qualifying questions"
                description="One per line"
                autosize
                minRows={4}
                value={state.methodSettings.instantForm.qualifyingQuestions.join('\n')}
                onChange={(event) =>
                  updateMethodSettings({
                    instantForm: {
                      ...state.methodSettings.instantForm,
                      qualifyingQuestions: event.currentTarget.value
                        .split('\n')
                        .map((item) => item.trim())
                        .filter(Boolean),
                    },
                  })
                }
              />
            </Stack>
          ) : null}

          {state.leadMethod === 'messages' ? (
            <Stack gap="sm">
              <Select
                label="Message destination"
                data={[
                  { value: 'whatsapp', label: 'WhatsApp (recommended)' },
                  { value: 'instagram', label: 'Instagram DMs' },
                  { value: 'messenger', label: 'Messenger' },
                ]}
                value={state.methodSettings.messages.channel}
                onChange={(value) => {
                  const channel = (value as 'whatsapp' | 'messenger' | 'instagram') || 'whatsapp';
                  const nextSettings = {
                    ...state.methodSettings,
                    messages: {
                      ...state.methodSettings.messages,
                      channel,
                    },
                  };

                  updateMethodSettings({
                    messages:
                      channel === 'whatsapp'
                        ? applyWhatsAppPhoneNumberDefaults(
                            nextSettings,
                            configuredWhatsAppNumbers[0] ?? null
                          ).messages
                        : nextSettings.messages,
                  });
                }}
                allowDeselect={false}
              />

              {state.methodSettings.messages.channel === 'whatsapp' ? (
                <Paper withBorder radius="md" p="md" bg="white">
                  <Stack gap="sm">
                    <Group gap="sm" align="flex-start">
                      <ThemeIcon color="green" variant="filled" radius="xl">
                        <IconMessageCircle size={18} />
                      </ThemeIcon>
                      <div>
                        <Text fw={900}>WhatsApp-first chat funnel</Text>
                        <Text size="sm" c="dimmed">
                          The draft will save WhatsApp as the message destination. Use the number confirmed during
                          Meta setup so message leads know where to reach the business.
                        </Text>
                      </div>
                    </Group>
                    <Select
                      label="WhatsApp number"
                      placeholder={
                        whatsappPhoneNumberOptions.length > 0
                          ? 'Choose a WhatsApp number'
                          : 'No saved WhatsApp number found'
                      }
                      data={whatsappPhoneNumberOptions}
                      value={state.methodSettings.messages.whatsappPhoneNumberId || null}
                      leftSection={
                        selectedWhatsAppPhoneNumber ? (
                          <Avatar
                            src={selectedWhatsAppPhoneNumber.pagePictureUrl ?? null}
                            size={24}
                            radius="xl"
                          >
                            {avatarLabel(
                              selectedWhatsAppPhoneNumber.pageName ||
                                selectedWhatsAppPhoneNumber.label ||
                                selectedWhatsAppPhoneNumber.display_phone_number
                            )}
                          </Avatar>
                        ) : null
                      }
                      onChange={(value) => {
                        const phoneNumber = configuredWhatsAppNumbers.find((item) => item.id === value);
                        updateMethodSettings({
                          messages: {
                            ...state.methodSettings.messages,
                            whatsappPhoneNumberId: phoneNumber?.id ?? '',
                            whatsappPhoneNumber: phoneNumber?.display_phone_number ?? '',
                            whatsappBusinessAccountId: '',
                            whatsappBusinessAccountName: '',
                            whatsappBusinessReady: false,
                          },
                        });
                      }}
                      searchable
                      disabled={whatsappPhoneNumberOptions.length === 0}
                      renderOption={({ option }) => {
                        const phoneOption = option as unknown as VisualSelectOption;
                        return (
                          <Group gap="sm" wrap="nowrap">
                            <Avatar src={phoneOption.imageUrl ?? null} size={32} radius="xl">
                              {avatarLabel(phoneOption.description || phoneOption.label)}
                            </Avatar>
                            <Stack gap={0}>
                              <Text size="sm" fw={800}>
                                {phoneOption.label}
                              </Text>
                              <Text size="xs" c="dimmed">
                                {phoneOption.description}
                              </Text>
                            </Stack>
                          </Group>
                        );
                      }}
                    />
                    {selectedWhatsAppPhoneNumber ? (
                      <Paper withBorder radius="md" p="sm" bg="green.0">
                        <Group justify="space-between" gap="sm" align="center" wrap="nowrap">
                          <Group gap="sm" wrap="nowrap">
                            <Avatar
                              src={selectedWhatsAppPhoneNumber.pagePictureUrl ?? null}
                              size={36}
                              radius="xl"
                            >
                              {avatarLabel(
                                selectedWhatsAppPhoneNumber.pageName ||
                                  selectedWhatsAppPhoneNumber.label ||
                                  selectedWhatsAppPhoneNumber.display_phone_number
                              )}
                            </Avatar>
                            <Stack gap={2}>
                              <Text size="sm" fw={900}>
                                {selectedWhatsAppPhoneNumber.display_phone_number}
                              </Text>
                              <Text size="xs" c="dimmed">
                                {selectedWhatsAppPhoneNumber.label || 'Saved during Meta setup'}
                              </Text>
                            </Stack>
                          </Group>
                          <Badge color="green" variant="light">
                            Saved
                          </Badge>
                        </Group>
                      </Paper>
                    ) : null}
                    {whatsappPhoneNumberOptions.length === 0 ? (
                      <Alert color="yellow" radius="md" icon={<IconAlertTriangle size={16} />}>
                        No WhatsApp number has been saved for this business yet. Finish Meta Page WhatsApp setup from
                        Integrations or choose Instagram DMs/Messenger for this draft.
                      </Alert>
                    ) : null}
                  </Stack>
                </Paper>
              ) : null}

              <Checkbox
                label="The business can respond quickly to new message leads."
                checked={state.methodSettings.messages.responseReady}
                onChange={(event) =>
                  updateMethodSettings({
                    messages: {
                      ...state.methodSettings.messages,
                      responseReady: event.currentTarget.checked,
                    },
                  })
                }
              />
            </Stack>
          ) : null}

          {state.leadMethod === 'calls' ? (
            <Stack gap="sm">
              <TextInput
                label="Phone number"
                placeholder="(555) 555-5555"
                value={state.methodSettings.calls.phoneNumber}
                onChange={(event) =>
                  updateMethodSettings({
                    calls: {
                      ...state.methodSettings.calls,
                      phoneNumber: event.currentTarget.value,
                    },
                  })
                }
              />
              <TextInput
                label="Call window"
                value={state.methodSettings.calls.callWindow}
                onChange={(event) =>
                  updateMethodSettings({
                    calls: {
                      ...state.methodSettings.calls,
                      callWindow: event.currentTarget.value,
                    },
                  })
                }
              />
              <Checkbox
                label="Calls will only run when someone can answer the phone."
                checked={state.methodSettings.calls.staffedHoursAcknowledged}
                onChange={(event) =>
                  updateMethodSettings({
                    calls: {
                      ...state.methodSettings.calls,
                      staffedHoursAcknowledged: event.currentTarget.checked,
                    },
                  })
                }
              />
            </Stack>
          ) : null}
        </Stack>
      </Paper>
    );
  }

  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        <Group justify="space-between" align="flex-start" gap="md">
          <Stack gap="xs" maw={780}>
            <Badge w="fit-content" size="lg" variant="light" color="blue">
              Meta lead campaign
            </Badge>
            <Title order={1}>Create a lead campaign</Title>
          </Stack>
          <Badge size="lg" variant="outline" color="gray">
            Review before launch
          </Badge>
        </Group>

        {errors.length > 0 ? (
          <Alert color="red" radius="lg" icon={<IconAlertTriangle size={18} />} title="Finish these items before saving">
            <Stack gap={4}>
              {errors.map((error) => (
                <Text key={error} size="sm">
                  {error}
                </Text>
              ))}
            </Stack>
          </Alert>
        ) : null}

        {savedDraft ? (
          <Alert color="green" radius="lg" icon={<IconCheck size={18} />} title="Campaign draft saved">
            {savedDraft.status === 'updated' ? 'Updated' : 'Created'} draft {savedDraft.draftId}.
          </Alert>
        ) : null}

        <Grid gutter="lg">
          <Grid.Col span={{ base: 12, lg: 8 }}>
            <Stack gap="lg">
              <Card withBorder radius="lg" p="lg">
                <Stack gap="md">
                  <Group gap="sm">
                    <ThemeIcon color="blue" variant="light" radius="xl">
                      <IconTargetArrow size={18} />
                    </ThemeIcon>
                    <div>
                      <Title order={3}>Where should this draft build?</Title>
                      <Text size="sm" c="dimmed">
                        Use the top-ranked existing campaign or ad set when Meta already has useful delivery history.
                      </Text>
                    </div>
                  </Group>

                  <Stack gap="sm">
                    <Group justify="space-between" align="center" gap="sm">
                      <div>
                        <Text fw={800}>Build target</Text>
                        <Text size="sm" c="dimmed">
                          Start fresh only when you need a clean campaign. Otherwise use the existing delivery history.
                        </Text>
                      </div>
                      {selectedCampaign?.isBest || selectedAdSet?.isBest ? (
                        <Badge color="yellow" variant="light" leftSection={<IconStarFilled size={12} />}>
                          Best selected
                        </Badge>
                      ) : null}
                    </Group>

                    <SimpleGrid cols={{ base: 1, md: 3 }}>
                      {targetCardCopy.map((target) => {
                        const Icon = target.icon;
                        const selected = state.draftTargetMode === target.mode;
                        const disabled = target.mode !== 'new_campaign' && campaigns.length === 0;

                        return (
                          <Paper
                            key={target.mode}
                            withBorder
                            radius="lg"
                            p="md"
                            bg={selected ? 'blue.0' : undefined}
                            style={{
                              cursor: disabled ? 'not-allowed' : 'pointer',
                              opacity: disabled ? 0.55 : 1,
                              borderColor: selected ? 'var(--mantine-color-blue-6)' : undefined,
                            }}
                            onClick={() => {
                              if (!disabled) {
                                updateDraftTargetMode(target.mode);
                              }
                            }}
                          >
                            <Stack gap="xs">
                              <ThemeIcon color="blue" variant={selected ? 'filled' : 'light'} radius="xl">
                                <Icon size={18} />
                              </ThemeIcon>
                              <Text fw={800}>{target.title}</Text>
                              <Text size="sm" c="dimmed">
                                {target.description}
                              </Text>
                            </Stack>
                          </Paper>
                        );
                      })}
                    </SimpleGrid>

                    {state.draftTargetMode !== 'new_campaign' ? (
                      <Paper withBorder radius="lg" p="md">
                        <Stack gap="md">
                          {recommendedTarget ? (
                            <Paper
                              withBorder
                              radius="lg"
                              p="md"
                              bg="yellow.0"
                              style={{
                                borderColor: 'var(--mantine-color-yellow-6)',
                                boxShadow: '0 12px 28px rgba(245, 159, 0, 0.14)',
                              }}
                            >
                              <Group justify="space-between" align="flex-start" gap="md">
                                <Group gap="sm" align="flex-start" wrap="nowrap">
                                  <ThemeIcon color="yellow" variant="filled" radius="xl">
                                    <IconStarFilled size={16} />
                                  </ThemeIcon>
                                  <Stack gap={3}>
                                    <Group gap="xs">
                                      <Text size="xs" fw={900} tt="uppercase" c="yellow.8">
                                        Recommended best performer
                                      </Text>
                                      {selectedTarget?.id === recommendedTarget.id ? (
                                        <Badge color="green" variant="light">
                                          Selected
                                        </Badge>
                                      ) : null}
                                    </Group>
                                    <Text fw={900}>{recommendedTarget.name}</Text>
                                    <Text size="sm" c="dimmed">
                                      {formatPerformance(recommendedTarget)}
                                    </Text>
                                  </Stack>
                                </Group>
                                {selectedTarget?.id !== recommendedTarget.id ? (
                                  <Button
                                    size="xs"
                                    color="yellow"
                                    variant="filled"
                                    onClick={() => {
                                      if (state.draftTargetMode === 'existing_adset') {
                                        const parentCampaign = selectedCampaign ?? recommendedCampaign;
                                        patchState({
                                          existingCampaignId: parentCampaign?.id ?? state.existingCampaignId,
                                          existingAdSetId: recommendedTarget.id,
                                        });
                                      } else {
                                        updateExistingCampaign(recommendedTarget.id);
                                      }
                                    }}
                                  >
                                    Use best
                                  </Button>
                                ) : null}
                              </Group>
                            </Paper>
                          ) : null}

                          <Select
                            label="Existing campaign"
                            placeholder={campaigns.length > 0 ? 'Choose a campaign' : 'No synced campaigns found'}
                            searchable
                            data={campaignSelectData}
                            value={state.existingCampaignId || null}
                            onChange={updateExistingCampaign}
                            disabled={campaigns.length === 0}
                            nothingFoundMessage="No campaigns found for this ad account"
                          />

                          {selectedCampaign ? (
                            <Paper
                              withBorder
                              radius="md"
                              p="sm"
                              bg={selectedCampaign.isBest ? 'yellow.0' : 'gray.0'}
                              style={{
                                borderColor: selectedCampaign.isBest ? 'var(--mantine-color-yellow-5)' : undefined,
                              }}
                            >
                            <Group justify="space-between" align="center" gap="sm">
                              <Stack gap={2}>
                                <Group gap="xs">
                                  <Text size="sm" fw={800}>{selectedCampaign.name}</Text>
                                  {selectedCampaign.isBest ? (
                                    <Badge color="yellow" variant="filled" leftSection={<IconStarFilled size={12} />}>
                                      Best performer
                                    </Badge>
                                  ) : null}
                                </Group>
                                <Text size="xs" c="dimmed">
                                  {formatPerformance(selectedCampaign)}
                                </Text>
                              </Stack>
                              <Badge variant="light" color={selectedCampaign.status?.toLowerCase() === 'active' ? 'green' : 'gray'}>
                                {selectedCampaign.status ?? 'Status unavailable'}
                              </Badge>
                            </Group>
                            </Paper>
                          ) : null}

                          {state.draftTargetMode === 'existing_adset' ? (
                            <Stack gap="sm">
                              <Select
                                label="Existing ad set"
                                placeholder={selectedCampaign ? 'Choose an ad set' : 'Choose a campaign first'}
                                searchable
                                data={adSetSelectData}
                                value={state.existingAdSetId || null}
                                onChange={(value) => patchState({ existingAdSetId: value ?? '' })}
                                disabled={!selectedCampaign || selectedCampaign.adset_metrics.length === 0}
                                nothingFoundMessage="No ad sets found in this campaign"
                              />

                              {selectedAdSet ? (
                                <Paper
                                  withBorder
                                  radius="md"
                                  p="sm"
                                  bg={selectedAdSet.isBest ? 'yellow.0' : 'gray.0'}
                                  style={{
                                    borderColor: selectedAdSet.isBest ? 'var(--mantine-color-yellow-5)' : undefined,
                                  }}
                                >
                                <Group justify="space-between" align="center" gap="sm">
                                  <Stack gap={2}>
                                    <Group gap="xs">
                                      <Text size="sm" fw={800}>{selectedAdSet.name}</Text>
                                      {selectedAdSet.isBest ? (
                                        <Badge color="yellow" variant="filled" leftSection={<IconStarFilled size={12} />}>
                                          Best performer
                                        </Badge>
                                      ) : null}
                                    </Group>
                                    <Text size="xs" c="dimmed">
                                      {formatPerformance(selectedAdSet)}
                                    </Text>
                                  </Stack>
                                  <Badge variant="light" color="blue">
                                    {selectedAdSet.ads_metrics.length} ads
                                  </Badge>
                                </Group>
                                </Paper>
                              ) : null}
                            </Stack>
                          ) : null}
                        </Stack>
                      </Paper>
                    ) : null}
                  </Stack>

	                  {state.draftTargetMode === 'new_campaign' ? (
	                    <TextInput
	                      label="Campaign name"
	                      placeholder="New client lead campaign"
	                      value={state.campaignName}
                      onChange={(event) => patchState({ campaignName: event.currentTarget.value })}
                      required
                    />
                  ) : null}

                  <Divider />

                  <Stack gap={4}>
                    <Title order={3}>Lead method</Title>
                    <Text size="sm" c="dimmed">
                      Objective is locked to Meta Leads; choose the lead path that matches operations.
                    </Text>
                  </Stack>

                  <SimpleGrid cols={{ base: 1, md: 3 }}>
                    {(Object.keys(methodCardCopy) as LeadCampaignLeadMethod[]).map((method) => {
                      const Icon = methodCardCopy[method].icon;
                      const selected = state.leadMethod === method;
                      return (
                        <Paper
                          key={method}
                          withBorder
                          radius="lg"
                          p="md"
                          bg={selected ? 'blue.0' : undefined}
                          style={{
                            cursor: 'pointer',
                            borderColor: selected ? 'var(--mantine-color-blue-6)' : undefined,
                          }}
                          onClick={() =>
                            setState((current) => ({
                              ...current,
                              leadMethod: method,
                              methodSettings:
                                method === 'messages' && current.methodSettings.messages.channel === 'whatsapp'
                                  ? applyWhatsAppPhoneNumberDefaults(
                                      current.methodSettings,
                                      configuredWhatsAppNumbers[0] ?? null
                                    )
                                  : current.methodSettings,
                              adSets: current.adSets.map((adSet) => ({
                                ...adSet,
                                optimizationGoal: optimizationGoalForLeadMethod(method),
                              })),
                            }))
                          }
                        >
                          <Stack gap="xs">
                            <ThemeIcon color="blue" variant={selected ? 'filled' : 'light'} radius="xl">
                              <Icon size={18} />
                            </ThemeIcon>
                            <Text fw={800}>{methodCardCopy[method].title}</Text>
                            <Text size="sm" c="dimmed">
                              {methodCardCopy[method].description}
                            </Text>
                          </Stack>
                        </Paper>
                      );
                    })}
                  </SimpleGrid>

                  {renderLeadMethodSetup()}

                </Stack>
              </Card>

              <Card withBorder radius="lg" p="lg">
                <Stack gap="md">
                  <Group gap="sm">
                    <ThemeIcon color="green" variant="light" radius="xl">
                      <IconMapPin size={18} />
                    </ThemeIcon>
                    <div>
                      <Title order={3}>Audience and Page</Title>
	                      <Text size="sm" c="dimmed">
	                        Keep the audience broad enough for Meta to learn, with location as the main control.
	                      </Text>
                    </div>
                  </Group>

                  <Select
                    label="Facebook Page"
                    placeholder={metaPages.length > 0 ? 'Select a Page' : 'No Meta Pages found'}
                    data={pageSelectOptions}
                    value={state.pageId}
                    onChange={(value) => patchState({ pageId: value ?? '' })}
                    error={pagesError}
                    disabled={metaPages.length === 0}
                    required
                    searchable
                    leftSection={
                      selectedPage ? (
                        <Avatar src={selectedPage.picture_url ?? null} size={24} radius="xl">
                          {avatarLabel(selectedPage.name)}
                        </Avatar>
                      ) : null
                    }
                    renderOption={({ option }) => {
                      const pageOption = option as unknown as VisualSelectOption;
                      return (
                        <Group gap="sm" wrap="nowrap">
                          <Avatar src={pageOption.imageUrl ?? null} size={32} radius="xl">
                            {avatarLabel(pageOption.label)}
                          </Avatar>
                          <Stack gap={0}>
                            <Text size="sm" fw={800}>
                              {pageOption.label}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {pageOption.description}
                            </Text>
                          </Stack>
                        </Group>
                      );
                    }}
                  />

                  <Paper withBorder radius="md" p="sm" bg={selectedInstagramLabel ? 'pink.0' : 'gray.0'}>
                    <Group gap="sm" wrap="nowrap" align="center">
                      {selectedInstagramLabel ? (
                        <Avatar
                          src={selectedPage?.instagram_account_picture_url ?? null}
                          size={38}
                          radius="xl"
                          color="pink"
                        >
                          <IconBrandInstagram size={18} />
                        </Avatar>
                      ) : (
                        <ThemeIcon color="gray" variant="light" radius="xl" size={38}>
                          <IconBrandInstagram size={18} />
                        </ThemeIcon>
                      )}
                      <Stack gap={2}>
                        <Group gap="xs" wrap="wrap">
                          <Text fw={800} size="sm">
                            Instagram account
                          </Text>
                          {selectedInstagramLabel ? (
                            <Badge color="pink" variant="light">
                              Connected
                            </Badge>
                          ) : (
                            <Badge color="gray" variant="light">
                              Not found
                            </Badge>
                          )}
                        </Group>
                        <Text size="sm">
                          {selectedInstagramLabel ?? 'No Instagram account is linked to this Facebook Page.'}
                        </Text>
                        <Text size="xs" c="dimmed">
                          This identity is saved with the draft for Instagram placements and Instagram DM leads.
                        </Text>
                      </Stack>
                    </Group>
                  </Paper>

                  {state.draftTargetMode === 'existing_adset' ? (
                    <Paper withBorder radius="lg" p="md">
                      <Stack gap="xs">
                        <Group justify="space-between" align="center" gap="sm">
                          <div>
                            <Text fw={800}>Using existing ad set</Text>
                            <Text size="sm" c="dimmed">
                              The saved draft will keep the selected ad set context and focus on the new creative angles.
                            </Text>
                          </div>
                          {selectedAdSet?.isBest ? (
                            <Badge color="yellow" variant="light" leftSection={<IconStarFilled size={12} />}>
                              Best ad set
                            </Badge>
                          ) : null}
                        </Group>
                        <Text size="sm">
                          {selectedAdSet?.name ?? 'Choose an ad set above'}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {formatPerformance(selectedAdSet)}
                        </Text>
                      </Stack>
                    </Paper>
                  ) : (
                    <>
                      <Grid gutter="md">
                        <Grid.Col span={{ base: 12, md: 8 }}>
                          <TextInput
                            label="Service area"
                            placeholder="Tampa, FL or Downtown Austin"
                            value={state.serviceArea}
                            onChange={(event) => patchState({ serviceArea: event.currentTarget.value })}
                            leftSection={<IconMapPin size={16} />}
                            required
                          />
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, md: 4 }}>
                          <NumberInput
                            label="Radius"
                            suffix=" miles"
                            min={1}
                            max={50}
                            value={state.radius}
                            onChange={(value) => patchState({ radius: Number(value) || 5 })}
                            required
                          />
                        </Grid.Col>
                      </Grid>

                      {state.adSets.map((adSet, index) => (
                        <Paper key={adSet.id} withBorder radius="lg" p="md">
                          <Stack gap="md">
                            <Group justify="space-between" align="flex-start" gap="md">
                              <div>
                                <Text fw={800}>{index === 0 ? 'Primary ad set' : 'Challenger ad set'}</Text>
                                <Text size="sm" c="dimmed">
                                  {index === 0
                                    ? state.draftTargetMode === 'existing_campaign'
                                      ? 'New ad set inside the selected existing campaign.'
                                      : 'Main delivery context for the campaign.'
                                    : 'Use only when you intentionally want to test a different audience.'}
                                </Text>
                              </div>
                              {index > 0 ? (
                                <Badge color="yellow" variant="light">
                                  Advanced
                                </Badge>
                              ) : null}
                            </Group>

                            <TextInput
                              label="Ad set name"
                              value={adSet.adSetName}
                              onChange={(event) => updateAdSet(adSet.id, { adSetName: event.currentTarget.value })}
                            />

                            <Group grow align="flex-start">
                              <Switch
                                label="Advantage+ Audience"
                                description="Recommended for lead learning."
                                checked={adSet.useAdvantageAudience}
                                onChange={(event) => updateAdSet(adSet.id, { useAdvantageAudience: event.currentTarget.checked })}
                              />
                              <Switch
                                label="Advantage+ Placements"
                                description="Recommended for Facebook and Instagram delivery."
                                checked={adSet.useAdvantagePlacements}
                                onChange={(event) => updateAdSet(adSet.id, { useAdvantagePlacements: event.currentTarget.checked })}
                              />
                            </Group>

                            <Box py="sm">
                              <details>
                                <summary style={{ cursor: 'pointer', fontWeight: 700 }}>
                                  Advanced targeting
                                </summary>
                                <Paper withBorder radius="md" p="md" mt="sm" bg="gray.0">
                                  <Grid gutter="md">
                                    <Grid.Col span={{ base: 6, md: 3 }}>
                                      <NumberInput
                                        label="Min age"
                                        min={18}
                                        max={65}
                                        value={adSet.ageMin}
                                        onChange={(value) => updateAdSet(adSet.id, { ageMin: Number(value) || 18 })}
                                      />
                                    </Grid.Col>
                                    <Grid.Col span={{ base: 6, md: 3 }}>
                                      <NumberInput
                                        label="Max age"
                                        min={18}
                                        max={65}
                                        value={adSet.ageMax}
                                        onChange={(value) => updateAdSet(adSet.id, { ageMax: Number(value) || 65 })}
                                      />
                                    </Grid.Col>
                                    <Grid.Col span={{ base: 12, md: 6 }}>
                                      <TextInput
                                        label="Interests"
                                        description="Optional; leave blank for broader learning."
                                        placeholder="Premium service, consultation, same-day opening"
                                        value={adSet.interestsText}
                                        onChange={(event) => updateAdSet(adSet.id, { interestsText: event.currentTarget.value })}
                                      />
                                    </Grid.Col>
                                  </Grid>
                                </Paper>
                              </details>
                            </Box>
                          </Stack>
                        </Paper>
                      ))}

                      <Alert color="yellow" variant="light" radius="lg" icon={<IconAlertTriangle size={18} />}>
                        A second ad set can fragment learning. Use it only when the audience or lead method is materially different.
                      </Alert>
                      <Switch
                        label="Add challenger ad set"
                        description="Advanced option for a separate audience test."
                        checked={state.adSets.length > 1}
                        onChange={(event) => toggleChallengerAdSet(event.currentTarget.checked)}
                      />
                    </>
                  )}
                </Stack>
              </Card>

              <Card withBorder radius="lg" p="lg">
                <Stack gap="md">
                  <Group gap="sm">
                    <ThemeIcon color="violet" variant="light" radius="xl">
                      <IconPhoto size={18} />
                    </ThemeIcon>
	                    <div>
	                      <Title order={3}>Creative angles</Title>
	                      <Text size="sm" c="dimmed">
	                        Start with one ad angle. Add another when you want to compare a different hook, visual, or offer.
	                      </Text>
	                    </div>
	                  </Group>

	                  {state.adSets.map((adSet) => (
	                    <Stack key={adSet.id} gap="md">
	                      <Group justify="space-between" align="center" gap="sm">
	                        <Text fw={800}>
	                          {state.draftTargetMode === 'existing_adset'
	                            ? selectedAdSet?.name ?? 'Selected ad set'
	                            : adSet.adSetName || 'Ad set'} creatives
	                        </Text>
	                        <Button
	                          size="xs"
	                          variant="light"
	                          leftSection={<IconPlus size={14} />}
	                          onClick={() => addCreativeAngle(adSet.id)}
	                        >
	                          Add creative angle
	                        </Button>
	                      </Group>

	                      {adSet.creatives.length === 1 ? (
	                        adSet.creatives.map((creative) => (
	                          <Paper key={creative.id} withBorder radius="lg" p="md">
                            <Grid gutter="lg" align="stretch">
	                              <Grid.Col span={{ base: 12, md: 7 }}>
	                                <Stack gap="sm">
	                                  <Badge w="fit-content" color="violet" variant="light">
	                                    Angle 1
	                                  </Badge>
	                                  {renderCreativeFields(adSet, creative)}
	                                </Stack>
	                              </Grid.Col>
	                              <Grid.Col span={{ base: 12, md: 5 }}>
	                                <Box h="100%" style={{ position: 'sticky', top: 12 }}>
	                                  <CreativeAdPreview creative={creative} pageName={selectedPageName} fullHeight />
	                                </Box>
	                              </Grid.Col>
	                            </Grid>
	                          </Paper>
	                        ))
	                      ) : (
	                        <Box style={{ overflowX: 'auto', paddingBottom: 8 }}>
	                          <Group gap="md" wrap="nowrap" align="stretch" style={{ minWidth: 'max-content' }}>
	                            {adSet.creatives.map((creative, creativeIndex) => (
	                              <Paper
	                                key={creative.id}
	                                withBorder
	                                radius="lg"
	                                p="md"
	                                style={{
	                                  flex: '0 0 340px',
	                                  maxWidth: 'calc(100vw - 48px)',
	                                }}
	                              >
	                                <Stack gap="sm" h="100%">
	                                  <Group justify="space-between" align="center">
	                                    <Badge color={creativeIndex === 0 ? 'violet' : 'gray'} variant="light">
	                                      {creativeIndex === 0 ? 'Angle 1' : `Angle ${creativeIndex + 1}`}
	                                    </Badge>
	                                    {creativeIndex > 0 ? (
	                                      <Button
	                                        size="compact-xs"
	                                        variant="subtle"
	                                        color="red"
	                                        leftSection={<IconTrash size={13} />}
	                                        onClick={() => removeCreativeAngle(adSet.id, creative.id)}
	                                      >
	                                        Remove
	                                      </Button>
	                                    ) : null}
	                                  </Group>

	                                  {renderCreativeFields(adSet, creative)}
	                                  <CreativeAdPreview creative={creative} pageName={selectedPageName} />
	                                </Stack>
	                              </Paper>
	                            ))}
	                          </Group>
	                        </Box>
	                      )}
	                    </Stack>
	                  ))}
	                </Stack>
              </Card>
            </Stack>
          </Grid.Col>

          <Grid.Col span={{ base: 12, lg: 4 }}>
            <Box style={{ position: 'sticky', top: 18 }}>
              <Stack gap="lg">
                <Card withBorder radius="lg" p="lg">
                  <Stack gap="md">
                    <Group gap="sm">
                      <ThemeIcon color="green" variant="light" radius="xl">
                        <IconCalendar size={18} />
                      </ThemeIcon>
                      <Title order={3}>Budget and estimate</Title>
                    </Group>
                    <NumberInput
                      label="Lifetime budget"
                      prefix="$"
                      min={50}
                      value={state.budgetAmount}
                      onChange={(value) => patchState({ budgetAmount: Number(value) || 0 })}
                      required
                    />
                    <DateTimePicker
                      label="Start date"
                      value={state.startDate}
                      onChange={(value) => patchState({ startDate: pickerValueToDate(value, new Date()) ?? new Date() })}
                      minDate={new Date()}
                    />
                    <DateTimePicker
                      label="End date"
                      value={state.endDate}
                      onChange={(value) => patchState({ endDate: pickerValueToDate(value, state.endDate) })}
                      minDate={state.startDate}
                      clearable={false}
                      required
                    />
                    <Paper withBorder radius="md" p="md" bg="green.0">
                      <Text fw={800}>
                        {dailyEquivalent ? `$${dailyEquivalent.amount}/day equivalent` : 'Set an end date'}
                      </Text>
                      <Text size="sm" c="dimmed">
                        {dailyEquivalent
                          ? `${dailyEquivalent.days} day run with a hard lifetime budget.`
                          : 'DeepVisor recommends a fixed 30-day window.'}
                      </Text>
                    </Paper>
                    <Paper withBorder radius="md" p="md">
                      <Stack gap="sm">
                        <Group gap="sm" align="flex-start">
                          <ThemeIcon color="blue" variant="light" radius="xl">
                            <IconChartLine size={18} />
                          </ThemeIcon>
                          <div>
                            <Text fw={800}>Estimated {leadEstimate.label}</Text>
                            <Text size="xs" c="dimmed">
                              Sub-linear model from {leadEstimate.sourceDetail.toLowerCase()}.
                            </Text>
                          </div>
                        </Group>
                        <Text fw={900} size="1.35rem">
                          {formatOutcomeCount(leadEstimate.low)}-{formatOutcomeCount(leadEstimate.high)}
                        </Text>
                        <Text size="sm" c="dimmed">
                          Around {formatOutcomeCount(leadEstimate.estimate)} {leadEstimate.label} at {formatMoney(state.budgetAmount)}.
                        </Text>
                        <LeadEstimateChart points={leadEstimate.points} />
                        <SimpleGrid cols={2} spacing="xs">
                          <Paper withBorder radius="sm" p="xs" bg="gray.0">
                            <Text size="xs" c="dimmed">Modeled cost</Text>
                            <Text size="sm" fw={800}>{formatMoney(leadEstimate.costPerOutcome)}</Text>
                          </Paper>
                          <Paper withBorder radius="sm" p="xs" bg="gray.0">
                            <Text size="xs" c="dimmed">Data source</Text>
                            <Text size="sm" fw={800} lineClamp={1}>
                              {leadEstimate.sourceLabel}
                            </Text>
                          </Paper>
                        </SimpleGrid>
                        {leadEstimate.usesFallback ? (
                          <Text size="xs" c="dimmed">
                            This will become more personal after more Meta performance is synced.
                          </Text>
                        ) : null}
                      </Stack>
                    </Paper>
                    <Divider />
                    <Button
                      size="md"
                      leftSection={<IconSparkles size={18} />}
                      loading={saving}
                      onClick={handleSaveDraft}
                    >
                      Save draft
                    </Button>
                  </Stack>
                </Card>
              </Stack>
            </Box>
          </Grid.Col>
        </Grid>
      </Stack>

      <MediaSelectionModal
        opened={Boolean(mediaTarget)}
        onClose={() => setMediaTarget(null)}
        onSelectCreative={(creative) => {
          if (mediaTarget) {
            updateCreative(mediaTarget.adSetId, mediaTarget.creativeId, {
              existingCreativeIds: creative ? [creative.id] : [],
              selectedCreativeName: creative?.name ?? '',
              contentSource: 'existing',
            });
          }
          setMediaTarget(null);
        }}
        objective={LEADS_OBJECTIVE}
        destinationType={destinationForLeadMethod(state.leadMethod, state.methodSettings)}
        platformId={platformData.id}
        adAccountId={adAccountId}
        initialSelectedId={activeMediaCreative?.existingCreativeIds[0] ?? null}
      />
    </Container>
  );
}
