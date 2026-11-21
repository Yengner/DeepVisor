'use client';

import '@mantine/dates/styles.css';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useLabels } from '@/lib/client/hooks/useLabels';
import {
  Accordion,
  Alert,
  Badge,
  Button,
  Checkbox,
  Divider,
  Group,
  Modal,
  NumberInput,
  Paper,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { useMediaQuery } from '@mantine/hooks';
import {
  IconAlertTriangle,
  IconCalendar,
  IconCopyPlus,
  IconInfoCircle,
  IconSettings,
  IconShieldCheck,
  IconTimezone,
} from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { formatCurrencyAmount } from '@/lib/shared';
import StatusBadge from './StatusBadge';
import {
  createReuseDraft,
  ReuseDraftError,
  type CreateReuseDraftInput,
  type ReuseDraftBudgetType,
  type ReuseDraftCreativeMode,
  type ReuseDraftSourceType,
} from './reuseDraftClient';
import classes from './RunAgainSheet.module.css';

const DAY_MS = 24 * 60 * 60 * 1000;
const SUPPORTED_RUN_AGAIN_OBJECTIVES = new Set([
  'OUTCOME_LEADS',
  'OUTCOME_ENGAGEMENT',
  'LEAD_GENERATION',
  'MESSAGES',
]);

type DurationPreset = '7' | '14' | '30' | 'custom';

type DateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

export interface RunAgainSource {
  sourceType: ReuseDraftSourceType;
  campaignId: string;
  adSetId?: string;
  adId?: string;
  name: string;
  campaignName?: string;
  adSetName?: string;
  status?: string;
  objective?: string;
  spend: number;
  results: number;
  ctr: number | null;
  activityStart?: string;
  activityEnd?: string;
  creativeAvailable?: boolean;
}

interface RunAgainSheetProps {
  opened: boolean;
  source: RunAgainSource | null;
  currencyCode: string | null;
  accountTimezone?: string | null;
  onClose: () => void;
}

function validTimezone(value: string | null | undefined): value is string {
  if (!value) return false;

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

function partsForDateInTimezone(date: Date, timeZone: string): DateTimeParts {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const values = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value])
  );

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

