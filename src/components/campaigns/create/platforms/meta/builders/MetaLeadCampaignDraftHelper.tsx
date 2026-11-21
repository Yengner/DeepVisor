'use client';

import '@mantine/dates/styles.css';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
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
  SegmentedControl,
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
  IconChevronLeft,
  IconChevronRight,
  IconDeviceMobileMessage,
  IconEye,
  IconMapPin,
  IconMessageCircle,
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
  CampaignReuseDraftSource,
  ManualCampaignDraftForm,
  LeadCampaignAdSetDraft,
  LeadCampaignCreativeDraft,
  LeadCampaignMethodSettings,
  LeadCampaignLeadMethod,
  LeadCampaignOfferTemplate,
} from '@/lib/shared/types/campaignDrafts';
import type { ConfiguredWhatsAppNumber } from '@/lib/shared/types/whatsappSetup';
import type { CampaignTreeAdsetNode, CampaignTreeNode } from '@/lib/server/data';
import type { MetaPage } from '@/lib/server/actions/meta/pages/actions';
import { formatCurrencyAmount } from '@/lib/shared';
import MediaSelectionModal from '../components/MediaSelectionModal';
import classes from './MetaLeadCampaignDraftHelper.module.css';

/** Interface text for this builder (`createLead.*`, EN/ES). Names and ad text people type stay as typed. */
type Translator = ReturnType<typeof useTranslations<'createLead'>>;
const CTA_KEYS = ['GET_OFFER', 'BOOK_NOW', 'LEARN_MORE', 'CONTACT_US', 'CALL_NOW', 'SIGN_UP'] as const;
function ctaLabel(t: Translator, value: string): string {
  return (CTA_KEYS as readonly string[]).includes(value) ? t(`creative.ctas.${value as typeof CTA_KEYS[number]}`) : value.replaceAll('_', ' ');
}

type MetaLeadCampaignDraftHelperProps = {
  platformData: {
    id: string;
    platform_name: string;
  };
  adAccountId: string;
  currencyCode: string | null;
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
  markerPosition: { lat: number; lng: number } | null;
  ageMin: number;
  ageMax: number;
  genders: string[];
  interestsText: string;
  creatives: CreativeState[];
};

