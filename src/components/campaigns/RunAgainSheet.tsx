'use client';

import '@mantine/dates/styles.css';

import { useEffect, useMemo, useRef, useState } from 'react';
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

function formatWallTime(value: string | null): string {
  const parts = parseDateTimeParts(value);
  if (!parts) return 'Not set';

  return new Intl.DateTimeFormat('en-US', {
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

function sourceLabel(sourceType: ReuseDraftSourceType): string {
  if (sourceType === 'adset') return 'Ad set';
  if (sourceType === 'ad') return 'Ad';
  return 'Campaign';
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
    ? `${source.campaignName || 'Campaign'} / ${source.adSetName || 'Ad set'}`
    : source?.sourceType === 'adset'
      ? source.campaignName || 'Campaign'
      : 'Campaign-level settings';
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
      nextErrors.budgetAmount = `Enter at least ${formatCurrencyAmount(minimumBudget, currencyCode)}.`;
    }
    if (!startIso) {
      nextErrors.startAt = 'Choose a valid start date and time.';
    } else if (new Date(startIso).getTime() <= Date.now()) {
      nextErrors.startAt = 'Choose a start time in the future.';
    }
    if (!endIso) {
      nextErrors.endAt = 'Choose a valid end date and time.';
    } else if (startIso && new Date(endIso).getTime() <= new Date(startIso).getTime()) {
      nextErrors.endAt = 'End time must be after the start time.';
    }
    if (requiresIncreaseConfirmation && !increaseConfirmed) {
      nextErrors.budgetConfirmation = 'Confirm the budget increase before creating the draft.';
    }
    if (!sourceObjectiveSupported) {
      nextErrors.sourceCampaignId = normalizedObjective
        ? `Objective ${normalizedObjective} needs a different campaign workflow.`
        : 'The source campaign objective is unavailable.';
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
        setError('The draft could not be created. Your original campaign was not changed.');
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
            <Text size="xs" c="dimmed" fw={800} tt="uppercase">Run again</Text>
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
              This creates a paused DeepVisor draft for review. It does not change{' '}
              <strong>{source.name}</strong> or publish anything on Meta.
            </Alert>

            {!sourceObjectiveSupported ? (
              <Alert
                color="red"
                icon={<IconAlertTriangle size={18} />}
                title="This source is not available for Run again"
              >
                {normalizedObjective
                  ? `Objective ${normalizedObjective} is not supported by the current review builder.`
                  : 'The source campaign objective is unavailable.'}
              </Alert>
            ) : null}

            {error ? (
              <Alert color="red" icon={<IconAlertTriangle size={18} />} title="Draft not created">
                <Stack gap={4}>
                  <Text size="sm">{error}</Text>
                  {Object.values(fieldErrors).map((message) => (
                    <Text key={message} size="sm">{message}</Text>
                  ))}
                </Stack>
              </Alert>
            ) : null}

            {!error && Object.keys(fieldErrors).length > 0 ? (
              <Alert color="red" icon={<IconAlertTriangle size={18} />} title="Check these settings">
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
                  <Text size="10px" c="dimmed" tt="uppercase" fw={800}>Spend</Text>
                  <Text fw={800}>{formatCurrencyAmount(source.spend, currencyCode)}</Text>
                </div>
                <div>
                  <Text size="10px" c="dimmed" tt="uppercase" fw={800}>Results</Text>
                  <Text fw={800}>{source.results.toLocaleString()}</Text>
                </div>
                <div>
                  <Text size="10px" c="dimmed" tt="uppercase" fw={800}>Cost / result</Text>
                  <Text fw={800}>{formatCurrencyAmount(costPerResult, currencyCode)}</Text>
                </div>
                <div>
                  <Text size="10px" c="dimmed" tt="uppercase" fw={800}>CTR</Text>
                  <Text fw={800}>{source.ctr != null ? `${source.ctr.toFixed(2)}%` : 'Not available'}</Text>
                </div>
              </div>
            </Paper>

            <div className={classes.accountContext}>
              <Group gap={8} wrap="nowrap">
                <IconTimezone size={17} aria-hidden="true" />
                <Text size="sm" fw={700}>{normalizedCurrency} | {timezone}</Text>
              </Group>
              <Text size="xs" c="dimmed">
                {timezoneIsFallback
                  ? 'Account timezone was unavailable, so schedule fields use your device timezone.'
                  : 'Schedule fields use the ad account timezone.'}
              </Text>
            </div>

            <section className={classes.section}>
              <div className={classes.sectionHeading}>
                <Text fw={800}>Budget</Text>
                <Text size="sm" c="dimmed">
                  Previous delivery averaged {formatCurrencyAmount(historicalDailySpend, currencyCode)} per active day.
                </Text>
              </div>

              <SegmentedControl
                fullWidth
                value={budgetType}
                onChange={handleBudgetTypeChange}
                data={[
                  { value: 'daily', label: 'Daily budget' },
                  { value: 'lifetime', label: 'Lifetime budget' },
                ]}
              />
              <NumberInput
                label={`Budget amount (${normalizedCurrency})`}
                description={budgetType === 'daily'
                  ? 'Amount available each day.'
                  : `Total amount across this ${runDays}-day run.`}
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
                      This is about {Math.round(budgetIncreasePercent)}% above the source&apos;s historical daily spend pace.
                    </Text>
                    <Checkbox
                      checked={increaseConfirmed}
                      onChange={(event) => {
                        setIncreaseConfirmed(event.currentTarget.checked);
                        clearFieldError('budgetConfirmation');
                      }}
                      label="I confirm this budget increase"
                      error={fieldErrors.budgetConfirmation}
                    />
                  </Stack>
                </Alert>
              ) : null}
            </section>

            <section className={classes.section}>
              <div className={classes.sectionHeading}>
                <Text fw={800}>Schedule</Text>
                <Text size="sm" c="dimmed">Choose a compact run window, then adjust either timestamp if needed.</Text>
              </div>

              <SegmentedControl
                fullWidth
                value={durationPreset}
                onChange={handleDurationPreset}
                data={[
                  { value: '7', label: '7 days' },
                  { value: '14', label: '14 days' },
                  { value: '30', label: '30 days' },
                  { value: 'custom', label: 'Custom' },
                ]}
              />

              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                <DateTimePicker
                  label="Start date and time"
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
                  label="End date and time"
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
                <Text fw={800}>Creative</Text>
                <Text size="sm" c="dimmed">
                  {creativeCanBeReused
                    ? 'Reuse the exact source ad, or prepare the draft for a fresh creative.'
                    : 'An exact source ad is required before creative can be reused safely.'}
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
                    { value: 'reuse', label: 'Reuse creative' },
                    { value: 'fresh', label: 'Fresh creative' },
                  ]}
                />
              ) : (
                <Paper withBorder radius="md" p="sm">
                  <Group gap="sm" wrap="nowrap" align="flex-start">
                    <ThemeIcon color="gray" variant="light" radius="md" size={34}>
                      <IconInfoCircle size={17} />
                    </ThemeIcon>
                    <div>
                      <Text size="sm" fw={800}>Fresh creative</Text>
                      <Text size="xs" c="dimmed">
                        You can add or choose creative when reviewing the paused draft.
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
                    <Text size="sm" fw={800}>Settings to verify</Text>
                    <Text size="xs" c="dimmed">The review step confirms what is available from the source.</Text>
                  </div>
                </Accordion.Control>
                <Accordion.Panel>
                  <Stack gap={0}>
                    <ReviewRow label="Source" value={`${sourceLabel(source.sourceType)}: ${source.name}`} />
                    <ReviewRow label="Parent" value={sourcePath} />
                    <ReviewRow label="Objective" value={source.objective || 'Use source setting'} />
                    <ReviewRow
                      label="Creative"
                      value={creativeMode === 'reuse' ? 'Exact source ad creative' : 'Choose fresh creative in review'}
                    />
                    <ReviewRow label="Original" value="Remains unchanged" />
                  </Stack>
                </Accordion.Panel>
              </Accordion.Item>
            </Accordion>

            <section className={classes.reviewSection}>
              <Group justify="space-between" gap="sm">
                <Text fw={800}>Draft review</Text>
                <Badge color="yellow" variant="light">Paused</Badge>
              </Group>
              <Divider my="sm" />
              <Stack gap={0}>
                <ReviewRow
                  label="Budget"
                  value={`${formatCurrencyAmount(budgetAmount, currencyCode)} ${budgetType === 'daily' ? 'per day' : 'total'}`}
                />
                <ReviewRow label="Start" value={formatWallTime(startAt)} />
                <ReviewRow label="End" value={`${formatWallTime(endAt)} (${runDays} days)`} />
                <ReviewRow label="Timezone" value={timezone} />
                <ReviewRow label="Creation status" value="Paused draft" />
              </Stack>
            </section>
          </Stack>
        </div>

        <div className={classes.footer}>
          <div className={classes.footerCopy}>
            <Text size="sm" fw={800}>No live delivery changes</Text>
            <Text size="xs" c="dimmed">This flow only creates a paused DeepVisor draft.</Text>
          </div>
          <Group gap="sm" wrap="nowrap" className={classes.footerActions}>
            <Button variant="default" onClick={handleClose} disabled={submitting}>
              Cancel
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
              Create draft
            </Button>
          </Group>
        </div>
      </form>
    </Modal>
  );
}