function formatDateTimeParts(parts: DateTimeParts): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)} ${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}`;
}

function parseDateTimeParts(value: string | null): DateTimeParts | null {
  if (!value) return null;

  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/
  );
  if (!match) return null;

  const parts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4] ?? 0),
    minute: Number(match[5] ?? 0),
    second: Number(match[6] ?? 0),
  };
  const check = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
  );

  if (
    check.getUTCFullYear() !== parts.year ||
    check.getUTCMonth() + 1 !== parts.month ||
    check.getUTCDate() !== parts.day
  ) {
    return null;
  }

  return parts;
}

function addDaysToWallTime(value: string, days: number): string {
  const parts = parseDateTimeParts(value);
  if (!parts) return value;

  const date = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day + days, parts.hour, parts.minute, parts.second)
  );
  return formatDateTimeParts({
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: date.getUTCHours(),
    minute: date.getUTCMinutes(),
    second: date.getUTCSeconds(),
  });
}

function wallTimeToIso(value: string | null, timeZone: string): string | null {
  const parts = parseDateTimeParts(value);
  if (!parts) return null;

  const wallTimestamp = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );
  let timestamp = wallTimestamp;

  // Two passes account for offsets that change around daylight-saving transitions.
  for (let pass = 0; pass < 2; pass += 1) {
    const zoneParts = partsForDateInTimezone(new Date(timestamp), timeZone);
    const zoneTimestamp = Date.UTC(
      zoneParts.year,
      zoneParts.month - 1,
      zoneParts.day,
      zoneParts.hour,
      zoneParts.minute,
      zoneParts.second
    );
    timestamp = wallTimestamp - (zoneTimestamp - timestamp);
  }

  const roundTrip = partsForDateInTimezone(new Date(timestamp), timeZone);
  if (
    roundTrip.year !== parts.year ||
    roundTrip.month !== parts.month ||
    roundTrip.day !== parts.day ||
    roundTrip.hour !== parts.hour ||
    roundTrip.minute !== parts.minute
  ) {
    return null;
  }

  return new Date(timestamp).toISOString();
}

function wallTimeDurationDays(startValue: string | null, endValue: string | null): number {
  const start = parseDateTimeParts(startValue);
  const end = parseDateTimeParts(endValue);
  if (!start || !end) return 1;

  const startMs = Date.UTC(start.year, start.month - 1, start.day, start.hour, start.minute, start.second);
  const endMs = Date.UTC(end.year, end.month - 1, end.day, end.hour, end.minute, end.second);
  return Math.max(1, Math.ceil((endMs - startMs) / DAY_MS));
}

function formatWallTime(value: string | null, notSet: string, intl: string): string {
  const parts = parseDateTimeParts(value);
  if (!parts) return notSet;

  return new Intl.DateTimeFormat(intl, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(
    new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second))
  );
}

function sourceActiveDays(source: RunAgainSource): number {
  const start = source.activityStart ? new Date(source.activityStart).getTime() : Number.NaN;
  const end = source.activityEnd ? new Date(source.activityEnd).getTime() : Number.NaN;

  if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
    return Math.max(1, Math.ceil((end - start) / DAY_MS) + 1);
  }

  return 30;
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function createIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className={classes.reviewRow}>
      <Text size="sm" c="dimmed">{label}</Text>
      <Text size="sm" fw={700} ta="right">{value}</Text>
    </div>
  );
}

export default function RunAgainSheet({
  opened,
  source,
  currencyCode,
  accountTimezone,
  onClose,
}: RunAgainSheetProps) {
  const t = useTranslations('runAgainSheet');
  const tTable = useTranslations('table');
  const labels = useLabels();
  const intl = useLocale() === 'es' ? 'es-US' : 'en-US';
  const sourceLabel = (sourceType: ReuseDraftSourceType) => t(`source.${sourceType === 'adset' ? 'adset' : sourceType === 'ad' ? 'ad' : 'campaign'}`);
  const wallTime = (value: string | null) => formatWallTime(value, t('notSet'), intl);
  const router = useRouter();
  const isMobile = useMediaQuery('(max-width: 48em)');
  const deviceTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const timezone = validTimezone(accountTimezone) ? accountTimezone : deviceTimezone;
  const timezoneIsFallback = !validTimezone(accountTimezone);
  const normalizedCurrency = currencyCode?.trim().toUpperCase() || 'USD';

  const [budgetType, setBudgetType] = useState<ReuseDraftBudgetType>('daily');
  const [budgetAmount, setBudgetAmount] = useState<number>(20);
  const [startAt, setStartAt] = useState<string | null>(null);
  const [endAt, setEndAt] = useState<string | null>(null);
  const [durationPreset, setDurationPreset] = useState<DurationPreset>('14');
  const [creativeMode, setCreativeMode] = useState<ReuseDraftCreativeMode>('fresh');
  const [increaseConfirmed, setIncreaseConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const scrollRegionRef = useRef<HTMLDivElement | null>(null);
  const submitLockRef = useRef(false);
  const idempotencyRef = useRef<{ signature: string; key: string } | null>(null);

  const historicalDays = useMemo(() => (source ? sourceActiveDays(source) : 30), [source]);
  const historicalDailySpend = useMemo(
    () => (source && source.spend > 0 ? source.spend / historicalDays : 0),
    [historicalDays, source]
  );

  useEffect(() => {
    if (!opened || !source) return;

    const nowParts = partsForDateInTimezone(new Date(), timezone);
    const tomorrowMorning = addDaysToWallTime(
      formatDateTimeParts({ ...nowParts, hour: 9, minute: 0, second: 0 }),
      1
    );
    const defaultDailyBudget = Math.max(
      1,
      roundCurrency(historicalDailySpend > 0 ? historicalDailySpend : 20)
    );

    setBudgetType('daily');
    setBudgetAmount(defaultDailyBudget);
    setStartAt(tomorrowMorning);
    setEndAt(addDaysToWallTime(tomorrowMorning, 14));
    setDurationPreset('14');
    setCreativeMode(
      source.sourceType === 'ad' && source.creativeAvailable !== false ? 'reuse' : 'fresh'
    );
    setIncreaseConfirmed(false);
    setError(null);
    setFieldErrors({});
    submitLockRef.current = false;
    idempotencyRef.current = null;
  }, [historicalDailySpend, opened, source, timezone]);

  const runDays = wallTimeDurationDays(startAt, endAt);
  const proposedDailySpend = budgetType === 'daily'
    ? budgetAmount
    : budgetAmount / Math.max(runDays, 1);
  const budgetIncreasePercent = historicalDailySpend > 0
    ? ((proposedDailySpend / historicalDailySpend) - 1) * 100
    : 0;
  const requiresIncreaseConfirmation = budgetIncreasePercent > 25;
  const costPerResult = source && source.results > 0 ? source.spend / source.results : 0;
  const sourcePath = source?.sourceType === 'ad'
    ? `${source.campaignName || t('source.campaign')} / ${source.adSetName || t('source.adset')}`
    : source?.sourceType === 'adset'
      ? source.campaignName || t('source.campaign')
      : t('campaignLevel');
  const creativeCanBeReused = source?.sourceType === 'ad' && source.creativeAvailable !== false;
  const normalizedObjective = source?.objective?.trim().toUpperCase() || '';
  const sourceObjectiveSupported = SUPPORTED_RUN_AGAIN_OBJECTIVES.has(normalizedObjective);

  const clearFieldError = (field: string) => {
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
    setError(null);
  };

  const handleBudgetTypeChange = (value: string) => {
    const nextType = value as ReuseDraftBudgetType;
    if (nextType === budgetType) return;

    setBudgetAmount((current) => Math.max(
      nextType === 'lifetime' ? 50 : 1,
      roundCurrency(nextType === 'lifetime' ? current * runDays : current / Math.max(runDays, 1))
    ));
    setBudgetType(nextType);
    setIncreaseConfirmed(false);
    clearFieldError('budgetAmount');
  };

  const handleDurationPreset = (value: string) => {
    const preset = value as DurationPreset;
    setDurationPreset(preset);
    setIncreaseConfirmed(false);
    clearFieldError('endAt');

    if (preset !== 'custom' && startAt) {
      setEndAt(addDaysToWallTime(startAt, Number(preset)));
    }
  };

  const validate = (startIso: string | null, endIso: string | null) => {
    const nextErrors: Record<string, string> = {};
    const minimumBudget = budgetType === 'daily' ? 1 : 50;

    if (!Number.isFinite(budgetAmount) || budgetAmount < minimumBudget) {
      nextErrors.budgetAmount = t('atLeast', { amount: formatCurrencyAmount(minimumBudget, currencyCode) });
    }
    if (!startIso) {
      nextErrors.startAt = t('startInvalid');
    } else if (new Date(startIso).getTime() <= Date.now()) {
      nextErrors.startAt = t('startPast');
    }
    if (!endIso) {
      nextErrors.endAt = t('endInvalid');
    } else if (startIso && new Date(endIso).getTime() <= new Date(startIso).getTime()) {
      nextErrors.endAt = t('endBeforeStart');
    }
    if (requiresIncreaseConfirmation && !increaseConfirmed) {
      nextErrors.budgetConfirmation = t('confirmIncreaseError');
    }
    if (!sourceObjectiveSupported) {
      nextErrors.sourceCampaignId = normalizedObjective
        ? t('objectiveWorkflow', { objective: normalizedObjective })
        : t('objectiveUnknown');
    }

    return nextErrors;
  };

  const handleSubmit = async () => {
    if (!source || submitLockRef.current) return;

    const startIso = wallTimeToIso(startAt, timezone);
    const endIso = wallTimeToIso(endAt, timezone);
    const nextErrors = validate(startIso, endIso);
    setFieldErrors(nextErrors);
    setError(null);

    if (Object.keys(nextErrors).length > 0 || !startIso || !endIso) {
      requestAnimationFrame(() => scrollRegionRef.current?.scrollTo({ top: 0, behavior: 'smooth' }));
      return;
    }

    const requestWithoutKey: Omit<CreateReuseDraftInput, 'idempotencyKey'> = {
      sourceType: source.sourceType,
      sourceCampaignId: source.campaignId,
      ...(source.adSetId ? { sourceAdSetId: source.adSetId } : {}),
      ...(source.adId ? { sourceAdId: source.adId } : {}),
      budgetType,
      budgetAmount: roundCurrency(budgetAmount),
      startAt: startIso,
      endAt: endIso,
      creativeMode,
    };
    const signature = JSON.stringify(requestWithoutKey);
    const idempotencyKey = idempotencyRef.current?.signature === signature
      ? idempotencyRef.current.key
      : createIdempotencyKey();
    idempotencyRef.current = { signature, key: idempotencyKey };

    submitLockRef.current = true;
    setSubmitting(true);
    try {
      const result = await createReuseDraft({ ...requestWithoutKey, idempotencyKey });
      router.push(result.href);
    } catch (submitError) {
      if (submitError instanceof ReuseDraftError) {
        setError(submitError.message);
        setFieldErrors(submitError.fieldErrors);
      } else {
        setError(t('createFailed'));
      }
      requestAnimationFrame(() => scrollRegionRef.current?.scrollTo({ top: 0, behavior: 'smooth' }));
    } finally {
      submitLockRef.current = false;
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) onClose();
  };

  if (!source) return null;

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      fullScreen={Boolean(isMobile)}
      size={760}
      radius={isMobile ? 0 : 'md'}
      centered
      closeOnClickOutside={!submitting}
      closeOnEscape={!submitting}
      title={
        <Group gap="sm" wrap="nowrap">
          <ThemeIcon variant="light" color="green" radius="md" size={36}>
            <IconCopyPlus size={19} />
          </ThemeIcon>
          <div>
            <Text size="sm" c="dimmed" fw={700}>{t('eyebrow')}</Text>
            <Text fw={800} lineClamp={1}>{source.name}</Text>
          </div>
        </Group>
      }
      classNames={{
        content: classes.modalContent,
        header: classes.modalHeader,
        body: classes.modalBody,
      }}
    >
      <form
        className={classes.form}
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit();
        }}
      >
        <div ref={scrollRegionRef} className={classes.scrollRegion}>
          <Stack gap="lg">
            <Alert color="green" variant="light" icon={<IconShieldCheck size={18} />}>
              {t.rich('safe', { name: source.name, b: chunks => <strong>{chunks}</strong> })}
            </Alert>

            {!sourceObjectiveSupported ? (
              <Alert
                color="red"
                icon={<IconAlertTriangle size={18} />}
                title={t('unsupportedTitle')}
              >
                {normalizedObjective
                  ? t('unsupported', { objective: normalizedObjective })
                  : t('objectiveUnknown')}
              </Alert>
            ) : null}

            {error ? (
              <Alert color="red" icon={<IconAlertTriangle size={18} />} title={t('notCreated')}>
                <Stack gap={4}>
                  <Text size="sm">{error}</Text>
                  {Object.values(fieldErrors).map((message) => (
                    <Text key={message} size="sm">{message}</Text>
                  ))}
                </Stack>
              </Alert>
            ) : null}

            {!error && Object.keys(fieldErrors).length > 0 ? (
              <Alert color="red" icon={<IconAlertTriangle size={18} />} title={t('checkSettings')}>
                <Stack gap={4}>
                  {Array.from(new Set(Object.values(fieldErrors))).map((message) => (
                    <Text key={message} size="sm">{message}</Text>
                  ))}
                </Stack>
              </Alert>
            ) : null}

            <Paper withBorder radius="md" p="md" className={classes.sourcePanel}>
              <Group justify="space-between" align="flex-start" gap="sm" wrap="nowrap">
                <div className={classes.sourceTitle}>
                  <Group gap={6} wrap="wrap">
                    <Badge variant="light" color="gray">{sourceLabel(source.sourceType)}</Badge>
                    {source.status ? <StatusBadge status={source.status} /> : null}
                  </Group>
                  <Title order={3} mt={8} lineClamp={2}>{source.name}</Title>
                  <Text size="sm" c="dimmed" mt={4} lineClamp={2}>{sourcePath}</Text>
                </div>
                <ThemeIcon variant="light" color="gray" radius="md" size={38}>
                  <IconSettings size={19} />
                </ThemeIcon>
              </Group>

              <div className={classes.metricGrid}>
                <div>
                  <Text size="sm" c="dimmed" fw={700}>{tTable('metric.spend')}</Text>
                  <Text fw={800}>{formatCurrencyAmount(source.spend, currencyCode)}</Text>
                </div>
                <div>
                  <Text size="sm" c="dimmed" fw={700}>{tTable('metric.results')}</Text>
                  <Text fw={800}>{source.results.toLocaleString(intl)}</Text>
                </div>
                <div>
                  <Text size="sm" c="dimmed" fw={700}>{tTable('metric.costPerResult')}</Text>
                  <Text fw={800}>{formatCurrencyAmount(costPerResult, currencyCode)}</Text>
                </div>
                <div>
                  <Text size="sm" c="dimmed" fw={700}>{tTable('metric.ctr')}</Text>
                  <Text fw={800}>{source.ctr != null ? `${source.ctr.toFixed(2)}%` : t('notAvailable')}</Text>
                </div>
              </div>
            </Paper>

            <div className={classes.accountContext}>
              <Group gap={8} wrap="nowrap">
                <IconTimezone size={17} aria-hidden="true" />
                <Text size="sm" fw={700}>{normalizedCurrency} | {timezone}</Text>
              </Group>
              <Text size="sm" c="dimmed">
                {timezoneIsFallback
                  ? t('zoneFallback')
                  : t('zoneAccount')}
              </Text>
            </div>

            <section className={classes.section}>
              <div className={classes.sectionHeading}>
                <Text fw={800}>{t('budget')}</Text>
                <Text size="sm" c="dimmed">
                  {t('previousPace', { amount: formatCurrencyAmount(historicalDailySpend, currencyCode) })}
                </Text>
              </div>

              <SegmentedControl
                fullWidth
                value={budgetType}
                onChange={handleBudgetTypeChange}
                data={[
                  { value: 'daily', label: t('daily') },
                  { value: 'lifetime', label: t('lifetime') },
                ]}
              />
              <NumberInput
                label={t('amount', { currency: normalizedCurrency })}
                description={budgetType === 'daily'
                  ? t('amountDaily')
                  : t('amountLifetime', { days: runDays })}
                value={budgetAmount}
                onChange={(value) => {
                  setBudgetAmount(Number(value) || 0);
                  setIncreaseConfirmed(false);
                  clearFieldError('budgetAmount');
                }}
                min={budgetType === 'daily' ? 1 : 50}
                decimalScale={2}
                fixedDecimalScale={false}
                error={fieldErrors.budgetAmount}
                required
              />

              {requiresIncreaseConfirmation ? (
                <Alert color="yellow" variant="light" icon={<IconAlertTriangle size={18} />}>
                  <Stack gap="sm">
                    <Text size="sm">
                      {t('increase', { pct: Math.round(budgetIncreasePercent) })}
                    </Text>
                    <Checkbox
                      checked={increaseConfirmed}
                      onChange={(event) => {
                        setIncreaseConfirmed(event.currentTarget.checked);
                        clearFieldError('budgetConfirmation');
                      }}
                      label={t('confirmIncrease')}
                      error={fieldErrors.budgetConfirmation}
                    />
                  </Stack>
                </Alert>
              ) : null}
            </section>

            <section className={classes.section}>
              <div className={classes.sectionHeading}>
                <Text fw={800}>{t('schedule')}</Text>
                <Text size="sm" c="dimmed">{t('scheduleHint')}</Text>
              </div>

              <SegmentedControl
                fullWidth
                value={durationPreset}
                onChange={handleDurationPreset}
                data={[
                  { value: '7', label: t('days', { count: 7 }) },
                  { value: '14', label: t('days', { count: 14 }) },
                  { value: '30', label: t('days', { count: 30 }) },
                  { value: 'custom', label: t('custom') },
                ]}
              />

              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                <DateTimePicker
                  label={t('start')}
                  value={startAt}
                  onChange={(value) => {
                    setStartAt(value);
                    setIncreaseConfirmed(false);
                    clearFieldError('startAt');
                    if (value && durationPreset !== 'custom') {
                      setEndAt(addDaysToWallTime(value, Number(durationPreset)));
                    }
                  }}
                  minDate={formatDateTimeParts(partsForDateInTimezone(new Date(), timezone)).slice(0, 10)}
                  leftSection={<IconCalendar size={16} />}
                  valueFormat="MMM D, YYYY h:mm A"
                  error={fieldErrors.startAt}
                  required
                />
                <DateTimePicker
                  label={t('end')}
                  value={endAt}
                  onChange={(value) => {
                    setEndAt(value);
                    setDurationPreset('custom');
                    setIncreaseConfirmed(false);
                    clearFieldError('endAt');
                  }}
                  minDate={startAt || undefined}
                  leftSection={<IconCalendar size={16} />}
                  valueFormat="MMM D, YYYY h:mm A"
                  error={fieldErrors.endAt}
                  required
                />
              </SimpleGrid>
            </section>

            <section className={classes.section}>
              <div className={classes.sectionHeading}>
                <Text fw={800}>{t('creative')}</Text>
                <Text size="sm" c="dimmed">
                  {creativeCanBeReused
                    ? t('creativeReusable')
                    : t('creativeNeedsAd')}
                </Text>
              </div>

              {creativeCanBeReused ? (
                <SegmentedControl
                  fullWidth
                  value={creativeMode}
                  onChange={(value) => {
                    setCreativeMode(value as ReuseDraftCreativeMode);
                    clearFieldError('creativeMode');
                  }}
                  data={[
                    { value: 'reuse', label: t('reuse') },
                    { value: 'fresh', label: t('fresh') },
                  ]}
                />
              ) : (
                <Paper withBorder radius="md" p="sm">
                  <Group gap="sm" wrap="nowrap" align="flex-start">
                    <ThemeIcon color="gray" variant="light" radius="md" size={34}>
                      <IconInfoCircle size={17} />
                    </ThemeIcon>
                    <div>
                      <Text size="sm" fw={800}>{t('fresh')}</Text>
                      <Text size="sm" c="dimmed">
                        {t('freshBody')}
                      </Text>
                    </div>
                  </Group>
                </Paper>
              )}
            </section>

            <Accordion variant="contained" radius="md" className={classes.settingsAccordion}>
              <Accordion.Item value="previous-settings">
                <Accordion.Control icon={<IconSettings size={17} />}>
                  <div>
                    <Text size="sm" fw={800}>{t('verifyTitle')}</Text>
                    <Text size="sm" c="dimmed">{t('verifyBody')}</Text>
                  </div>
                </Accordion.Control>
                <Accordion.Panel>
                  <Stack gap={0}>
                    <ReviewRow label={t('row.source')} value={`${sourceLabel(source.sourceType)}: ${source.name}`} />
                    <ReviewRow label={t('row.parent')} value={sourcePath} />
                    <ReviewRow label={t('row.objective')} value={source.objective ? labels.objective(source.objective) : t('useSource')} />
                    <ReviewRow
                      label={t('row.creative')}
                      value={creativeMode === 'reuse' ? t('creativeReuse') : t('creativeFresh')}
                    />
                    <ReviewRow label={t('row.original')} value={t('unchanged')} />
                  </Stack>
                </Accordion.Panel>
              </Accordion.Item>
            </Accordion>

            <section className={classes.reviewSection}>
              <Group justify="space-between" gap="sm">
                <Text fw={800}>{t('review')}</Text>
                <Badge color="yellow" variant="light">{t('paused')}</Badge>
              </Group>
              <Divider my="sm" />
              <Stack gap={0}>
                <ReviewRow
                  label={t('row.budget')}
                  value={t(budgetType === 'daily' ? 'perDay' : 'total', { amount: formatCurrencyAmount(budgetAmount, currencyCode) })}
                />
                <ReviewRow label={t('row.start')} value={wallTime(startAt)} />
                <ReviewRow label={t('row.end')} value={t('endWithDays', { date: wallTime(endAt), days: runDays })} />
                <ReviewRow label={t('row.timezone')} value={timezone} />
                <ReviewRow label={t('row.status')} value={t('pausedDraft')} />
              </Stack>
            </section>
          </Stack>
        </div>

        <div className={classes.footer}>
          <div className={classes.footerCopy}>
            <Text size="sm" fw={800}>{t('footerTitle')}</Text>
            <Text size="sm" c="dimmed">{t('footerBody')}</Text>
          </div>
          <Group gap="sm" wrap="nowrap" className={classes.footerActions}>
            <Button variant="default" onClick={handleClose} disabled={submitting}>
              {t('cancel')}
            </Button>
            <Button
              type="submit"
              leftSection={<IconCopyPlus size={17} />}
              loading={submitting}
              disabled={
                !sourceObjectiveSupported ||
                (requiresIncreaseConfirmation && !increaseConfirmed)
              }
            >
              {t('create')}
            </Button>
          </Group>
        </div>
      </form>
    </Modal>
  );
}