type HelperState = {
  assistantMedia?: ManualCampaignDraftForm['assistantMedia'];
  initialStatus?: 'PAUSED';
  reviewRequired?: boolean;
  reuseSource?: CampaignReuseDraftSource;
  draftTargetMode: CampaignDraftTargetMode;
  existingCampaignId: string;
  existingAdSetId: string;
  campaignName: string;
  objective: string;
  specialAdCategories: string[];
  bidStrategy: string;
  buyingType: string;
  budgetOptimization: boolean;
  leadMethod: LeadCampaignLeadMethod;
  offerTemplate?: LeadCampaignOfferTemplate;
  pageId: string;
  serviceArea: string;
  radius: number;
  budgetType: 'daily' | 'lifetime';
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

type BuilderStage = 0 | 1 | 2;

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
  method: LeadCampaignLeadMethod;
  /** The ad set or campaign the estimate came from (its own name), when it came from one. */
  sourceName: string | null;
  sourceKind: 'adSet' | 'campaign' | 'account' | 'benchmark';
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
const SUPPORTED_HELPER_OBJECTIVES = new Set([
  'OUTCOME_LEADS',
  'OUTCOME_ENGAGEMENT',
  'LEAD_GENERATION',
  'MESSAGES',
]);
const SUPPORTED_REUSE_DESTINATIONS = new Set([
  FORM_DESTINATION,
  MESSAGE_DESTINATION,
  WHATSAPP_DESTINATION,
  CALL_DESTINATION,
  'INSTAGRAM_DIRECT',
]);
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

function formatMoney(value: number, currencyCode: string | null): string {
  return formatCurrencyAmount(value, currencyCode, {
    minimumFractionDigits: 0,
    maximumFractionDigits: value >= 100 ? 0 : 2,
  });
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

function formatPerformance(
  item: CampaignTreeNode | CampaignTreeAdsetNode | null,
  currencyCode: string | null,
  t: Translator
): string {
  if (!item?.performance) {
    return t('setup.perfNone');
  }
  const results = item.performance.results;
  return item.performance.costPerResult != null
    ? t('setup.perf', { results, cost: formatMoney(item.performance.costPerResult, currencyCode) })
    : t('setup.perfCostPending', { results });
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
    { kind: 'adSet' as const, name: input.selectedAdSet?.name ?? null, performance: input.selectedAdSet?.performance ?? null },
    { kind: 'campaign' as const, name: input.selectedCampaign?.name ?? null, performance: input.selectedCampaign?.performance ?? null },
    { kind: 'account' as const, name: null, performance: aggregateCampaignPerformance(input.campaigns) },
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
    method: input.leadMethod,
    sourceName: source?.name ?? null,
    sourceKind: source?.kind ?? 'benchmark',
    estimate,
    low: estimate * 0.75,
    high: estimate * 1.25,
    costPerOutcome,
    points,
    usesFallback: !source,
  };
}

function LeadEstimateChart({
  points,
  currencyCode,
}: {
  points: LeadEstimatePoint[];
  currencyCode: string | null;
}) {
  const t = useTranslations('createLead');
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
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label={t('estimate.chartAria')}>
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="var(--dv-border)" />
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="var(--dv-border)" />
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
              fill="var(--dv-card-panel)"
              stroke="var(--mantine-color-blue-6)"
              strokeWidth="2"
            />
          );
        })}
      </svg>
      <Group justify="space-between" mt={-6}>
        <Text size="xs" c="dimmed">{formatMoney(points[0]?.budget ?? 0, currencyCode)}</Text>
        <Text size="xs" c="dimmed">{formatMoney(points[points.length - 1]?.budget ?? 0, currencyCode)}</Text>
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
  const t = useTranslations('createLead');
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
      ? creative.selectedCreativeName || creative.existingCreativeIds[0] || t('preview.chooseExisting')
      : uploadedFile?.name || creative.uploadedFileNames?.[0] || t('preview.uploadMedia');
  const showImagePreview = Boolean(previewUrl && uploadedFile && isMetaImageFile(uploadedFile) && !previewFailed);
  const showVideoPreview = Boolean(previewUrl && uploadedFile && isMetaVideoFile(uploadedFile) && !previewFailed);

  return (
    <Paper withBorder radius="md" p="sm" bg="var(--dv-surface-muted)" h={fullHeight ? '100%' : undefined}>
      <Stack gap="xs" h={fullHeight ? '100%' : undefined}>
        <Group gap="xs" align="center">
          <Box
            w={28}
            h={28}
            style={{
              borderRadius: '50%',
              background: 'var(--dv-primary)',
            }}
          />
          <div>
            <Text size="sm" fw={800} lineClamp={1}>
              {pageName}
            </Text>
            <Text size="xs" c="dimmed">
              {t('preview.sponsored')}
            </Text>
          </div>
        </Group>

        <Text size="sm" lineClamp={3}>
          {creative.adPrimaryText || t('preview.primaryEmpty')}
        </Text>

        <Box
          h={fullHeight ? undefined : 164}
          mih={fullHeight ? 280 : undefined}
          style={{
            borderRadius: 8,
            overflow: 'hidden',
            border: '1px solid var(--dv-border)',
            background: 'var(--dv-card-panel)',
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
            <Text size="xs" c="dimmed">
              {t('preview.leadAd')}
            </Text>
            <Text size="sm" fw={800} lineClamp={1}>
              {creative.adHeadline || t('preview.headlineEmpty')}
            </Text>
            <Text size="xs" c="dimmed" lineClamp={1}>
              {creative.adDescription || t('preview.descriptionEmpty')}
            </Text>
          </div>
          <Box
            component="span"
            px="sm"
            py={6}
            style={{
              flexShrink: 0,
              border: '1px solid var(--dv-border-strong)',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            {ctaLabel(t, creative.adCallToAction)}
          </Box>
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
    linkUrl: '',
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
    markerPosition: null,
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
    sourceConfiguration: adSet.sourceConfiguration,
    markerPosition: adSet.targeting.markerPosition ?? null,
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
    initialStatus: draft?.initialStatus,
    reviewRequired: draft?.reviewRequired,
    assistantMedia: draft?.assistantMedia,
    reuseSource: draft?.reuseSource,
    draftTargetMode,
    existingCampaignId: draft?.draftTarget?.existingCampaignId ?? firstDraftAdSet?.existingCampaignId ?? '',
    existingAdSetId: draft?.draftTarget?.existingAdSetId ?? firstDraftAdSet?.existingAdSetId ?? '',
    campaignName: draft?.campaignName || 'Lead campaign',
    objective: draft?.objective || LEADS_OBJECTIVE,
    specialAdCategories: draft?.specialAdCategories?.length ? draft.specialAdCategories : ['NONE'],
    bidStrategy: draft?.bidStrategy || DEFAULT_BID_STRATEGY,
    buyingType: draft?.buyingType || DEFAULT_BUYING_TYPE,
    budgetOptimization: draft?.budgetOptimization ?? false,
    leadMethod,
    offerTemplate: draft?.offerTemplate,
    pageId: firstDraftAdSet?.pageId || draft?.pageId || defaults.pageId || '',
    serviceArea: firstDraftAdSet?.targeting.locationLabel || draft?.targeting.locationLabel || '',
    radius: firstDraftAdSet?.targeting.radius || draft?.targeting.radius || 5,
    budgetType: draft?.budgetType ?? 'lifetime',
    budgetAmount: draft && Number.isFinite(draft.budgetAmount)
      ? draft.budgetAmount
      : 600,
    startDate,
    endDate: draft
      ? dateFromIso(draft.endDate, null)
      : addDays(startDate, 30),
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
    linkUrl: creative.linkUrl,
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
    optimizationGoal: adSet.optimizationGoal || optimizationGoalForLeadMethod(state.leadMethod),
    useAdvantageAudience: adSet.useAdvantageAudience,
    useAdvantagePlacements: adSet.useAdvantagePlacements,
    billingEvent: adSet.billingEvent,
    sourceConfiguration: adSet.sourceConfiguration,
    targeting: {
      markerPosition: adSet.markerPosition,
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
      initialStatus: state.initialStatus,
      reviewRequired: state.reviewRequired,
      assistantMedia: state.assistantMedia,
      reuseSource: state.reuseSource,
      campaignName: state.draftTargetMode === 'new_campaign'
        ? state.campaignName
        : selectedCampaign?.name ?? state.campaignName,
      objective: state.objective,
      destinationType,
      specialAdCategories: state.specialAdCategories,
      bidStrategy: state.bidStrategy,
      buyingType: state.buyingType,
      budgetAmount: state.budgetAmount,
      budgetType: state.budgetType,
      budgetOptimization:
        state.budgetOptimization ||
        (state.draftTargetMode !== 'existing_adset' && persistedAdSets.length > 1),
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
      offerTemplate: state.offerTemplate,
      methodSettings: state.methodSettings,
      adSets: persistedAdSets,
      adSetName: firstAdSet.adSetName,
      pageId: state.pageId,
      instagramAccountId: selectedPage?.instagram_account_id ?? null,
      instagramAccountName: selectedPage?.instagram_account_name ?? null,
      instagramAccountUsername: selectedPage?.instagram_account_username ?? null,
      instagramAccountPictureUrl: selectedPage?.instagram_account_picture_url ?? null,
      optimizationGoal: firstAdSet.optimizationGoal,
      useAdvantageAudience: firstAdSet.useAdvantageAudience,
      useAdvantagePlacements: firstAdSet.useAdvantagePlacements,
      billingEvent: firstAdSet.billingEvent,
      targeting: firstAdSet.targeting,
      creative: {
        contentSource: firstCreative.contentSource,
        existingCreativeIds: firstCreative.existingCreativeIds,
        imageHash: firstCreative.imageHash,
        linkUrl: firstCreative.linkUrl,
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
  currencyCode,
  campaigns,
  draft,
  draftId,
  metaPages = [],
  pagesError = null,
  configuredWhatsAppNumbers = [],
}: MetaLeadCampaignDraftHelperProps) {
  const router = useRouter();
  const t = useTranslations('createLead');
  const [state, setState] = useState<HelperState>(() =>
    buildInitialState(draft, {
      pageId: metaPages[0]?.page_id,
      whatsappPhoneNumber: configuredWhatsAppNumbers[0] ?? null,
    })
  );
  const [activeStage, setActiveStage] = useState<BuilderStage>(0);
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
            page.phone ? t('audience.pagePhone', { phone: page.phone }) : t('audience.noPagePhone'),
            instagramLabel ? t('audience.instagramOf', { name: instagramLabel }) : null,
          ]
            .filter(Boolean)
            .join(' - '),
          imageUrl: page.picture_url ?? null,
        };
      }),
    [metaPages, t]
  );
  const whatsappPhoneNumberOptions = useMemo(
    () =>
      configuredWhatsAppNumbers.map((phoneNumber) => ({
        value: phoneNumber.id,
        label: phoneNumber.display_phone_number,
        description: phoneNumber.label || phoneNumber.pageName || t('setup.savedDuringSetup'),
        imageUrl: phoneNumber.pagePictureUrl ?? null,
      })),
    [configuredWhatsAppNumbers, t]
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
      amount: Math.round(
        (state.budgetType === 'daily' ? state.budgetAmount : state.budgetAmount / days) * 100
      ) / 100,
      totalAmount: Math.round(
        (state.budgetType === 'daily' ? state.budgetAmount * days : state.budgetAmount) * 100
      ) / 100,
    };
  }, [state.budgetAmount, state.budgetType, state.endDate, state.startDate]);
  const plannedBudgetAmount = dailyEquivalent?.totalAmount ?? state.budgetAmount;
  const leadEstimate = useMemo(
    () =>
      buildLeadEstimate({
        campaigns,
        selectedCampaign,
        selectedAdSet,
        leadMethod: state.leadMethod,
        budgetAmount: plannedBudgetAmount,
      }),
    [campaigns, plannedBudgetAmount, selectedCampaign, selectedAdSet, state.leadMethod]
  );
  const normalizedObjective = state.objective.trim().toUpperCase();
  const unsupportedReuseObjective = Boolean(
    state.reuseSource && !SUPPORTED_HELPER_OBJECTIVES.has(normalizedObjective)
  );
  const reuseDestination = state.adSets[0]?.sourceConfiguration?.destinationType?.trim().toUpperCase() || null;
  const unsupportedReuseDestination = Boolean(
    state.reuseSource && reuseDestination && !SUPPORTED_REUSE_DESTINATIONS.has(reuseDestination)
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

  /** Problems to fix before saving, each with the step where it is fixed. */
  function validate(): Array<{ stage: BuilderStage; message: string }> {
    const issues: Array<{ stage: BuilderStage; message: string }> = [];
    const add = (stage: BuilderStage, message: string) => issues.push({ stage, message });
    const primaryAdSet = state.adSets[0];
    const primaryCreative = primaryAdSet.creatives[0];

    if (unsupportedReuseObjective) add(0, t('errors.objective'));
    if (unsupportedReuseDestination) add(0, t('errors.destination'));
    if (state.draftTargetMode === 'new_campaign' && !state.campaignName.trim()) add(0, t('errors.campaignName'));
    if (state.draftTargetMode === 'existing_campaign' && !selectedCampaign) add(0, t('errors.chooseCampaign'));
    if (state.draftTargetMode === 'existing_adset') {
      if (!selectedCampaign) add(0, t('errors.chooseCampaignForAdSet'));
      if (!selectedAdSet) add(0, t('errors.chooseAdSet'));
    }

    if (!state.pageId) add(1, t('errors.page'));
    else if (state.reuseSource && !selectedPage) add(1, t('errors.pageUnavailable'));
    if (state.leadMethod === 'messages' && state.methodSettings.messages.channel === 'instagram' && !selectedPage?.instagram_account_id) {
      add(1, t('errors.instagram'));
    }
    if (state.draftTargetMode !== 'existing_adset' && !state.serviceArea.trim()) add(1, t('errors.area'));
    if (state.draftTargetMode !== 'existing_adset' && (!state.radius || state.radius <= 0)) add(1, t('errors.radius'));

    const minimumBudget = state.budgetType === 'daily' ? 1 : 50;
    if (!state.budgetAmount || state.budgetAmount < minimumBudget) {
      add(0, t(state.budgetType === 'daily' ? 'errors.budgetDaily' : 'errors.budgetLifetime', { amount: formatMoney(minimumBudget, currencyCode) }));
    }
    if (!state.endDate) add(0, t('errors.end'));

    const usesExistingCreative = primaryCreative.contentSource === 'existing' && primaryCreative.existingCreativeIds.length > 0;
    if (!usesExistingCreative && (!primaryCreative.adHeadline.trim() || !primaryCreative.adPrimaryText.trim())) add(2, t('errors.copy'));

    if (state.leadMethod === 'messages') {
      if (state.methodSettings.messages.channel === 'whatsapp') {
        if (!state.methodSettings.messages.whatsappPhoneNumber?.trim()) add(0, t('errors.whatsapp'));
        else if (configuredWhatsAppNumbers.length > 0 && !selectedWhatsAppPhoneNumber) add(0, t('errors.whatsappSaved'));
      }
      if (!state.methodSettings.messages.responseReady) add(0, t('errors.respond'));
    }
    if (state.leadMethod === 'calls') {
      if (!state.methodSettings.calls.phoneNumber.trim()) add(0, t('errors.phone'));
      if (!state.methodSettings.calls.staffedHoursAcknowledged) add(0, t('errors.callsAnswer'));
    }
    return issues;
  }

  async function handleSaveDraft() {
    const issues = validate();
    setErrors(issues.map(issue => issue.message));
    setSavedDraft(null);

    if (issues.length > 0) {
      // Open the step where the first problem is fixed.
      setActiveStage(issues[0].stage);
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
        throw new Error(result.error || t('errors.saveFailed'));
      }

      setSavedDraft(result.data);
      setCurrentDraftId(result.data.draftId);
      if (!currentDraftId) {
        router.replace(result.data.href);
      } else {
        router.refresh();
      }
    } catch (error) {
      setErrors([error instanceof Error ? error.message : t('errors.saveFailed')]);
    } finally {
      setSaving(false);
    }
  }

  const targetModes = ['new_campaign', 'existing_campaign', 'existing_adset'] as const;
  const campaignSelectData = campaigns.map((campaign) => ({
    value: campaign.id,
    label: campaign.isBest ? t('setup.bestOption', { name: campaign.name }) : campaign.name,
  }));
  const adSetSelectData = (selectedCampaign?.adset_metrics ?? []).map((adSet) => ({
      value: adSet.id,
      label: adSet.isBest ? t('setup.bestOption', { name: adSet.name }) : adSet.name,
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
        {/* A choice, not two blue buttons competing with Save. */}
        <SegmentedControl
          fullWidth
          aria-label={t('creative.source')}
          value={creative.contentSource}
          onChange={(value) => updateCreative(adSet.id, creative.id, { contentSource: value as CreativeState['contentSource'] })}
          data={[
            { value: 'upload', label: t('creative.upload') },
            { value: 'existing', label: t('creative.existing') },
          ]}
        />

        {creative.contentSource === 'existing' ? (
          <Button
            variant="default"
            leftSection={<IconPhoto size={16} />}
            onClick={() => setMediaTarget({ adSetId: adSet.id, creativeId: creative.id })}
          >
            {creative.selectedCreativeName || creative.existingCreativeIds[0]
              ? t('creative.change')
              : t('creative.choose')}
          </Button>
        ) : (
          <FileInput
            label={t('creative.uploadLabel')}
            description={t('creative.uploadHint')}
            placeholder={t('creative.uploadPlaceholder')}
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
            {t('creative.selectedName', { name: creative.selectedCreativeName })}
          </Text>
        ) : null}

        <TextInput
          label={t('creative.headline')}
          maxLength={40}
          value={creative.adHeadline}
          onChange={(event) => updateCreative(adSet.id, creative.id, { adHeadline: event.currentTarget.value })}
        />
        <Textarea
          label={t('creative.primaryText')}
          autosize
          minRows={3}
          maxLength={180}
          value={creative.adPrimaryText}
          onChange={(event) => updateCreative(adSet.id, creative.id, { adPrimaryText: event.currentTarget.value })}
        />
        <TextInput
          label={t('creative.description')}
          maxLength={40}
          value={creative.adDescription}
          onChange={(event) => updateCreative(adSet.id, creative.id, { adDescription: event.currentTarget.value })}
        />
        <TextInput
          label={t('creative.url')}
          description={t('creative.urlHint')}
          placeholder="https://example.com/book"
          type="url"
          value={creative.linkUrl || ''}
          onChange={(event) => updateCreative(adSet.id, creative.id, { linkUrl: event.currentTarget.value })}
        />
        <Select
          label={t('creative.cta')}
          data={CTA_KEYS.map((value) => ({ value, label: t(`creative.ctas.${value}`) }))}
          value={creative.adCallToAction}
          onChange={(value) => updateCreative(adSet.id, creative.id, { adCallToAction: value || 'LEARN_MORE' })}
          allowDeselect={false}
        />
      </>
    );
  }

  function renderLeadMethodSetup() {
    return (
      <Paper withBorder radius="lg" p="md" bg={state.leadMethod === 'messages' ? 'var(--dv-success-soft)' : undefined}>
        <Stack gap="md">
          <Group gap="sm">
            <ThemeIcon color={state.leadMethod === 'messages' ? 'green' : 'blue'} variant="light" radius="xl">
              <IconDeviceMobileMessage size={18} />
            </ThemeIcon>
            <div>
              <Title order={4}>{t('setup.settingsTitle')}</Title>
              <Text size="sm" c="dimmed">
                {state.leadMethod === 'messages' ? t('setup.settingsLeadMessages') : t('setup.settingsLeadOther')}
              </Text>
            </div>
          </Group>

          {state.leadMethod === 'instant_form' ? (
            <Stack gap="sm">
              <Select
                label={t('setup.formStyle')}
                data={[
                  { value: 'higher_intent', label: t('setup.higherIntent') },
                  { value: 'more_volume', label: t('setup.moreVolume') },
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
                label={t('setup.privacy')}
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
                label={t('setup.questions')}
                description={t('setup.questionsHint')}
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
                label={t('setup.sendTo')}
                data={[
                  { value: 'whatsapp', label: t('setup.channel.whatsapp') },
                  { value: 'instagram', label: t('setup.channel.instagram') },
                  { value: 'messenger', label: t('setup.channel.messenger') },
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
                <Paper withBorder radius="md" p="md" bg="var(--dv-card-panel)">
                  <Stack gap="sm">
                    <Group gap="sm" align="flex-start">
                      <ThemeIcon color="green" variant="filled" radius="xl">
                        <IconMessageCircle size={18} />
                      </ThemeIcon>
                      <div>
                        <Text fw={900}>{t('setup.whatsappTitle')}</Text>
                        <Text size="sm" c="dimmed">
                          {t('setup.whatsappBody')}
                        </Text>
                      </div>
                    </Group>
                    <Select
                      label={t('setup.whatsappNumber')}
                      placeholder={
                        whatsappPhoneNumberOptions.length > 0
                          ? t('setup.chooseNumber')
                          : t('setup.noNumber')
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
                      <Paper withBorder radius="md" p="sm" bg="var(--dv-success-soft)">
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
                                {selectedWhatsAppPhoneNumber.label || t('setup.savedDuringSetup')}
                              </Text>
                            </Stack>
                          </Group>
                          <span className={classes.pillOk}>{t('setup.saved')}</span>
                        </Group>
                      </Paper>
                    ) : null}
                    {whatsappPhoneNumberOptions.length === 0 ? (
                      <Alert color="yellow" radius="md" icon={<IconAlertTriangle size={16} />}>
                        {t('setup.noNumberAlert')}
                      </Alert>
                    ) : null}
                  </Stack>
                </Paper>
              ) : null}

              <Checkbox
                label={t('setup.respondQuickly')}
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
                label={t('setup.phone')}
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
                label={t('setup.callWindow')}
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
                label={t('setup.callsAnswer')}
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
    <Container size="xl" py="xl" className={classes.page}>
      <Stack gap="xl">
        {/* Headline, one plain sentence, and the reassurance, like the Insights popup. */}
        <header className={classes.hero}>
          <h1 className={classes.heroTitle}>{state.reuseSource ? t('hero.titleRerun') : t('hero.title')}</h1>
          <p className={classes.heroLead}>{t('hero.lead')}</p>
          <p className={classes.heroReassure}><IconEye size={16} aria-hidden="true" />{t('hero.reassure')}</p>
        </header>

        {state.initialStatus === 'PAUSED' ? (
          <Alert color="green" radius="md" icon={<IconCheck size={18} />} title={t('notice.pausedTitle')}>
            {t('notice.pausedBody')}
          </Alert>
        ) : null}

        {!!state.assistantMedia?.length && currentDraftId && <Alert color="blue" title={t('notice.attachmentsTitle')}>
          {t('notice.attachmentsBody')}
          {state.assistantMedia.map(file => <div key={file.id}><a href={`/api/intelligence/assistant/media?id=${encodeURIComponent(file.id)}&draft=${encodeURIComponent(currentDraftId)}&account=${encodeURIComponent(adAccountId)}`} target="_blank" rel="noreferrer">{file.name} ↗</a></div>)}
        </Alert>}

        {state.reuseSource?.configurationCoverage === 'partial' ? (
          <Alert
            color="yellow"
            radius="md"
            icon={<IconAlertTriangle size={18} />}
            title={t('notice.partialTitle')}
          >
            {t('notice.partialBody', { fields: state.reuseSource.missingConfiguration?.join(', ') || t('notice.partialAll') })}
          </Alert>
        ) : null}

        {unsupportedReuseObjective ? (
          <Alert
            color="red"
            radius="md"
            icon={<IconAlertTriangle size={18} />}
            title={t('notice.reviewTitle')}
          >
            {t('notice.objectiveBody', { objective: state.objective || t('notice.unknown') })}
          </Alert>
        ) : null}

        {unsupportedReuseDestination ? (
          <Alert
            color="red"
            radius="md"
            icon={<IconAlertTriangle size={18} />}
            title={t('notice.reviewTitle')}
          >
            {t('notice.destinationBody', { destination: reuseDestination ?? t('notice.unknown') })}
          </Alert>
        ) : null}

        {errors.length > 0 ? (
          <Alert color="red" radius="lg" icon={<IconAlertTriangle size={18} />} title={t('notice.errorsTitle')}>
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
          <Alert color="green" radius="lg" icon={<IconCheck size={18} />} title={t('notice.savedTitle')}>
            {savedDraft.status === 'updated' ? t('notice.savedUpdated') : t('notice.savedCreated')}{' '}
            <a href="/campaigns/drafts" className={classes.inlineLink}>{t('notice.seeDrafts')}</a>
          </Alert>
        ) : null}

        {/* The tabs are the only step label. */}
        <div className={classes.stageHeader}>
          <SegmentedControl
            fullWidth
            value={String(activeStage)}
            onChange={(value) => setActiveStage(Number(value) as BuilderStage)}
            data={[
              { value: '0', label: t('steps.setup') },
              { value: '1', label: t('steps.audience') },
              { value: '2', label: t('steps.creative') },
            ]}
            aria-label={t('steps.label')}
            className={classes.stageControl}
          />
        </div>

        <Grid gutter="lg">
          <Grid.Col span={{ base: 12, lg: activeStage === 1 ? 12 : 8 }}>
            <Stack gap="lg">
              <Box className={activeStage === 0 ? classes.stageVisible : classes.stageHidden}>
              <Card withBorder radius="lg" p="lg" className={classes.sectionCard}>
                <Stack gap="md">
                  <Group gap="sm">
                    <ThemeIcon color="blue" variant="light" radius="xl">
                      <IconTargetArrow size={18} />
                    </ThemeIcon>
                    <div>
                      <Title order={3}>{t('setup.title')}</Title>
                      <Text size="sm" c="dimmed">
                        {t('setup.lead')}
                      </Text>
                    </div>
                  </Group>

                  <Stack gap="sm">
                    {selectedCampaign?.isBest || selectedAdSet?.isBest ? (
                      <span className={classes.pillOk}><IconStarFilled size={12} aria-hidden="true" /> {t('setup.bestSelected')}</span>
                    ) : null}

                    <SegmentedControl
                      fullWidth
                      value={state.draftTargetMode}
                      onChange={(value) => updateDraftTargetMode(value as CampaignDraftTargetMode)}
                      data={targetModes.map((mode) => ({
                        value: mode,
                        label: t(`setup.target.${mode}`),
                        disabled: mode !== 'new_campaign' && campaigns.length === 0,
                      }))}
                    />
                    <Text size="sm" c="dimmed">
                      {t(`setup.targetHelp.${state.draftTargetMode}`)}
                    </Text>

                    {state.draftTargetMode !== 'new_campaign' ? (
                      <Paper withBorder radius="lg" p="md">
                        <Stack gap="md">
                          {recommendedTarget ? (
                            <Paper
                              withBorder
                              radius="lg"
                              p="md"
                              bg="var(--dv-gap-bg)"
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
                                      <Text size="sm" fw={800}>
                                        {t('setup.recommended')}
                                      </Text>
                                      {selectedTarget?.id === recommendedTarget.id ? (
                                        <span className={classes.pillOk}>{t('setup.selected')}</span>
                                      ) : null}
                                    </Group>
                                    <Text fw={900}>{recommendedTarget.name}</Text>
                                    <Text size="sm" c="dimmed">
                                      {formatPerformance(recommendedTarget, currencyCode, t)}
                                    </Text>
                                  </Stack>
                                </Group>
                                {selectedTarget?.id !== recommendedTarget.id ? (
                                  <Button
                                    size="sm"
                                    variant="default"
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
                                    {t('setup.useBest')}
                                  </Button>
                                ) : null}
                              </Group>
                            </Paper>
                          ) : null}

                          <Select
                            label={t('setup.campaign')}
                            placeholder={campaigns.length > 0 ? t('setup.chooseCampaign') : t('setup.noCampaigns')}
                            searchable
                            data={campaignSelectData}
                            value={state.existingCampaignId || null}
                            onChange={updateExistingCampaign}
                            disabled={campaigns.length === 0}
                            nothingFoundMessage={t('setup.noCampaignsFound')}
                          />

                          {selectedCampaign ? (
                            <Paper
                              withBorder
                              radius="md"
                              p="sm"
                              bg={selectedCampaign.isBest ? 'var(--dv-gap-bg)' : 'var(--dv-card-inset)'}
                              style={{
                                borderColor: selectedCampaign.isBest ? 'var(--mantine-color-yellow-5)' : undefined,
                              }}
                            >
                            <Group justify="space-between" align="center" gap="sm">
                              <Stack gap={2}>
                                <Group gap="xs">
                                  <Text size="sm" fw={800}>{selectedCampaign.name}</Text>
                                  {selectedCampaign.isBest ? (
                                    <span className={classes.pillWarm}><IconStarFilled size={12} aria-hidden="true" /> {t('setup.bestPerformer')}</span>
                                  ) : null}
                                </Group>
                                <Text size="xs" c="dimmed">
                                  {formatPerformance(selectedCampaign, currencyCode, t)}
                                </Text>
                              </Stack>
                              <Badge variant="light" color={selectedCampaign.status?.toLowerCase() === 'active' ? 'green' : 'gray'}>
                                {selectedCampaign.status ?? t('setup.statusUnknown')}
                              </Badge>
                            </Group>
                            </Paper>
                          ) : null}

                          {state.draftTargetMode === 'existing_adset' ? (
                            <Stack gap="sm">
                              <Select
                                label={t('setup.adSet')}
                                placeholder={selectedCampaign ? t('setup.chooseAdSet') : t('setup.chooseCampaignFirst')}
                                searchable
                                data={adSetSelectData}
                                value={state.existingAdSetId || null}
                                onChange={(value) => patchState({ existingAdSetId: value ?? '' })}
                                disabled={!selectedCampaign || selectedCampaign.adset_metrics.length === 0}
                                nothingFoundMessage={t('setup.noAdSets')}
                              />

                              {selectedAdSet ? (
                                <Paper
                                  withBorder
                                  radius="md"
                                  p="sm"
                                  bg={selectedAdSet.isBest ? 'var(--dv-gap-bg)' : 'var(--dv-card-inset)'}
                                  style={{
                                    borderColor: selectedAdSet.isBest ? 'var(--mantine-color-yellow-5)' : undefined,
                                  }}
                                >
                                <Group justify="space-between" align="center" gap="sm">
                                  <Stack gap={2}>
                                    <Group gap="xs">
                                      <Text size="sm" fw={800}>{selectedAdSet.name}</Text>
                                      {selectedAdSet.isBest ? (
                                        <span className={classes.pillWarm}><IconStarFilled size={12} aria-hidden="true" /> {t('setup.bestPerformer')}</span>
                                      ) : null}
                                    </Group>
                                    <Text size="xs" c="dimmed">
                                      {formatPerformance(selectedAdSet, currencyCode, t)}
                                    </Text>
                                  </Stack>
                                  <Badge variant="light" color="blue">
                                    {t('setup.adsCount', { count: selectedAdSet.ads_metrics.length })}
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
	                      label={t('setup.campaignName')}
	                      placeholder={t('setup.campaignNamePlaceholder')}
	                      value={state.campaignName}
                      onChange={(event) => patchState({ campaignName: event.currentTarget.value })}
                      required
                    />
                  ) : null}

                  <Divider />

                  <Stack gap={4}>
                    <Title order={3}>{t('setup.methodTitle')}</Title>
                    <Text size="sm" c="dimmed">
                      {t('setup.methodLead')}
                    </Text>
                  </Stack>

                  <SegmentedControl
                    fullWidth
                    value={state.leadMethod}
                    onChange={(value) => {
                      const method = value as LeadCampaignLeadMethod;
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
                      }));
                    }}
                    data={[
                      { value: 'messages', label: t('setup.method.messages') },
                      { value: 'instant_form', label: t('setup.method.instant_form') },
                      { value: 'calls', label: t('setup.method.calls') },
                    ]}
                  />
                  <Text size="sm" c="dimmed">
                    {t(`setup.methodHelp.${state.leadMethod}`)}
                  </Text>

                  {renderLeadMethodSetup()}

                </Stack>
              </Card>
              </Box>

              <Box className={activeStage === 1 ? classes.stageVisible : classes.stageHidden}>
              <Card withBorder radius="lg" p="lg" className={classes.sectionCard}>
                <Stack gap="md">
                  <Group gap="sm">
                    <ThemeIcon color="green" variant="light" radius="xl">
                      <IconMapPin size={18} />
                    </ThemeIcon>
                    <div>
                      <Title order={3}>{t('audience.title')}</Title>
	                      <Text size="sm" c="dimmed">
	                        {t('audience.lead')}
	                      </Text>
                    </div>
                  </Group>

                  <Select
                    label={t('audience.page')}
                    placeholder={metaPages.length > 0 ? t('audience.selectPage') : t('audience.noPages')}
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

                  <Paper withBorder radius="md" p="sm" bg="var(--dv-card-inset)">
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
                            {t('audience.instagram')}
                          </Text>
                          {selectedInstagramLabel ? (
                            <span className={classes.pillOk}>{t('audience.connected')}</span>
                          ) : (
                            <span className={classes.pill}>{t('audience.notFound')}</span>
                          )}
                        </Group>
                        <Text size="sm">
                          {selectedInstagramLabel ?? t('audience.noInstagram')}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {t('audience.instagramHint')}
                        </Text>
                      </Stack>
                    </Group>
                  </Paper>

                  {state.draftTargetMode === 'existing_adset' ? (
                    <Paper withBorder radius="lg" p="md">
                      <Stack gap="xs">
                        <Group justify="space-between" align="center" gap="sm">
                          <div>
                            <Text fw={800}>{t('audience.usingAdSet')}</Text>
                            <Text size="sm" c="dimmed">
                              {t('audience.usingAdSetHint')}
                            </Text>
                          </div>
                          {selectedAdSet?.isBest ? (
                            <span className={classes.pillWarm}><IconStarFilled size={12} aria-hidden="true" /> {t('audience.bestAdSet')}</span>
                          ) : null}
                        </Group>
                        <Text size="sm">
                          {selectedAdSet?.name ?? t('audience.chooseAdSetAbove')}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {formatPerformance(selectedAdSet, currencyCode, t)}
                        </Text>
                      </Stack>
                    </Paper>
                  ) : (
                    <>
                      <Grid gutter="md">
                        <Grid.Col span={{ base: 12, md: 8 }}>
                          <TextInput
                            label={t('audience.area')}
                            placeholder={t('audience.areaPlaceholder')}
                            value={state.serviceArea}
                            onChange={(event) => patchState({ serviceArea: event.currentTarget.value })}
                            leftSection={<IconMapPin size={16} />}
                            required
                          />
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, md: 4 }}>
                          <NumberInput
                            label={t('audience.radius')}
                            suffix={t('audience.miles')}
                            hideControls
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
                                <Text fw={800}>{index === 0 ? t('audience.primary') : t('audience.challenger')}</Text>
                                <Text size="sm" c="dimmed">
                                  {index === 0
                                    ? state.draftTargetMode === 'existing_campaign'
                                      ? t('audience.primaryNew')
                                      : t('audience.primaryMain')
                                    : t('audience.challengerHint')}
                                </Text>
                              </div>
                              {index > 0 ? (
                                <span className={classes.pill}>{t('audience.advanced')}</span>
                              ) : null}
                            </Group>

                            <TextInput
                              label={t('audience.adSetName')}
                              value={adSet.adSetName}
                              onChange={(event) => updateAdSet(adSet.id, { adSetName: event.currentTarget.value })}
                            />

                            <Group grow align="flex-start">
                              <Switch
                                label={t('audience.advantageAudience')}
                                description={t('audience.advantageAudienceHint')}
                                checked={adSet.useAdvantageAudience}
                                onChange={(event) => updateAdSet(adSet.id, { useAdvantageAudience: event.currentTarget.checked })}
                              />
                              <Switch
                                label={t('audience.advantagePlacements')}
                                description={t('audience.advantagePlacementsHint')}
                                checked={adSet.useAdvantagePlacements}
                                onChange={(event) => updateAdSet(adSet.id, { useAdvantagePlacements: event.currentTarget.checked })}
                              />
                            </Group>

                            <Box py="sm">
                              <details>
                                <summary className={classes.summary}>
                                  {t('audience.moreTargeting')}
                                </summary>
                                <Paper withBorder radius="md" p="md" mt="sm" bg="var(--dv-surface-muted)">
                                  <Grid gutter="md">
                                    <Grid.Col span={{ base: 6, md: 3 }}>
                                      <NumberInput
                                        label={t('audience.minAge')}
                                        hideControls
                                        min={18}
                                        max={65}
                                        value={adSet.ageMin}
                                        onChange={(value) => updateAdSet(adSet.id, { ageMin: Number(value) || 18 })}
                                      />
                                    </Grid.Col>
                                    <Grid.Col span={{ base: 6, md: 3 }}>
                                      <NumberInput
                                        label={t('audience.maxAge')}
                                        hideControls
                                        min={18}
                                        max={65}
                                        value={adSet.ageMax}
                                        onChange={(value) => updateAdSet(adSet.id, { ageMax: Number(value) || 65 })}
                                      />
                                    </Grid.Col>
                                    <Grid.Col span={{ base: 12, md: 6 }}>
                                      <TextInput
                                        label={t('audience.interests')}
                                        description={t('audience.interestsHint')}
                                        placeholder={t('audience.interestsPlaceholder')}
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
                        {t('audience.secondWarning')}
                      </Alert>
                      <Switch
                        label={t('audience.addSecond')}
                        description={t('audience.addSecondHint')}
                        checked={state.adSets.length > 1}
                        onChange={(event) => toggleChallengerAdSet(event.currentTarget.checked)}
                      />
                    </>
                  )}
                </Stack>
              </Card>
              </Box>

              <Box className={activeStage === 2 ? classes.stageVisible : classes.stageHidden}>
              <Card withBorder radius="lg" p="lg" className={classes.sectionCard}>
                <Stack gap="md">
                  <Group gap="sm">
                    <ThemeIcon color="violet" variant="light" radius="xl">
                      <IconPhoto size={18} />
                    </ThemeIcon>
	                    <div>
	                      <Title order={3}>{t('creative.title')}</Title>
	                      <Text size="sm" c="dimmed">
	                        {t('creative.lead')}
	                      </Text>
	                    </div>
	                  </Group>

	                  {state.adSets.map((adSet) => (
	                    <Stack key={adSet.id} gap="md">
	                      <Group justify="space-between" align="center" gap="sm">
	                        <Text fw={800}>
	                          {t('creative.adsFor', {
	                            name: (state.draftTargetMode === 'existing_adset' ? selectedAdSet?.name : adSet.adSetName) || t('creative.thisAudience'),
	                          })}
	                        </Text>
	                        <Button
	                          variant="light"
	                          leftSection={<IconPlus size={16} />}
	                          onClick={() => addCreativeAngle(adSet.id)}
	                        >
	                          {t('creative.addVersion')}
	                        </Button>
	                      </Group>

	                      {adSet.creatives.length === 1 ? (
	                        adSet.creatives.map((creative) => (
	                          <Paper key={creative.id} withBorder radius="lg" p="md">
                            <Grid gutter="lg" align="stretch">
	                              <Grid.Col span={{ base: 12, md: 7 }}>
	                                <Stack gap="sm">
	                                  <Badge w="fit-content" color="violet" variant="light">
	                                    {t('creative.version', { n: 1 })}
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
	                                      {t('creative.version', { n: creativeIndex + 1 })}
	                                    </Badge>
	                                    {creativeIndex > 0 ? (
	                                      <Button
	                                        size="sm"
	                                        variant="subtle"
	                                        color="red"
	                                        leftSection={<IconTrash size={16} />}
	                                        onClick={() => removeCreativeAngle(adSet.id, creative.id)}
	                                      >
	                                        {t('creative.remove')}
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
              </Box>
            </Stack>
          </Grid.Col>

          <Grid.Col
            span={{ base: 12, lg: 4 }}
            className={activeStage === 1 ? classes.stageHidden : classes.stageVisible}
          >
            <Box style={{ position: 'sticky', top: 18 }}>
              <Stack gap="lg">
                <Card withBorder radius="lg" p="lg" className={classes.sectionCard}>
                  <Stack gap="md">
                    <Group gap="sm">
                      <ThemeIcon color="green" variant="light" radius="xl">
                        <IconCalendar size={18} />
                      </ThemeIcon>
                      <Title order={3}>{t('budget.title')}</Title>
                    </Group>
                    <SegmentedControl
                      fullWidth
                      value={state.budgetType}
                      onChange={(value) => {
                        const budgetType = value as 'daily' | 'lifetime';
                        const days = dailyEquivalent?.days ?? 30;
                        patchState({
                          budgetType,
                          budgetAmount: Math.max(
                            budgetType === 'daily' ? 1 : 50,
                            Math.round(
                              (budgetType === 'daily'
                                ? state.budgetAmount / Math.max(days, 1)
                                : state.budgetAmount * days) * 100
                            ) / 100
                          ),
                        });
                      }}
                      data={[
                        { value: 'daily', label: t('budget.daily') },
                        { value: 'lifetime', label: t('budget.lifetime') },
                      ]}
                    />
                    <NumberInput
                      label={t(state.budgetType === 'daily' ? 'budget.dailyLabel' : 'budget.lifetimeLabel', {
                        currency: currencyCode?.trim().toUpperCase() || 'USD',
                      })}
                      hideControls
                      min={state.budgetType === 'daily' ? 1 : 50}
                      value={state.budgetAmount}
                      onChange={(value) => patchState({ budgetAmount: Number(value) || 0 })}
                      required
                    />
                    <DateTimePicker
                      label={t('budget.start')}
                      value={state.startDate}
                      onChange={(value) => patchState({ startDate: pickerValueToDate(value, new Date()) ?? new Date() })}
                      minDate={new Date()}
                    />
                    <DateTimePicker
                      label={t('budget.end')}
                      value={state.endDate}
                      onChange={(value) => patchState({ endDate: pickerValueToDate(value, state.endDate) })}
                      minDate={state.startDate}
                      clearable={false}
                      required
                    />
                    <Paper withBorder radius="md" p="md" bg="var(--dv-success-soft)">
                      <Text fw={800}>
                        {dailyEquivalent
                          ? t('budget.perDay', { amount: formatMoney(dailyEquivalent.amount, currencyCode) })
                          : t('budget.setEnd')}
                      </Text>
                      <Text size="sm" c="dimmed">
                        {dailyEquivalent
                          ? state.budgetType === 'daily'
                            ? t('budget.runDaily', { days: dailyEquivalent.days, total: formatMoney(dailyEquivalent.totalAmount, currencyCode) })
                            : t('budget.runLifetime', { days: dailyEquivalent.days })
                          : t('budget.recommend')}
                      </Text>
                    </Paper>
                    {activeStage === 2 ? (
                    <Paper withBorder radius="md" p="md">
                      <Stack gap="sm">
                        <Group gap="sm" align="flex-start">
                          <ThemeIcon color="blue" variant="light" radius="xl">
                            <IconChartLine size={18} />
                          </ThemeIcon>
                          <div>
                            <Text fw={800}>{t('estimate.title')}</Text>
                          </div>
                        </Group>
                        <p className={classes.estimateNumber}>
                          {t('estimate.range', {
                            low: formatOutcomeCount(leadEstimate.low),
                            high: formatOutcomeCount(leadEstimate.high),
                            label: t(`estimate.label.${leadEstimate.method}`),
                          })}
                        </p>
                        <Text size="sm" c="dimmed">
                          {t('estimate.around', {
                            estimate: formatOutcomeCount(leadEstimate.estimate),
                            label: t(`estimate.label.${leadEstimate.method}`),
                            budget: formatMoney(plannedBudgetAmount, currencyCode),
                          })}
                        </Text>
                        <details className={classes.estimateDetails}>
                          <summary>{t('estimate.details')}</summary>
                          <Stack gap="sm" mt="sm">
                            <LeadEstimateChart points={leadEstimate.points} currencyCode={currencyCode} />
                            <SimpleGrid cols={2} spacing="xs">
                              <Paper withBorder radius="sm" p="xs" bg="var(--dv-surface-muted)">
                                <Text size="xs" c="dimmed">{t('estimate.cost')}</Text>
                                <Text size="sm" fw={800}>{formatMoney(leadEstimate.costPerOutcome, currencyCode)}</Text>
                              </Paper>
                              <Paper withBorder radius="sm" p="xs" bg="var(--dv-surface-muted)">
                                <Text size="xs" c="dimmed">{t('estimate.source')}</Text>
                                <Text size="sm" fw={800} lineClamp={1}>
                                  {leadEstimate.sourceName ?? t(`estimate.sources.${leadEstimate.sourceKind}`)}
                                </Text>
                              </Paper>
                            </SimpleGrid>
                            {leadEstimate.usesFallback ? (
                              <Text size="xs" c="dimmed">
                                {t('estimate.fallback')}
                              </Text>
                            ) : null}
                          </Stack>
                        </details>
                      </Stack>
                    </Paper>
                    ) : null}
                  </Stack>
                </Card>
              </Stack>
            </Box>
          </Grid.Col>
        </Grid>

        <Group justify="space-between" align="center" gap="sm" className={classes.stageFooter}>
          {/* Nothing to go back to on the first step, so no disabled button there. */}
          {activeStage > 0 ? (
            <Button
              variant="default"
              leftSection={<IconChevronLeft size={16} />}
              disabled={saving}
              onClick={() => setActiveStage((activeStage - 1) as BuilderStage)}
            >
              {t('footer.back')}
            </Button>
          ) : null}
          {activeStage < 2 ? (
            <Button
              ml="auto"
              rightSection={<IconChevronRight size={16} />}
              onClick={() => {
                setActiveStage((activeStage + 1) as BuilderStage);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              {t('footer.continue')}
            </Button>
          ) : (
            <Button
              ml="auto"
              leftSection={<IconSparkles size={18} />}
              loading={saving}
              disabled={unsupportedReuseObjective || unsupportedReuseDestination}
              onClick={handleSaveDraft}
            >
              {t('footer.save')}
            </Button>
          )}
        </Group>
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
        objective={state.objective}
        destinationType={destinationForLeadMethod(state.leadMethod, state.methodSettings)}
        platformId={platformData.id}
        adAccountId={adAccountId}
        currencyCode={currencyCode}
        initialSelectedId={activeMediaCreative?.existingCreativeIds[0] ?? null}
      />
    </Container>
  );
}
