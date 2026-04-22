'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Container,
  Group,
  Modal,
  MultiSelect,
  NumberInput,
  Paper,
  Popover,
  Select,
  SegmentedControl,
  Stack,
  Switch,
  Text,
  TextInput,
  Textarea,
  Tooltip,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconArrowUpRight,
  IconCalendarMonth,
  IconCalendarWeek,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconEdit,
  IconInfoCircle,
  IconPlus,
  IconRefresh,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import type { BusinessIntelligenceWorkspace } from '@/lib/server/intelligence';
import {
  buildCalendarQueuePreviewItems,
  buildRecurringCalendarQueuePreviewItems,
  type CalendarQueuePreviewItem as QueueItem,
  type CalendarQueueSource as QueueSource,
  type CalendarQueueStatus as QueueStatus,
  type CalendarQueueTemplate,
  type CalendarQueueTemplateRecurrence,
  type CalendarQueueTemplateType,
} from '@/lib/shared';
import classes from './CalendarClient.module.css';

type CalendarRenderItem = QueueItem & {
  renderId: string;
  originalItem: QueueItem;
};

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MINI_WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const WEEK_VIEW_START_HOUR = 0;
const WEEK_VIEW_END_HOUR = 24;
const WEEK_HOUR_HEIGHT = 56;
const MONTH_VIEW_VISIBLE_ITEM_COUNT = 4;
const DRAG_SNAP_MINUTES = 15;
const INITIAL_WEEK_SCROLL_HOUR = 13;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function toIsoDay(date: Date): string {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next.toISOString().slice(0, 10);
}

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(base: Date, days: number): Date {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(base: Date, months: number): Date {
  const next = startOfDay(base);
  next.setDate(1);
  next.setMonth(next.getMonth() + months);
  return next;
}

function startOfWeek(date: Date): Date {
  return addDays(startOfDay(date), -startOfDay(date).getDay());
}

function startOfMonth(date: Date): Date {
  const next = startOfDay(date);
  next.setDate(1);
  return next;
}

function isSameDay(left: Date, right: Date): boolean {
  return toIsoDay(left) === toIsoDay(right);
}

function isSameMonth(left: Date, right: Date): boolean {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth();
}

function formatMonthYearLabel(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

function formatWeekRangeLabel(days: Date[]): string {
  const start = days[0];
  const end = days[days.length - 1];

  if (start.getMonth() === end.getMonth()) {
    return `${start.toLocaleDateString('en-US', { month: 'short' })} ${start.getDate()} - ${end.getDate()}, ${end.getFullYear()}`;
  }

  if (start.getFullYear() === end.getFullYear()) {
    return `${start.toLocaleDateString('en-US', { month: 'short' })} ${start.getDate()} - ${end.toLocaleDateString('en-US', { month: 'short' })} ${end.getDate()}, ${end.getFullYear()}`;
  }

  return `${start.toLocaleDateString('en-US', { month: 'short' })} ${start.getDate()}, ${start.getFullYear()} - ${end.toLocaleDateString('en-US', { month: 'short' })} ${end.getDate()}, ${end.getFullYear()}`;
}

function formatSidebarDayLabel(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatHourLabel(hour: number): string {
  const hourInDay = hour % 24;
  const suffix = hourInDay >= 12 ? 'PM' : 'AM';
  const normalized = hourInDay % 12 === 0 ? 12 : hourInDay % 12;
  return `${normalized} ${suffix}`;
}

function weekTimeLabelStyle(hour: number): CSSProperties {
  const offset = (hour - WEEK_VIEW_START_HOUR) * WEEK_HOUR_HEIGHT;

  if (hour === WEEK_VIEW_START_HOUR) {
    return {
      top: 0,
      transform: 'translateY(0)',
    };
  }

  if (hour === WEEK_VIEW_END_HOUR) {
    return {
      top: offset,
      transform: 'translateY(-100%)',
    };
  }

  return {
    top: offset,
    transform: 'translateY(-50%)',
  };
}

function parseTimeToMinutes(value: string): number {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);

  if (!match) {
    return 12 * 60;
  }

  const hours = Number(match[1]) % 12;
  const minutes = Number(match[2]);
  const suffix = match[3].toUpperCase();
  return (suffix === 'PM' ? hours + 12 : hours) * 60 + minutes;
}

function formatMinutesAsTime(totalMinutes: number): string {
  const normalized = Math.max(0, Math.min(totalMinutes, WEEK_VIEW_END_HOUR * 60 - DRAG_SNAP_MINUTES));
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const normalizedHours = hours % 12 === 0 ? 12 : hours % 12;

  return `${normalizedHours}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

function formatTemplateTimeOfDay(value: string): string {
  const match = value.trim().match(/^(\d{2}):(\d{2})/);
  if (!match) {
    return value;
  }

  return formatMinutesAsTime(Number(match[1]) * 60 + Number(match[2]));
}

function compareQueueItems(left: QueueItem, right: QueueItem): number {
  if (left.day !== right.day) {
    return left.day.localeCompare(right.day);
  }

  return parseTimeToMinutes(left.time) - parseTimeToMinutes(right.time);
}

function buildCalendarRenderItems(items: QueueItem[]): CalendarRenderItem[] {
  return items
    .flatMap((item) => {
      const startMinutes = parseTimeToMinutes(item.time);
      const start = new Date(`${item.day}T00:00:00`);
      start.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0);

      const end = new Date(start);
      end.setMinutes(end.getMinutes() + item.durationMinutes);

      const segments: CalendarRenderItem[] = [];
      let segmentStart = new Date(start);

      while (segmentStart < end) {
        const dayStart = startOfDay(segmentStart);
        const nextDayStart = addDays(dayStart, 1);
        const segmentEnd = end < nextDayStart ? end : nextDayStart;
        const segmentMinutes = Math.max(
          1,
          Math.round((segmentEnd.getTime() - segmentStart.getTime()) / 60000)
        );
        const segmentStartMinutes =
          segmentStart.getHours() * 60 + segmentStart.getMinutes();

        segments.push({
          ...item,
          day: toIsoDay(segmentStart),
          time: formatMinutesAsTime(segmentStartMinutes),
          durationMinutes: segmentMinutes,
          renderId: `${item.id}:${toIsoDay(segmentStart)}:${segmentStartMinutes}`,
          originalItem: item,
        });

        segmentStart = new Date(segmentEnd);
      }

      return segments;
    })
    .sort(compareQueueItems);
}

function looksLikeUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

function flattenQueueItems(items: QueueItem[]): QueueItem[] {
  return items.flatMap((item) => [item, ...(item.children ?? [])]);
}

function updateQueueItemTree(
  items: QueueItem[],
  id: string,
  updater: (item: QueueItem) => QueueItem | null
): QueueItem[] {
  return items.flatMap((item) => {
    if (item.id === id) {
      const next = updater(item);
      return next ? [next] : [];
    }

    if (!item.children || item.children.length === 0) {
      return [item];
    }

    return [
      {
        ...item,
        children: updateQueueItemTree(item.children, id, updater),
      },
    ];
  });
}

function queueStatusColor(status: QueueStatus): string {
  switch (status) {
    case 'approved':
      return 'green';
    case 'ready':
      return 'blue';
    default:
      return 'gray';
  }
}

function queueStatusLabel(status: QueueStatus): string {
  switch (status) {
    case 'ready':
      return 'Needs approval';
    case 'draft':
      return 'Needs review';
    default:
      return 'Approved';
  }
}

function queueSourceLabel(source: QueueSource): string {
  switch (source) {
    case 'manual':
      return 'User made';
    case 'agent':
      return 'AI agent made';
    default:
      return 'Automatic';
  }
}

function queueSourceClassName(source: QueueSource): string {
  switch (source) {
    case 'manual':
      return classes.sourceManual;
    case 'agent':
      return classes.sourceAgent;
    default:
      return classes.sourceAutomatic;
  }
}

function queueItemMarkerClassName(item: QueueItem): string {
  if (item.isRecurring && item.recurringTemplateType) {
    return queueTemplateEventClassName(item.recurringTemplateType);
  }

  return queueSourceClassName(item.source);
}

function queueItemEventClassName(item: QueueItem, isSelected: boolean): string {
  const toneClass =
    item.isRecurring && item.recurringTemplateType
      ? queueTemplateEventClassName(item.recurringTemplateType)
      : item.source === 'manual'
        ? classes.eventManual
        : item.source === 'agent'
          ? classes.eventAgent
          : classes.eventAutomatic;

  return [toneClass, isSelected ? classes.selectedEvent : ''].filter(Boolean).join(' ');
}

function shouldShowQueueEndTime(item: QueueItem): boolean {
  return !(item.isRecurring && item.recurringTemplateType === 'report');
}

function weekEventStyle(item: QueueItem): CSSProperties {
  const gridStartMinutes = WEEK_VIEW_START_HOUR * 60;
  const gridEndMinutes = WEEK_VIEW_END_HOUR * 60;
  const rawStart = parseTimeToMinutes(item.time);
  const rawEnd = rawStart + item.durationMinutes;
  const start = Math.max(rawStart, gridStartMinutes);
  const end = Math.min(Math.max(rawEnd, start + 30), gridEndMinutes);
  const top = ((start - gridStartMinutes) / 60) * WEEK_HOUR_HEIGHT;
  const height = Math.max(((end - start) / 60) * WEEK_HOUR_HEIGHT, 48);

  return {
    top,
    height,
  };
}

type WeekEventDensity = 'tight' | 'compact' | 'full';

function resolveWeekEventDensity(item: QueueItem): WeekEventDensity {
  const height = Number(weekEventStyle(item).height ?? 0);

  if (height <= 52) {
    return 'tight';
  }

  if (height <= 66) {
    return 'compact';
  }

  return 'full';
}

function weekEventDensityClassName(density: WeekEventDensity): string {
  switch (density) {
    case 'tight':
      return classes.weekEventTight;
    case 'compact':
      return classes.weekEventCompact;
    default:
      return classes.weekEventFull;
  }
}

type QueueTemplateFormState = {
  templateType: CalendarQueueTemplateType;
  title: string;
  description: string;
  recurrenceType: CalendarQueueTemplateRecurrence;
  weekdays: string[];
  monthlyDay: number;
  timeOfDay: string;
  durationMinutes: number;
  startDate: string;
  endDate: string;
  isIndefinite: boolean;
};

const WEEKDAY_OPTIONS = [
  { value: '0', label: 'Sunday' },
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' },
];

const QUEUE_TEMPLATE_TYPE_OPTIONS: Array<{
  value: CalendarQueueTemplateType;
  label: string;
  description: string;
  titleLabel: string;
  descriptionLabel: string;
  cadenceLabel: string;
  timeLabel: string;
  helperCopy: string;
  defaultDurationMinutes: number;
  showDuration: boolean;
}> = [
  {
    value: 'report',
    label: 'Report queue',
    description: 'Schedule a weekly or monthly report run and review window.',
    titleLabel: 'Report title',
    descriptionLabel: 'What this report should cover',
    cadenceLabel: 'Report cadence',
    timeLabel: 'Report start time',
    helperCopy:
      'DeepVisor will start generating this report at the selected time. No duration is needed for report queues.',
    defaultDurationMinutes: 30,
    showDuration: false,
  },
  {
    value: 'campaign_review',
    label: 'Campaign review',
    description: 'Repeat campaign checks, approvals, or comparisons.',
    titleLabel: 'Queue title',
    descriptionLabel: 'Review focus',
    cadenceLabel: 'Review cadence',
    timeLabel: 'Start time',
    helperCopy:
      'Use this for repeating campaign checks, approvals, comparisons, or pacing reviews.',
    defaultDurationMinutes: 45,
    showDuration: true,
  },
  {
    value: 'creative_refresh',
    label: 'Creative refresh',
    description: 'Keep creative swaps and refreshes on a schedule.',
    titleLabel: 'Queue title',
    descriptionLabel: 'Refresh brief',
    cadenceLabel: 'Refresh cadence',
    timeLabel: 'Start time',
    helperCopy:
      'Schedule recurring creative swaps, fatigue checks, and fresh asset preparation.',
    defaultDurationMinutes: 45,
    showDuration: true,
  },
  {
    value: 'budget_review',
    label: 'Budget review',
    description: 'Recurring budget pacing and reallocation review.',
    titleLabel: 'Queue title',
    descriptionLabel: 'Budget review brief',
    cadenceLabel: 'Budget cadence',
    timeLabel: 'Start time',
    helperCopy:
      'Use this for pacing checks, reallocation decisions, and budget guardrail reviews.',
    defaultDurationMinutes: 40,
    showDuration: true,
  },
  {
    value: 'custom',
    label: 'Custom queue',
    description: 'Anything business-specific that should repeat.',
    titleLabel: 'Queue title',
    descriptionLabel: 'Queue brief',
    cadenceLabel: 'Queue cadence',
    timeLabel: 'Start time',
    helperCopy:
      'Create a recurring queue for anything your business needs to review, approve, or follow up on.',
    defaultDurationMinutes: 45,
    showDuration: true,
  },
];

const MAIN_QUEUE_TEMPLATE_TYPE_OPTIONS = QUEUE_TEMPLATE_TYPE_OPTIONS.filter(
  (option) => option.value !== 'custom'
);

function getQueueTemplateOption(templateType: CalendarQueueTemplateType) {
  return (
    QUEUE_TEMPLATE_TYPE_OPTIONS.find((option) => option.value === templateType) ??
    QUEUE_TEMPLATE_TYPE_OPTIONS[0]
  );
}

function queueTemplateBadgeColor(templateType: CalendarQueueTemplateType): string {
  switch (templateType) {
    case 'report':
      return 'indigo';
    case 'campaign_review':
      return 'teal';
    case 'creative_refresh':
      return 'orange';
    case 'budget_review':
      return 'red';
    default:
      return 'violet';
  }
}

function queueTemplateCardClassName(templateType: CalendarQueueTemplateType): string {
  switch (templateType) {
    case 'report':
      return classes.templateCardReport;
    case 'campaign_review':
      return classes.templateCardCampaignReview;
    case 'creative_refresh':
      return classes.templateCardCreativeRefresh;
    case 'budget_review':
      return classes.templateCardBudgetReview;
    default:
      return classes.templateCardCustom;
  }
}

function queueTemplateEventClassName(templateType: CalendarQueueTemplateType): string {
  switch (templateType) {
    case 'report':
      return classes.eventTemplateReport;
    case 'campaign_review':
      return classes.eventTemplateCampaignReview;
    case 'creative_refresh':
      return classes.eventTemplateCreativeRefresh;
    case 'budget_review':
      return classes.eventTemplateBudgetReview;
    default:
      return classes.eventTemplateCustom;
  }
}

function formatEventDateTime(item: QueueItem): string {
  const date = new Date(`${item.day}T00:00:00`);
  const startMinutes = parseTimeToMinutes(item.time);
  const start = new Date(date);
  start.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0);

  const end = new Date(start);
  end.setMinutes(end.getMinutes() + item.durationMinutes);

  const dayLabel = start.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  const startLabel = start.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  if (!shouldShowQueueEndTime(item)) {
    return `${dayLabel} · ${startLabel}`;
  }

  return `${dayLabel} · ${startLabel} - ${end.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })}`;
}

function formatEventTimeRange(item: QueueItem): string {
  const date = new Date(`${item.day}T00:00:00`);
  const startMinutes = parseTimeToMinutes(item.time);
  const start = new Date(date);
  start.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0);

  const end = new Date(start);
  end.setMinutes(end.getMinutes() + item.durationMinutes);

  if (!shouldShowQueueEndTime(item)) {
    return start.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  return `${start.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })} - ${end.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })}`;
}

function defaultTemplateDestination(
  templateType: CalendarQueueTemplateType
): string | null {
  switch (templateType) {
    case 'report':
      return '/reports?compare=previous_period';
    case 'campaign_review':
      return '/dashboard';
    case 'creative_refresh':
      return '/campaigns/intelligence/create';
    case 'budget_review':
      return '/dashboard';
    default:
      return '/calendar';
  }
}

function defaultTemplateCopy(templateType: CalendarQueueTemplateType): Pick<
  QueueTemplateFormState,
  'title' | 'description'
> {
  switch (templateType) {
    case 'report':
      return {
        title: 'Weekly ads report review',
        description: 'Review the latest performance report and queue any follow-up changes.',
      };
    case 'campaign_review':
      return {
        title: 'Campaign review queue',
        description: 'Check campaign efficiency, compare winners, and decide what should change next.',
      };
    case 'creative_refresh':
      return {
        title: 'Creative refresh queue',
        description: 'Review fatigue signals and rotate in fresh creative on schedule.',
      };
    case 'budget_review':
      return {
        title: 'Budget review queue',
        description: 'Review pacing and reallocate budget across the strongest campaigns.',
      };
    default:
      return {
        title: 'Custom queue',
        description: 'Custom recurring operating queue for this business.',
      };
  }
}

function buildDefaultTemplateForm(today: Date): QueueTemplateFormState {
  const defaults = defaultTemplateCopy('report');
  const queueOption = getQueueTemplateOption('report');

  return {
    templateType: 'report',
    title: defaults.title,
    description: defaults.description,
    recurrenceType: 'weekly',
    weekdays: [String(today.getDay())],
    monthlyDay: today.getDate(),
    timeOfDay: '09:00',
    durationMinutes: queueOption.defaultDurationMinutes,
    startDate: toIsoDay(today),
    endDate: '',
    isIndefinite: true,
  };
}

function formStateFromTemplate(template: CalendarQueueTemplate): QueueTemplateFormState {
  return {
    templateType: template.templateType,
    title: template.title,
    description: template.description,
    recurrenceType: template.recurrenceType,
    weekdays: template.weekdays.map(String),
    monthlyDay: template.monthlyDay ?? 1,
    timeOfDay: template.timeOfDay.slice(0, 5),
    durationMinutes: template.durationMinutes,
    startDate: template.startDate,
    endDate: template.endDate ?? '',
    isIndefinite: !template.endDate,
  };
}

function resolveTemplateDurationMinutes(form: QueueTemplateFormState): number {
  return getQueueTemplateOption(form.templateType).showDuration ? form.durationMinutes : 30;
}

function MiniCalendar({
  monthStart,
  monthDays,
  calendarCursor,
  today,
  itemsByDay,
  onSelectDay,
  onShiftMonth,
  onToday,
}: {
  monthStart: Date;
  monthDays: Date[];
  calendarCursor: Date;
  today: Date;
  itemsByDay: Map<string, QueueItem[]>;
  onSelectDay: (day: Date) => void;
  onShiftMonth: (direction: -1 | 1) => void;
  onToday: () => void;
}) {
  return (
    <Paper withBorder radius="xl" p="md" className={classes.miniCalendarPanel}>
      <Group justify="space-between" align="center" mb="xs">
        <div>
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            Date picker
          </Text>
          <Text fw={800} size="sm">
            {formatMonthYearLabel(monthStart)}
          </Text>
        </div>

        <Group gap={2} wrap="nowrap">
          <ActionIcon
            variant="subtle"
            color="gray"
            radius="xl"
            size="sm"
            aria-label="Previous month"
            onClick={() => onShiftMonth(-1)}
          >
            <IconChevronLeft size={14} />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            color="gray"
            radius="xl"
            size="sm"
            aria-label="Next month"
            onClick={() => onShiftMonth(1)}
          >
            <IconChevronRight size={14} />
          </ActionIcon>
        </Group>
      </Group>

      <div className={classes.miniCalendarGrid}>
        {MINI_WEEKDAY_LABELS.map((label, index) => (
          <span key={`${label}-${index}`} className={classes.miniWeekday}>
            {label}
          </span>
        ))}

        {monthDays.map((day) => {
          const dayKey = toIsoDay(day);
          const itemCount = itemsByDay.get(dayKey)?.length ?? 0;
          const isOutside = !isSameMonth(day, monthStart);
          const isToday = isSameDay(day, today);
          const isSelected = isSameDay(day, calendarCursor);

          return (
            <button
              key={dayKey}
              type="button"
              className={[
                classes.miniDay,
                isOutside ? classes.miniDayOutside : '',
                isToday ? classes.miniDayToday : '',
                isSelected ? classes.miniDaySelected : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => onSelectDay(day)}
              aria-label={`Open ${formatSidebarDayLabel(dayKey)}`}
            >
              <span>{day.getDate()}</span>
              {itemCount > 0 ? <span className={classes.miniDayDot} /> : null}
            </button>
          );
        })}
      </div>

      <Button variant="subtle" color="gray" radius="xl" size="xs" fullWidth mt="sm" onClick={onToday}>
        Jump to today
      </Button>
    </Paper>
  );
}

export default function CalendarClient({
  workspace,
  initialQueueItems,
  initialQueueTemplates,
}: {
  workspace: BusinessIntelligenceWorkspace;
  initialQueueItems: QueueItem[];
  initialQueueTemplates: CalendarQueueTemplate[];
}) {
  const router = useRouter();
  const weekScrollerRef = useRef<HTMLDivElement | null>(null);
  const [queueItems, setQueueItems] = useState<QueueItem[]>(() =>
    initialQueueItems.length > 0
      ? initialQueueItems
      : buildCalendarQueuePreviewItems(workspace.selectedAdAccountName)
  );
  const [queueTemplates, setQueueTemplates] = useState<CalendarQueueTemplate[]>(
    initialQueueTemplates
  );
  const [planView, setPlanView] = useState<'weekly' | 'monthly'>('weekly');
  const [calendarCursor, setCalendarCursor] = useState<Date>(() => startOfDay(new Date()));
  const [selectedCalendarItemId, setSelectedCalendarItemId] = useState<string | null>(null);
  const [approvingItemId, setApprovingItemId] = useState<string | null>(null);
  const [weekScrollbarWidth, setWeekScrollbarWidth] = useState(0);
  const [templateTypePickerOpened, setTemplateTypePickerOpened] = useState(false);
  const [templateEditorOpened, setTemplateEditorOpened] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [rebuildingQueue, setRebuildingQueue] = useState(false);
  const [showAllQueueTemplates, setShowAllQueueTemplates] = useState(false);
  const [currentTimestamp, setCurrentTimestamp] = useState(() => new Date());
  const [templateForm, setTemplateForm] = useState<QueueTemplateFormState>(() =>
    buildDefaultTemplateForm(startOfDay(new Date()))
  );
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);

  const selectionRequiredPlatforms = workspace.platforms.filter((platform) => platform.selectionRequired);
  const selectedAdAccount = useMemo(
    () =>
      workspace.selectedAdAccountId
        ? workspace.adAccounts.find((account) => account.id === workspace.selectedAdAccountId) ?? null
        : null,
    [workspace.adAccounts, workspace.selectedAdAccountId]
  );
  const selectedPlatformIntegrationId =
    selectedAdAccount?.platformIntegrationId ?? workspace.selectedPlatformIntegrationId ?? null;
  const selectedAccountSummary =
    workspace.selectedAdAccountName ||
    `${workspace.selection.adAccountIds.length} connected account${workspace.selection.adAccountIds.length === 1 ? '' : 's'}`;

  const today = useMemo(() => startOfDay(new Date()), []);
  const weekStart = useMemo(() => startOfWeek(calendarCursor), [calendarCursor]);
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart]
  );
  const weekDayKeys = useMemo(() => weekDays.map((day) => toIsoDay(day)), [weekDays]);
  const monthStart = useMemo(() => startOfMonth(calendarCursor), [calendarCursor]);
  const monthGridStart = useMemo(() => startOfWeek(monthStart), [monthStart]);
  const monthDays = useMemo(
    () => Array.from({ length: 42 }, (_, index) => addDays(monthGridStart, index)),
    [monthGridStart]
  );
  const monthDayKeys = useMemo(() => monthDays.map((day) => toIsoDay(day)), [monthDays]);
  const recurringRange = useMemo(() => {
    const candidates = [...weekDays, ...monthDays].sort((left, right) => left.getTime() - right.getTime());
    return {
      start: candidates[0] ?? today,
      end: candidates[candidates.length - 1] ?? today,
    };
  }, [monthDays, weekDays, today]);
  const recurringQueueItems = useMemo(
    () =>
      buildRecurringCalendarQueuePreviewItems(queueTemplates, {
        rangeStart: recurringRange.start,
        rangeEnd: recurringRange.end,
      }),
    [queueTemplates, recurringRange]
  );
  const visibleCalendarDayKeys = useMemo(
    () => (planView === 'weekly' ? weekDayKeys : monthDayKeys),
    [monthDayKeys, planView, weekDayKeys]
  );
  const visibleCalendarDayKeySet = useMemo(
    () => new Set(visibleCalendarDayKeys),
    [visibleCalendarDayKeys]
  );
  const flatQueueItems = useMemo(
    () =>
      [...flattenQueueItems(queueItems), ...recurringQueueItems].sort(compareQueueItems),
    [queueItems, recurringQueueItems]
  );
  const renderedQueueItems = useMemo(
    () => buildCalendarRenderItems(flatQueueItems),
    [flatQueueItems]
  );

  const queueCounts = useMemo(
    () => ({
      total: flatQueueItems.length,
      ready: flatQueueItems.filter((item) => item.status === 'ready').length,
      approved: flatQueueItems.filter((item) => item.status === 'approved').length,
      draft: flatQueueItems.filter((item) => item.status === 'draft').length,
    }),
    [flatQueueItems]
  );

  const weekItemsByDay = useMemo(() => {
    const grouped = new Map<string, CalendarRenderItem[]>(weekDayKeys.map((day) => [day, []]));

    renderedQueueItems.forEach((item) => {
      const bucket = grouped.get(item.day);

      if (bucket) {
        bucket.push(item);
      }
    });

    grouped.forEach((items) => items.sort(compareQueueItems));
    return grouped;
  }, [renderedQueueItems, weekDayKeys]);

  const monthItemsByDay = useMemo(() => {
    const grouped = new Map<string, CalendarRenderItem[]>(monthDayKeys.map((day) => [day, []]));

    renderedQueueItems.forEach((item) => {
      const bucket = grouped.get(item.day);

      if (bucket) {
        bucket.push(item);
      }
    });

    grouped.forEach((items) => items.sort(compareQueueItems));
    return grouped;
  }, [renderedQueueItems, monthDayKeys]);

  const selectedTemplateOption = useMemo(
    () => getQueueTemplateOption(templateForm.templateType),
    [templateForm.templateType]
  );

  const addQueueTargets = useMemo(() => {
    if (planView === 'weekly') {
      return weekDayKeys;
    }

    return monthDays
      .filter((day) => isSameMonth(day, monthStart))
      .map((day) => toIsoDay(day));
  }, [monthDays, monthStart, planView, weekDayKeys]);

  const calendarRangeLabel = useMemo(
    () =>
      planView === 'weekly'
        ? formatWeekRangeLabel(weekDays)
        : formatMonthYearLabel(monthStart),
    [monthStart, planView, weekDays]
  );

  const visibleCalendarItemCount = useMemo(
    () =>
      new Set(
        renderedQueueItems
          .filter((item) => visibleCalendarDayKeySet.has(item.day))
          .map((item) => item.id)
      ).size,
    [renderedQueueItems, visibleCalendarDayKeySet]
  );

  const visibleWeekItems = useMemo(
    () =>
      weekDayKeys.flatMap((dayKey) => (weekItemsByDay.get(dayKey) ?? []).map((item) => ({ dayKey, item }))),
    [weekDayKeys, weekItemsByDay]
  );
  const visibleQueueTemplates = useMemo(
    () => (showAllQueueTemplates ? queueTemplates : queueTemplates.slice(0, 2)),
    [queueTemplates, showAllQueueTemplates]
  );
  const currentTimeIndicator = useMemo(() => {
    const now = currentTimestamp;
    const minutes =
      now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
    const startMinutes = WEEK_VIEW_START_HOUR * 60;
    const endMinutes = WEEK_VIEW_END_HOUR * 60;

    if (minutes < startMinutes || minutes > endMinutes) {
      return null;
    }

    const dayKey = toIsoDay(now);
    if (!weekDayKeys.includes(dayKey)) {
      return null;
    }

    return {
      dayKey,
      top: ((minutes - startMinutes) / 60) * WEEK_HOUR_HEIGHT,
    };
  }, [currentTimestamp, weekDayKeys]);

  function openTemplateEditor(template?: CalendarQueueTemplate) {
    if (template) {
      setEditingTemplateId(template.id);
      setTemplateForm(formStateFromTemplate(template));
    } else {
      setEditingTemplateId(null);
      setTemplateForm(buildDefaultTemplateForm(calendarCursor));
    }

    setTemplateEditorOpened(true);
  }

  function startTemplateCreation(templateType: CalendarQueueTemplateType) {
    const defaults = defaultTemplateCopy(templateType);
    const queueOption = getQueueTemplateOption(templateType);
    setTemplateForm({
      ...buildDefaultTemplateForm(calendarCursor),
      templateType,
      title: defaults.title,
      description: defaults.description,
      durationMinutes: queueOption.defaultDurationMinutes,
    });
    setEditingTemplateId(null);
    setTemplateTypePickerOpened(false);
    setTemplateEditorOpened(true);
  }

  async function saveTemplate() {
    if (!workspace.selectedAdAccountId) {
      toast.error('Select an ad account before creating a queue.');
      return;
    }

    setSavingTemplate(true);

    try {
      const body = {
        platformIntegrationId: workspace.selection.platformIntegrationId ?? null,
        adAccountId: workspace.selectedAdAccountId,
        templateType: templateForm.templateType,
        title: templateForm.title.trim(),
        description: templateForm.description.trim(),
        destinationHref: defaultTemplateDestination(templateForm.templateType),
        recurrenceType: templateForm.recurrenceType,
        weekdays:
          templateForm.recurrenceType === 'weekly'
            ? templateForm.weekdays.map(Number).sort((left, right) => left - right)
            : [],
        monthlyDay:
          templateForm.recurrenceType === 'monthly' ? templateForm.monthlyDay : null,
        timeOfDay: `${templateForm.timeOfDay}:00`,
        durationMinutes: resolveTemplateDurationMinutes(templateForm),
        startDate: templateForm.startDate,
        endDate: templateForm.isIndefinite ? null : templateForm.endDate || null,
        status: 'active' as const,
      };

      const response = await fetch(
        editingTemplateId
          ? `/api/calendar/templates/${editingTemplateId}`
          : '/api/calendar/templates',
        {
          method: editingTemplateId ? 'PATCH' : 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        }
      );

      const payload = (await response.json()) as {
        error?: string;
        template?: CalendarQueueTemplate;
      };

      if (!response.ok || !payload.template) {
        throw new Error(payload.error ?? 'Unable to save queue.');
      }

      const savedTemplate = payload.template;
      setQueueTemplates((current) =>
        editingTemplateId
          ? current.map((template) =>
              template.id === savedTemplate.id ? savedTemplate : template
            )
          : [savedTemplate, ...current]
      );
      setTemplateEditorOpened(false);
      setEditingTemplateId(null);
      setSelectedCalendarItemId(null);
      toast.success(editingTemplateId ? 'Queue updated' : 'Queue created');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save queue.');
    } finally {
      setSavingTemplate(false);
    }
  }

  async function removeTemplate(templateId: string) {
    try {
      const response = await fetch(`/api/calendar/templates/${templateId}`, {
        method: 'DELETE',
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? 'Unable to delete queue.');
      }

      setQueueTemplates((current) => current.filter((template) => template.id !== templateId));
      setSelectedCalendarItemId(null);
      toast.success('Queue removed');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to delete queue.');
    }
  }

  async function handleRebuildQueue() {
    if (!workspace.selectedAdAccountId || !selectedPlatformIntegrationId) {
      toast.error('Select an ad account before rebuilding the queue.');
      return;
    }

    setRebuildingQueue(true);

    try {
      const response = await fetch('/api/calendar/queue/rebuild', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adAccountId: workspace.selectedAdAccountId,
          platformIntegrationId: selectedPlatformIntegrationId,
        }),
      });
      const payload = (await response.json()) as {
        error?: string;
        removedCount?: number;
        queueItems?: QueueItem[];
      };

      if (!response.ok || !Array.isArray(payload.queueItems)) {
        throw new Error(payload.error ?? 'Unable to rebuild queue.');
      }

      setQueueItems(payload.queueItems);
      setSelectedCalendarItemId(null);
      toast.success(
        typeof payload.removedCount === 'number'
          ? `Queue rebuilt. Cleared ${payload.removedCount} saved item${payload.removedCount === 1 ? '' : 's'}.`
          : 'Queue rebuilt.'
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to rebuild queue.');
    } finally {
      setRebuildingQueue(false);
    }
  }

  useEffect(() => {
    if (planView !== 'weekly') {
      return;
    }

    const scroller = weekScrollerRef.current;
    if (!scroller) {
      return;
    }

    const targetScrollTop = Math.max(
      0,
      (INITIAL_WEEK_SCROLL_HOUR - WEEK_VIEW_START_HOUR) * WEEK_HOUR_HEIGHT -
        scroller.clientHeight / 2 +
        WEEK_HOUR_HEIGHT / 2
    );

    scroller.scrollTo({
      top: targetScrollTop,
      behavior: 'auto',
    });
  }, [planView]);

  useEffect(() => {
    const scroller = weekScrollerRef.current;
    if (!scroller) {
      return;
    }

    const updateScrollbarWidth = () => {
      setWeekScrollbarWidth(Math.max(0, scroller.offsetWidth - scroller.clientWidth));
    };

    updateScrollbarWidth();

    const observer = new ResizeObserver(updateScrollbarWidth);
    observer.observe(scroller);
    window.addEventListener('resize', updateScrollbarWidth);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateScrollbarWidth);
    };
  }, [planView]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCurrentTimestamp(new Date());
    }, 60_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  function updateQueueItem(id: string, updater: (item: QueueItem) => QueueItem | null) {
    setQueueItems((current) => updateQueueItemTree(current, id, updater));
  }

  async function handleApprove(id: string) {
    const targetItem = flatQueueItems.find((item) => item.id === id) ?? null;
    if (!targetItem || approvingItemId === id) {
      return;
    }

    if (!looksLikeUuid(id)) {
      updateQueueItem(id, (item) => ({ ...item, status: 'approved' }));
      toast.success('Queue item approved');
      return;
    }

    setApprovingItemId(id);

    try {
      const response = await fetch(`/api/calendar/queue/${id}/accept`, {
        method: 'POST',
      });
      const payload = (await response.json()) as {
        error?: string;
        queueItems?: QueueItem[];
      };

      if (!response.ok || !Array.isArray(payload.queueItems)) {
        throw new Error(payload.error ?? 'Unable to approve queue item');
      }

      setQueueItems(payload.queueItems);
      toast.success(
        (targetItem.childBlueprints?.length ?? 0) > 0
          ? 'Workflow approved and nested tasks added'
          : 'Queue item approved'
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to approve queue item');
    } finally {
      setApprovingItemId(null);
    }
  }

  function handleModify(id: string) {
    const targetItem = flatQueueItems.find((item) => item.id === id) ?? null;
    if (targetItem?.recurringTemplateId) {
      const template = queueTemplates.find(
        (entry) => entry.id === targetItem.recurringTemplateId
      );
      if (template) {
        openTemplateEditor(template);
        return;
      }
    }

    updateQueueItem(id, (item) => ({
      ...item,
      status: 'draft',
      description: `${item.description} Edited in skeleton mode for later refinement.`,
    }));
    toast.success('Queue item moved back to draft');
  }

  function handleDelete(id: string) {
    const targetItem = flatQueueItems.find((item) => item.id === id) ?? null;
    if (targetItem?.recurringTemplateId) {
      void removeTemplate(targetItem.recurringTemplateId);
      return;
    }

    setSelectedCalendarItemId((current) => (current === id ? null : current));
    updateQueueItem(id, () => null);
    toast.success('Queue item removed');
  }

  function handleAddQueueItem(title?: string) {
    if (title) {
      const defaults = defaultTemplateCopy('campaign_review');
      const queueOption = getQueueTemplateOption('campaign_review');
      setTemplateForm({
        ...buildDefaultTemplateForm(calendarCursor),
        templateType: 'campaign_review',
        title,
        description: defaults.description,
        durationMinutes: queueOption.defaultDurationMinutes,
      });
      setEditingTemplateId(null);
      setTemplateEditorOpened(true);
      return;
    }

    setEditingTemplateId(null);
    setTemplateTypePickerOpened(true);
  }

  function shiftCalendar(direction: -1 | 1) {
    setCalendarCursor((current) =>
      planView === 'weekly' ? addDays(current, direction * 7) : addMonths(current, direction)
    );
  }

  function shiftMiniCalendar(direction: -1 | 1) {
    setCalendarCursor((current) => addMonths(current, direction));
  }

  function handleSelectCalendarDay(day: Date) {
    setCalendarCursor(startOfDay(day));
  }

  function handleCalendarItemClick(itemId: string) {
    setSelectedCalendarItemId((current) => (current === itemId ? null : itemId));
  }

  function renderCalendarItemPopoverContent(item: QueueItem) {
    return (
      <div className={classes.eventPopoverInner}>
        <Group justify="space-between" align="flex-start" gap="sm" wrap="nowrap">
          <Group align="flex-start" gap="sm" wrap="nowrap">
            <span
              className={[classes.eventPopoverMarker, queueItemMarkerClassName(item)]
                .filter(Boolean)
                .join(' ')}
            />
            <div className={classes.eventPopoverHeaderBlock}>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                {queueSourceLabel(item.source)}
              </Text>
              <Text className={classes.eventPopoverTitle}>{item.title}</Text>
              <Text className={classes.eventPopoverDate}>{formatEventDateTime(item)}</Text>
            </div>
          </Group>

          <ActionIcon
            variant="subtle"
            color="gray"
            radius="xl"
            size="md"
            aria-label="Close queue details"
            onClick={() => setSelectedCalendarItemId(null)}
          >
            <IconX size={18} />
          </ActionIcon>
        </Group>

        <Group gap="xs" wrap="wrap" mt="md">
          <Badge color="gray" variant="light">
            {queueSourceLabel(item.source)}
          </Badge>
          <Badge color={queueStatusColor(item.status)} variant="light">
            {queueStatusLabel(item.status)}
          </Badge>
          <Badge color="gray" variant="light">
            {item.channel}
          </Badge>
          {item.isRecurring ? (
            <>
              <Badge
                color={queueTemplateBadgeColor(item.recurringTemplateType ?? 'custom')}
                variant="light"
              >
                {getQueueTemplateOption(item.recurringTemplateType ?? 'custom').label}
              </Badge>
              <Badge color="violet" variant="light">
                Recurring
              </Badge>
            </>
          ) : null}
          <Badge color="gray" variant="light">
            {formatSidebarDayLabel(item.day)}
          </Badge>
          {item.isParent ? (
            <Badge color="violet" variant="light">
              Workflow
            </Badge>
          ) : null}
        </Group>

        <Text className={classes.eventPopoverDescription}>{item.description}</Text>

        {(item.children?.length ?? 0) > 0 ? (
          <Stack gap={6} mt="md">
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
              Nested queue items
            </Text>
            {item.children?.map((child) => (
              <Text key={child.id} size="sm" c="dimmed">
                {`\u2022 ${child.title} (${queueStatusLabel(child.status)})`}
              </Text>
            ))}
          </Stack>
        ) : (item.childBlueprints?.length ?? 0) > 0 ? (
          <Stack gap={6} mt="md">
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
              Approving this adds
            </Text>
            {item.childBlueprints?.map((child) => (
              <Text key={child.key} size="sm" c="dimmed">
                {`\u2022 ${child.title}`}
              </Text>
            ))}
          </Stack>
        ) : null}

        <div className={classes.eventPopoverMetaGrid}>
          <div className={classes.eventPopoverMetaItem}>
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
              Time
            </Text>
            <Text fw={700}>{item.time}</Text>
          </div>
          <div className={classes.eventPopoverMetaItem}>
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
              Channel
            </Text>
            <Text fw={700}>{item.channel}</Text>
          </div>
          <div className={classes.eventPopoverMetaItem}>
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
              Status
            </Text>
            <Text fw={700}>{queueStatusLabel(item.status)}</Text>
          </div>
          <div className={classes.eventPopoverMetaItem}>
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
              Created by
            </Text>
            <Text fw={700}>{queueSourceLabel(item.source)}</Text>
          </div>
        </div>

        <Group gap="sm" wrap="wrap" mt="lg">
          {item.destinationHref ? (
            <Button
              size="sm"
              radius="xl"
              variant="default"
              leftSection={<IconArrowUpRight size={15} />}
              onClick={() => router.push(item.destinationHref!)}
            >
              Open action
            </Button>
          ) : null}
          <Button
            size="sm"
            radius="xl"
            color="green"
            leftSection={<IconCheck size={15} />}
            loading={approvingItemId === item.id}
            disabled={item.status === 'approved'}
            onClick={() => handleApprove(item.id)}
          >
            {item.isParent ? 'Approve workflow' : 'Approve'}
          </Button>
          <Button
            size="sm"
            radius="xl"
            variant="light"
            color="blue"
            leftSection={<IconEdit size={15} />}
            onClick={() => handleModify(item.id)}
          >
            {item.isRecurring ? 'Edit queue' : 'Modify'}
          </Button>
          <Button
            size="sm"
            radius="xl"
            variant="light"
            color="red"
            leftSection={<IconTrash size={15} />}
            onClick={() => handleDelete(item.id)}
          >
            {item.isRecurring ? 'Remove queue' : 'Remove'}
          </Button>
        </Group>
      </div>
    );
  }

  const weekGridStyle = {
    '--calendar-hour-row-height': `${WEEK_HOUR_HEIGHT}px`,
    '--calendar-week-grid-height': `${(WEEK_VIEW_END_HOUR - WEEK_VIEW_START_HOUR) * WEEK_HOUR_HEIGHT}px`,
    '--calendar-scrollbar-width': `${weekScrollbarWidth}px`,
  } as CSSProperties;

  return (
    <Container
      fluid
      px={6}
      py={0}
      className={`${classes.pageShell} calendar-page-shell`}
    >
      <Stack gap="md" className={classes.pageStack}>
        {selectionRequiredPlatforms.length > 0 ? (
          <Alert
            color="yellow"
            radius="lg"
            icon={<IconAlertCircle size={16} />}
            title="Primary ad account still required"
          >
            <Text size="sm" mb="md">
              Finish the Meta account selection step in Integrations before this queue becomes a
              real scheduled workflow.
            </Text>
            <Button
              variant="light"
              radius="xl"
              size="xs"
              onClick={() => router.push('/integration')}
            >
              Open integrations
            </Button>
          </Alert>
        ) : null}

        <div className={classes.calendarApp}>
          <aside className={classes.sidebar}>
            <div className={classes.topUtilityBar}>
              <Button
                radius="xl"
                size="md"
                fullWidth
                leftSection={<IconPlus size={18} />}
                className="app-platform-page-action-primary"
                onClick={() => handleAddQueueItem()}
              >
                Create queue
              </Button>

              <Button
                radius="xl"
                size="sm"
                fullWidth
                variant="light"
                color="violet"
                leftSection={<IconRefresh size={16} />}
                loading={rebuildingQueue}
                disabled={!workspace.selectedAdAccountId || !selectedPlatformIntegrationId}
                onClick={() => void handleRebuildQueue()}
              >
                Rebuild automatic queue
              </Button>

              <MiniCalendar
                monthStart={monthStart}
                monthDays={monthDays}
                calendarCursor={calendarCursor}
                today={today}
                itemsByDay={monthItemsByDay}
                onSelectDay={handleSelectCalendarDay}
                onShiftMonth={shiftMiniCalendar}
                onToday={() => setCalendarCursor(today)}
              />

              <Paper withBorder radius="xl" p="md" className={classes.topPanel}>
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                  Queue health
                </Text>
                <div className={classes.topStats}>
                  <div className={classes.topStat}>
                    <span className={classes.topStatValue}>{queueCounts.total}</span>
                    <span className={classes.topStatLabel}>In queue</span>
                  </div>
                  <div className={classes.topStat}>
                    <span className={classes.topStatValue}>{queueCounts.ready}</span>
                    <span className={classes.topStatLabel}>Needs approval</span>
                  </div>
                  <div className={classes.topStat}>
                    <span className={classes.topStatValue}>{queueCounts.draft}</span>
                    <span className={classes.topStatLabel}>Drafts</span>
                  </div>
                  <div className={classes.topStat}>
                    <span className={classes.topStatValue}>{queueCounts.approved}</span>
                    <span className={classes.topStatLabel}>Approved</span>
                  </div>
                </div>
              </Paper>

              <Paper withBorder radius="xl" p="md" className={classes.topPanel}>
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                  Focus
                </Text>
                <Text fw={700} mt={6}>
                  {calendarRangeLabel}
                </Text>
                <Group gap="xs" wrap="wrap" mt="md">
                  <Badge color="gray" variant="light">
                    {visibleCalendarItemCount} scheduled
                  </Badge>
                  <Badge color="blue" variant="light">
                    {selectedAccountSummary}
                  </Badge>
                </Group>
                <Text size="sm" c="dimmed" mt="md">
                  Cursor {formatSidebarDayLabel(toIsoDay(calendarCursor))}
                </Text>
                <Text size="xs" c="dimmed" mt="xs">
                  Testing tool: rebuilds the signal-generated queue for the selected ad account and clears old saved workflow items first.
                </Text>
              </Paper>

              <Paper withBorder radius="xl" p="md" className={classes.topPanel}>
                <Group justify="space-between" align="flex-start" gap="sm" wrap="nowrap">
                  <div>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                      Saved queues
                    </Text>
                    <Text fw={700} mt={6}>
                      Repeatable workflows
                    </Text>
                  </div>
                  {queueTemplates.length > 3 ? (
                    <Button
                      variant="subtle"
                      radius="xl"
                      size="compact-sm"
                      onClick={() => setShowAllQueueTemplates((current) => !current)}
                    >
                      {showAllQueueTemplates ? 'Show less' : 'See more'}
                    </Button>
                  ) : null}
                </Group>

                <Stack gap="sm" mt="md">
                  {queueTemplates.length > 0 ? (
                    visibleQueueTemplates.map((template) => (
                      <Paper
                        key={template.id}
                        withBorder
                        radius="xl"
                        p="md"
                        className={[
                          classes.templateRow,
                          queueTemplateCardClassName(template.templateType),
                        ]
                          .filter(Boolean)
                          .join(' ')}
                      >
                        <Group justify="space-between" align="flex-start" gap="sm" wrap="nowrap">
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <Group gap="xs" wrap="wrap" mb={6}>
                              <Badge
                                color={queueTemplateBadgeColor(template.templateType)}
                                variant="light"
                                radius="sm"
                              >
                                {template.recurrenceType === 'weekly' ? 'Weekly' : 'Monthly'}
                              </Badge>
                              <Badge color="gray" variant="outline" radius="sm">
                                {QUEUE_TEMPLATE_TYPE_OPTIONS.find(
                                  (option) => option.value === template.templateType
                                )?.label ?? 'Queue'}
                              </Badge>
                            </Group>
                            <Text fw={800} fz="lg" lh={1.1} lineClamp={2}>
                              {template.title}
                            </Text>
                            <Text size="sm" mt={8} lineClamp={2} className={classes.templateRowMeta}>
                              {template.recurrenceType === 'weekly'
                                ? `Repeats on ${template.weekdays
                                    .map((weekday) => WEEKDAY_OPTIONS.find((option) => Number(option.value) === weekday)?.label?.slice(0, 3) ?? '')
                                    .filter(Boolean)
                                    .join(', ')} at ${formatTemplateTimeOfDay(template.timeOfDay)}`
                                : `Repeats on day ${template.monthlyDay ?? 1} of each month at ${formatTemplateTimeOfDay(template.timeOfDay)}`}
                            </Text>
                            <Text size="sm" mt={6} lineClamp={2} className={classes.templateRowDescription}>
                              {template.description}
                            </Text>
                          </div>

                          <Group gap={6} wrap="nowrap" className={classes.templateCardActions}>
                            <ActionIcon
                              variant="light"
                              color="dark"
                              radius="xl"
                              aria-label={`Edit ${template.title}`}
                              onClick={() => openTemplateEditor(template)}
                              className={classes.templateActionButton}
                            >
                              <IconEdit size={15} />
                            </ActionIcon>
                            <ActionIcon
                              variant="light"
                              color="dark"
                              radius="xl"
                              aria-label={`Delete ${template.title}`}
                              onClick={() => void removeTemplate(template.id)}
                              className={classes.templateActionButton}
                            >
                              <IconTrash size={15} />
                            </ActionIcon>
                          </Group>
                        </Group>
                      </Paper>
                    ))
                  ) : (
                    <Text size="sm" c="dimmed">
                      Create a weekly or monthly queue here for recurring reports, campaign reviews, budget checks, or creative refreshes.
                    </Text>
                  )}
                </Stack>
              </Paper>
            </div>
          </aside>

          <section className={classes.calendarShell}>
            <div className={classes.calendarToolbar}>
              <div className={classes.calendarToolbarPrimary}>
                <Button variant="default" radius="xl" onClick={() => setCalendarCursor(today)}>
                  Today
                </Button>
                <ActionIcon
                  variant="default"
                  radius="xl"
                  size="lg"
                  aria-label="Previous range"
                  onClick={() => shiftCalendar(-1)}
                >
                  <IconChevronLeft size={16} />
                </ActionIcon>
                <ActionIcon
                  variant="default"
                  radius="xl"
                  size="lg"
                  aria-label="Next range"
                  onClick={() => shiftCalendar(1)}
                >
                  <IconChevronRight size={16} />
                </ActionIcon>
                <Text className={classes.calendarRangeTitle} fw={800}>
                  {calendarRangeLabel}
                </Text>
              </div>

              <Group gap="sm" wrap="nowrap" justify="flex-end">
                <SegmentedControl
                  value={planView}
                  onChange={(value) => setPlanView(value as 'weekly' | 'monthly')}
                  radius="xl"
                  data={[
                    {
                      label: (
                        <Group gap={6} wrap="nowrap">
                          <IconCalendarWeek size={14} />
                          <span>Week</span>
                        </Group>
                      ),
                      value: 'weekly',
                    },
                    {
                      label: (
                        <Group gap={6} wrap="nowrap">
                          <IconCalendarMonth size={14} />
                          <span>Month</span>
                        </Group>
                      ),
                      value: 'monthly',
                    },
                  ]}
                />
              </Group>
            </div>

          {planView === 'weekly' ? (
            <div className={classes.weekShell} style={weekGridStyle}>
              <div className={classes.weekHeader}>
                <div className={classes.weekHeaderSpacer} />
                {weekDays.map((day) => {
                  const dayKey = toIsoDay(day);
                  const items = weekItemsByDay.get(dayKey) ?? [];
                  const isToday = isSameDay(day, today);
                  const isSelected = isSameDay(day, calendarCursor);

                  return (
                    <div
                      key={dayKey}
                      className={[
                        classes.weekHeaderDay,
                        isToday ? classes.weekHeaderDayToday : '',
                        isSelected ? classes.weekHeaderDaySelected : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      <Text size="10px" c="dimmed" tt="uppercase" fw={700}>
                        {WEEKDAY_LABELS[day.getDay()]}
                      </Text>
                      <div className={classes.weekHeaderDateRow}>
                        <span
                          className={[
                            classes.weekHeaderDate,
                            isToday ? classes.weekHeaderDateToday : '',
                            isSelected && !isToday ? classes.weekHeaderDateSelected : '',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                        >
                          {day.getDate()}
                        </span>
                        {items.length > 0 ? (
                          <Badge size="xs" color={isToday ? 'blue' : 'gray'} variant="light">
                            {items.length}
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className={classes.weekScroller} ref={weekScrollerRef}>
                <div className={classes.weekBody}>
                  <div className={classes.weekTimeColumn}>
                            {Array.from(
                              { length: WEEK_VIEW_END_HOUR - WEEK_VIEW_START_HOUR + 1 },
                              (_, index) => WEEK_VIEW_START_HOUR + index
                            ).map((hour) => (
                            <div
                              key={hour}
                              className={classes.weekTimeLabel}
                              style={weekTimeLabelStyle(hour)}
                            >
                                {formatHourLabel(hour)}
                            </div>
                          ))}
                        </div>

                  {weekDays.map((day) => {
                    const dayKey = toIsoDay(day);
                    const items = weekItemsByDay.get(dayKey) ?? [];
                    const isToday = isSameDay(day, today);

                    return (
                      <div
                        key={dayKey}
                        className={[
                          classes.weekDayColumn,
                          isToday ? classes.weekDayColumnToday : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                      >
                              {currentTimeIndicator && currentTimeIndicator.dayKey === dayKey ? (
                                <div
                                  className={classes.currentTimeLine}
                                  style={{ top: currentTimeIndicator.top }}
                                >
                                  <span className={classes.currentTimeDot} />
                                </div>
                              ) : null}

                              {items.map((item) => {
                                const density = resolveWeekEventDensity(item);

                          return (
                            <Popover
                              key={item.renderId}
                              opened={selectedCalendarItemId === item.id}
                              onChange={(opened) => {
                                if (!opened && selectedCalendarItemId === item.id) {
                                  setSelectedCalendarItemId(null);
                                }
                              }}
                              position="right-start"
                              offset={10}
                              radius="24px"
                              shadow="md"
                              width={360}
                              withinPortal
                            >
                              <Popover.Target>
                                <button
                                  type="button"
                                  className={[
                                    classes.weekEvent,
                                    queueItemEventClassName(
                                      item,
                                      selectedCalendarItemId === item.id
                                    ),
                                    weekEventDensityClassName(density),
                                  ]
                                    .filter(Boolean)
                                    .join(' ')}
                                  style={weekEventStyle(item)}
                                  onClick={() => handleCalendarItemClick(item.id)}
                                  title={`${item.title} · ${item.time}`}
                                >
                                  <span className={classes.eventTitle}>{item.title}</span>
                                  <span className={classes.eventTime}>
                                    {formatEventTimeRange(item)}
                                  </span>
                                  <span className={classes.eventMeta}>{item.channel}</span>
                                </button>
                              </Popover.Target>

                              <Popover.Dropdown className={classes.eventPopoverDropdown}>
                                {renderCalendarItemPopoverContent(item.originalItem)}
                              </Popover.Dropdown>
                            </Popover>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>

              {visibleWeekItems.length === 0 ? (
                <div className={classes.emptyState}>
                  <Text fw={700}>Nothing is scheduled in this week</Text>
                  <Text size="sm" c="dimmed" mt={4}>
                    Create a queue or move the calendar to another week.
                  </Text>
                </div>
              ) : null}
            </div>
          ) : (
            <div className={classes.monthShell}>
              <div className={classes.monthHeaderRow}>
                {WEEKDAY_LABELS.map((label) => (
                  <div key={label} className={classes.monthHeaderCell}>
                    {label}
                  </div>
                ))}
              </div>

              <div className={classes.monthGrid}>
                {monthDays.map((day) => {
                  const dayKey = toIsoDay(day);
                  const items = monthItemsByDay.get(dayKey) ?? [];
                  const isToday = isSameDay(day, today);
                  const isOutside = !isSameMonth(day, monthStart);
                  const isSelected = isSameDay(day, calendarCursor);

                  return (
                    <div
                      key={dayKey}
                      className={[
                        classes.monthDayCell,
                        isOutside ? classes.monthDayOutside : '',
                        isToday ? classes.monthDayToday : '',
                        isSelected ? classes.monthDaySelected : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      <div className={classes.monthDayHeader}>
                        <span
                          className={[
                            classes.monthDayNumber,
                            isToday ? classes.monthDayNumberToday : '',
                            isSelected && !isToday ? classes.monthDayNumberSelected : '',
                            isOutside ? classes.monthDayNumberOutside : '',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                        >
                          {day.getDate()}
                        </span>
                      </div>

                      <div className={classes.monthEvents}>
                        {items.slice(0, MONTH_VIEW_VISIBLE_ITEM_COUNT).map((item) => (
                          <Popover
                            key={item.renderId}
                            opened={selectedCalendarItemId === item.id}
                            onChange={(opened) => {
                              if (!opened && selectedCalendarItemId === item.id) {
                                setSelectedCalendarItemId(null);
                              }
                            }}
                            position="right-start"
                            offset={10}
                            radius="24px"
                            shadow="md"
                            width={360}
                            withinPortal
                          >
                            <Popover.Target>
                              <button
                                type="button"
                                className={[
                                  classes.monthEvent,
                                  queueItemMarkerClassName(item),
                                  selectedCalendarItemId === item.id
                                    ? classes.selectedMonthEvent
                                    : '',
                                ]
                                  .filter(Boolean)
                                  .join(' ')}
                                onClick={() => handleCalendarItemClick(item.id)}
                                title={`${item.time} · ${item.title} · ${queueSourceLabel(item.source)}`}
                              >
                                <span className={classes.monthEventText}>
                                  <span className={classes.monthEventTime}>{item.time}</span>
                                  <span className={classes.monthEventLabel}>{item.title}</span>
                                </span>
                              </button>
                            </Popover.Target>

                            <Popover.Dropdown className={classes.eventPopoverDropdown}>
                              {renderCalendarItemPopoverContent(item.originalItem)}
                            </Popover.Dropdown>
                          </Popover>
                        ))}

                        {items.length > MONTH_VIEW_VISIBLE_ITEM_COUNT ? (
                          <span className={classes.monthOverflow}>
                            {items.length - MONTH_VIEW_VISIBLE_ITEM_COUNT} more
                          </span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>

              {visibleCalendarItemCount === 0 ? (
                <div className={classes.emptyState}>
                  <Text fw={700}>No queued work is scheduled in this month</Text>
                  <Text size="sm" c="dimmed" mt={4}>
                    Create a queue or move the calendar to another month.
                  </Text>
                </div>
              ) : null}
            </div>
          )}
        </section>
        </div>
        <Modal
          opened={templateTypePickerOpened}
          onClose={() => setTemplateTypePickerOpened(false)}
          centered
          title="Choose a queue"
          radius="24px"
        >
          <div className={classes.templateTypeGrid}>
            {MAIN_QUEUE_TEMPLATE_TYPE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={[
                  classes.templateTypeButton,
                  queueTemplateCardClassName(option.value),
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => startTemplateCreation(option.value)}
              >
                <div className={classes.templateTypeButtonHeader}>
                  <span className={classes.templateTypeLabel}>{option.label}</span>
                  <Tooltip
                    multiline
                    w={260}
                    label={
                      <div>
                        <Text size="sm" fw={700}>
                          {option.label}
                        </Text>
                        <Text size="sm" mt={4}>
                          {option.helperCopy}
                        </Text>
                      </div>
                    }
                  >
                    <span className={classes.templateInfoButton} aria-label={`${option.label} details`}>
                      <IconInfoCircle size={16} />
                    </span>
                  </Tooltip>
                </div>
              </button>
            ))}
          </div>
        </Modal>

        <Modal
          opened={templateEditorOpened}
          onClose={() => {
            setTemplateEditorOpened(false);
            setEditingTemplateId(null);
          }}
          centered
          title={
            <Group gap="xs" wrap="nowrap">
              <Text fw={700}>{editingTemplateId ? `Edit ${selectedTemplateOption.label}` : selectedTemplateOption.label}</Text>
              <Tooltip
                multiline
                w={280}
                label={
                  <div>
                    <Text size="sm" fw={700}>
                      {selectedTemplateOption.label}
                    </Text>
                    <Text size="sm" mt={4}>
                      {selectedTemplateOption.helperCopy}
                    </Text>
                  </div>
                }
              >
                <ActionIcon variant="subtle" color="gray" radius="xl" size="sm" aria-label="Queue details">
                  <IconInfoCircle size={16} />
                </ActionIcon>
              </Tooltip>
            </Group>
          }
          radius="24px"
        >
          <Stack gap="md">

            <TextInput
              label={selectedTemplateOption.titleLabel}
              value={templateForm.title}
              onChange={(event) => {
                const nextValue = event.currentTarget.value;
                setTemplateForm((current) => ({
                  ...current,
                  title: nextValue,
                }));
              }}
            />

            <Textarea
              label={selectedTemplateOption.descriptionLabel}
              minRows={3}
              value={templateForm.description}
              onChange={(event) => {
                const nextValue = event.currentTarget.value;
                setTemplateForm((current) => ({
                  ...current,
                  description: nextValue,
                }));
              }}
            />

            <Group grow align="flex-start">
              <Select
                label={selectedTemplateOption.cadenceLabel}
                value={templateForm.recurrenceType}
                data={[
                  { value: 'weekly', label: 'Weekly' },
                  { value: 'monthly', label: 'Monthly' },
                ]}
                onChange={(value) => {
                  if (!value) {
                    return;
                  }

                  setTemplateForm((current) => ({
                    ...current,
                    recurrenceType: value as CalendarQueueTemplateRecurrence,
                  }));
                }}
              />

              <TextInput
                label={selectedTemplateOption.timeLabel}
                type="time"
                value={templateForm.timeOfDay}
                onChange={(event) => {
                  const nextValue = event.currentTarget.value;
                  setTemplateForm((current) => ({
                    ...current,
                    timeOfDay: nextValue,
                  }));
                }}
              />
            </Group>

            {templateForm.recurrenceType === 'weekly' ? (
              <MultiSelect
                label="Days per week"
                data={WEEKDAY_OPTIONS}
                value={templateForm.weekdays}
                onChange={(value) =>
                  setTemplateForm((current) => ({
                    ...current,
                    weekdays: value,
                  }))
                }
              />
            ) : (
              <NumberInput
                label="Day of month"
                min={1}
                max={31}
                value={templateForm.monthlyDay}
                onChange={(value) =>
                  setTemplateForm((current) => ({
                    ...current,
                    monthlyDay: Number(value) || 1,
                  }))
                }
              />
            )}

            <Group grow align="flex-start">
              <TextInput
                label="Start date"
                type="date"
                value={templateForm.startDate}
                onChange={(event) => {
                  const nextValue = event.currentTarget.value;
                  setTemplateForm((current) => ({
                    ...current,
                    startDate: nextValue,
                  }));
                }}
              />

              {selectedTemplateOption.showDuration ? (
                <NumberInput
                  label="Duration (minutes)"
                  min={15}
                  max={480}
                  step={15}
                  value={templateForm.durationMinutes}
                  onChange={(value) =>
                    setTemplateForm((current) => ({
                      ...current,
                      durationMinutes:
                        Number(value) || getQueueTemplateOption(current.templateType).defaultDurationMinutes,
                    }))
                  }
                />
              ) : null}
            </Group>

            <Switch
              label="Repeat indefinitely"
              checked={templateForm.isIndefinite}
              onChange={(event) => {
                const nextChecked = event.currentTarget.checked;
                setTemplateForm((current) => ({
                  ...current,
                  isIndefinite: nextChecked,
                  endDate: nextChecked ? '' : current.endDate,
                }));
              }}
            />

            {!templateForm.isIndefinite ? (
              <TextInput
                label="End date"
                type="date"
                value={templateForm.endDate}
                onChange={(event) => {
                  const nextValue = event.currentTarget.value;
                  setTemplateForm((current) => ({
                    ...current,
                    endDate: nextValue,
                  }));
                }}
              />
            ) : null}

            <Text size="sm" c="dimmed">
              Queues are attached to the currently selected ad account and will keep appearing in Calendar until the end date or until you remove them.
            </Text>

            <Group justify="flex-end" gap="sm">
              <Button
                variant="default"
                radius="xl"
                onClick={() => {
                  setTemplateEditorOpened(false);
                  setEditingTemplateId(null);
                }}
              >
                Cancel
              </Button>
              <Button
                radius="xl"
                loading={savingTemplate}
                disabled={
                  !templateForm.title.trim() ||
                  !templateForm.startDate ||
                  !templateForm.timeOfDay ||
                  (templateForm.recurrenceType === 'weekly' &&
                    templateForm.weekdays.length === 0) ||
                  (!templateForm.isIndefinite && !templateForm.endDate)
                }
                onClick={() => void saveTemplate()}
              >
                {editingTemplateId ? 'Save changes' : 'Create queue'}
              </Button>
            </Group>
          </Stack>
        </Modal>

      </Stack>
    </Container>
  );
}
