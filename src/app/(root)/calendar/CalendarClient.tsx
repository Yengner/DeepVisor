'use client';

import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Container,
  Group,
  Modal,
  Paper,
  SegmentedControl,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconCalendarMonth,
  IconCalendarWeek,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconEdit,
  IconPlus,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import type { BusinessIntelligenceWorkspace } from '@/lib/server/intelligence';
import {
  buildCalendarQueuePreviewItems,
  type CalendarQueuePreviewItem as QueueItem,
  type CalendarQueueSource as QueueSource,
  type CalendarQueueStatus as QueueStatus,
} from '@/lib/shared';
import classes from './CalendarClient.module.css';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MINI_WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const WEEK_VIEW_START_HOUR = 0;
const WEEK_VIEW_END_HOUR = 24;
const WEEK_HOUR_HEIGHT = 72;
const MONTH_VIEW_VISIBLE_ITEM_COUNT = 4;

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

function compareQueueItems(left: QueueItem, right: QueueItem): number {
  if (left.day !== right.day) {
    return left.day.localeCompare(right.day);
  }

  return parseTimeToMinutes(left.time) - parseTimeToMinutes(right.time);
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

function queueEventClassName(source: QueueSource, isSelected: boolean): string {
  const toneClass =
    source === 'manual'
      ? classes.eventManual
      : source === 'agent'
        ? classes.eventAgent
        : classes.eventAutomatic;

  return [toneClass, isSelected ? classes.selectedEvent : ''].filter(Boolean).join(' ');
}

function weekEventStyle(item: QueueItem): CSSProperties {
  const gridStartMinutes = WEEK_VIEW_START_HOUR * 60;
  const gridEndMinutes = WEEK_VIEW_END_HOUR * 60;
  const rawStart = parseTimeToMinutes(item.time);
  const rawEnd = rawStart + item.durationMinutes;
  const start = Math.max(rawStart, gridStartMinutes);
  const end = Math.min(Math.max(rawEnd, start + 30), gridEndMinutes);
  const top = ((start - gridStartMinutes) / 60) * WEEK_HOUR_HEIGHT;
  const height = Math.max(((end - start) / 60) * WEEK_HOUR_HEIGHT, 54);

  return {
    top,
    height,
  };
}

function formatEventDateTime(item: QueueItem): string {
  const date = new Date(`${item.day}T00:00:00`);
  const startMinutes = parseTimeToMinutes(item.time);
  const start = new Date(date);
  start.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0);

  const end = new Date(start);
  end.setMinutes(end.getMinutes() + item.durationMinutes);

  return `${start.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })} · ${start.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })} - ${end.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })}`;
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

export default function CalendarClient({ workspace }: { workspace: BusinessIntelligenceWorkspace }) {
  const router = useRouter();
  const [queueItems, setQueueItems] = useState<QueueItem[]>(() =>
    buildCalendarQueuePreviewItems(workspace.selectedAdAccountName)
  );
  const [planView, setPlanView] = useState<'weekly' | 'monthly'>('weekly');
  const [calendarCursor, setCalendarCursor] = useState<Date>(() => startOfDay(new Date()));
  const [selectedCalendarItemId, setSelectedCalendarItemId] = useState<string | null>(null);

  const selectionRequiredPlatforms = workspace.platforms.filter((platform) => platform.selectionRequired);
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
  const visibleCalendarDayKeys = useMemo(
    () => (planView === 'weekly' ? weekDayKeys : monthDayKeys),
    [monthDayKeys, planView, weekDayKeys]
  );
  const visibleCalendarDayKeySet = useMemo(
    () => new Set(visibleCalendarDayKeys),
    [visibleCalendarDayKeys]
  );

  const queueCounts = useMemo(
    () => ({
      total: queueItems.length,
      ready: queueItems.filter((item) => item.status === 'ready').length,
      approved: queueItems.filter((item) => item.status === 'approved').length,
      draft: queueItems.filter((item) => item.status === 'draft').length,
    }),
    [queueItems]
  );

  const weekItemsByDay = useMemo(() => {
    const grouped = new Map<string, QueueItem[]>(weekDayKeys.map((day) => [day, []]));

    queueItems.forEach((item) => {
      const bucket = grouped.get(item.day);

      if (bucket) {
        bucket.push(item);
      }
    });

    grouped.forEach((items) => items.sort(compareQueueItems));
    return grouped;
  }, [queueItems, weekDayKeys]);

  const monthItemsByDay = useMemo(() => {
    const grouped = new Map<string, QueueItem[]>(monthDayKeys.map((day) => [day, []]));

    queueItems.forEach((item) => {
      const bucket = grouped.get(item.day);

      if (bucket) {
        bucket.push(item);
      }
    });

    grouped.forEach((items) => items.sort(compareQueueItems));
    return grouped;
  }, [queueItems, monthDayKeys]);

  const selectedCalendarItem = useMemo(
    () => queueItems.find((item) => item.id === selectedCalendarItemId) ?? null,
    [queueItems, selectedCalendarItemId]
  );

  const selectedVisibleCalendarItem =
    selectedCalendarItem && visibleCalendarDayKeySet.has(selectedCalendarItem.day)
      ? selectedCalendarItem
      : null;

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
    () => queueItems.filter((item) => visibleCalendarDayKeySet.has(item.day)).length,
    [queueItems, visibleCalendarDayKeySet]
  );

  const visibleWeekItems = useMemo(
    () =>
      weekDayKeys.flatMap((dayKey) => (weekItemsByDay.get(dayKey) ?? []).map((item) => ({ dayKey, item }))),
    [weekDayKeys, weekItemsByDay]
  );

  function updateQueueItem(id: string, updater: (item: QueueItem) => QueueItem | null) {
    setQueueItems((current) =>
      current.flatMap((item) => {
        if (item.id !== id) {
          return [item];
        }

        const next = updater(item);
        return next ? [next] : [];
      })
    );
  }

  function handleApprove(id: string) {
    updateQueueItem(id, (item) => ({ ...item, status: 'approved' }));
    toast.success('Queue item approved');
  }

  function handleModify(id: string) {
    updateQueueItem(id, (item) => ({
      ...item,
      status: 'draft',
      description: `${item.description} Edited in skeleton mode for later refinement.`,
    }));
    toast.success('Queue item moved back to draft');
  }

  function handleDelete(id: string) {
    setSelectedCalendarItemId((current) => (current === id ? null : current));
    updateQueueItem(id, () => null);
    toast.success('Queue item removed');
  }

  function handleAddQueueItem(title?: string) {
    const nextDay =
      addQueueTargets[
        Math.min(
          queueItems.length % Math.max(addQueueTargets.length, 1),
          Math.max(addQueueTargets.length - 1, 0)
        )
      ] || toIsoDay(calendarCursor);

    const nextItem: QueueItem = {
      id: `queue-${Date.now()}`,
      title: title || 'New queued action',
      description:
        'New placeholder queue item. This will later be editable with real planning inputs and scheduling rules.',
      day: nextDay,
      time: '1:00 PM',
      durationMinutes: 45,
      channel: 'Planning',
      status: 'draft',
      source: 'manual',
    };

    setQueueItems((current) => [...current, nextItem]);
    setSelectedCalendarItemId(nextItem.id);
    toast.success('Added to queue');
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

  const weekGridStyle = {
    '--calendar-hour-row-height': `${WEEK_HOUR_HEIGHT}px`,
    '--calendar-week-grid-height': `${(WEEK_VIEW_END_HOUR - WEEK_VIEW_START_HOUR) * WEEK_HOUR_HEIGHT}px`,
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
                Create custom queue
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
              </Paper>

              <Paper withBorder radius="xl" p="md" className={classes.selectedStrip}>
                {selectedVisibleCalendarItem ? (
                  <Stack gap="sm">
                    <div className={classes.selectedStripBody}>
                      <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                        Selected item
                      </Text>
                      <Group gap="xs" wrap="wrap" mt="xs">
                        <Badge color="gray" variant="light">
                          {queueSourceLabel(selectedVisibleCalendarItem.source)}
                        </Badge>
                        <Badge
                          color={queueStatusColor(selectedVisibleCalendarItem.status)}
                          variant="light"
                        >
                          {queueStatusLabel(selectedVisibleCalendarItem.status)}
                        </Badge>
                        <Badge color="gray" variant="light">
                          {formatSidebarDayLabel(selectedVisibleCalendarItem.day)}
                        </Badge>
                        <Badge color="gray" variant="light">
                          {selectedVisibleCalendarItem.time}
                        </Badge>
                        <Badge color="gray" variant="light">
                          {selectedVisibleCalendarItem.channel}
                        </Badge>
                      </Group>
                      <Text fw={700} mt="sm">
                        {selectedVisibleCalendarItem.title}
                      </Text>
                      <Text size="sm" c="dimmed" mt={4}>
                        {selectedVisibleCalendarItem.description}
                      </Text>
                    </div>

                    <Stack gap="xs" className={classes.selectedStripActions}>
                      <Button
                        size="sm"
                        radius="xl"
                        variant="light"
                        color="green"
                        leftSection={<IconCheck size={14} />}
                        onClick={() => handleApprove(selectedVisibleCalendarItem.id)}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        radius="xl"
                        variant="light"
                        color="blue"
                        leftSection={<IconEdit size={14} />}
                        onClick={() => handleModify(selectedVisibleCalendarItem.id)}
                      >
                        Modify
                      </Button>
                      <Button
                        size="sm"
                        radius="xl"
                        variant="light"
                        color="red"
                        leftSection={<IconTrash size={14} />}
                        onClick={() => handleDelete(selectedVisibleCalendarItem.id)}
                      >
                        Remove
                      </Button>
                    </Stack>
                  </Stack>
                ) : (
                  <div className={classes.selectedStripBody}>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                      Selected item
                    </Text>
                    <Text fw={700} mt={6}>
                      Nothing selected
                    </Text>
                    <Text size="sm" c="dimmed" mt={4}>
                      Pick a calendar item to review details and approve, modify, or remove it.
                    </Text>
                  </div>
                )}
              </Paper>
            </div>
          </aside>

          <section className={classes.calendarShell}>
          <div className={classes.calendarToolbar}>
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Calendar
              </Text>
              <Title order={2} mt={4}>
                {calendarRangeLabel}
              </Title>
              <Group gap="xs" mt="sm" wrap="wrap">
                <Badge color="gray" variant="light">
                  {workspace.selection.scopeLabel}
                </Badge>
                <Badge color="blue" variant="light">
                  {selectedAccountSummary}
                </Badge>
                <Badge color="gray" variant="light">
                  {visibleCalendarItemCount} scheduled
                </Badge>
                <Badge color="gray" variant="light">
                  {queueCounts.ready} awaiting approval
                </Badge>
              </Group>
              <div className={classes.calendarLegend}>
                <span className={classes.legendItem}>
                  <span className={[classes.legendDot, classes.sourceManual].join(' ')} />
                  User made
                </span>
                <span className={classes.legendItem}>
                  <span className={[classes.legendDot, classes.sourceAgent].join(' ')} />
                  AI agent made
                </span>
                <span className={classes.legendItem}>
                  <span className={[classes.legendDot, classes.sourceAutomatic].join(' ')} />
                  Automatic
                </span>
              </div>
            </div>

            <Group gap="sm" wrap="wrap" justify="flex-end">
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

              <div className={classes.weekScroller}>
                <div className={classes.weekBody}>
                  <div className={classes.weekTimeColumn}>
                    {Array.from(
                      { length: WEEK_VIEW_END_HOUR - WEEK_VIEW_START_HOUR + 1 },
                      (_, index) => WEEK_VIEW_START_HOUR + index
                    ).map((hour) => (
                      <div key={hour} className={classes.weekTimeLabel}>
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
                        className={[classes.weekDayColumn, isToday ? classes.weekDayColumnToday : '']
                          .filter(Boolean)
                          .join(' ')}
                      >
                        {items.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            className={[
                              classes.weekEvent,
                              queueEventClassName(item.source, selectedCalendarItemId === item.id),
                            ]
                              .filter(Boolean)
                              .join(' ')}
                            style={weekEventStyle(item)}
                            onClick={() => setSelectedCalendarItemId(item.id)}
                            title={`${item.title} · ${item.time}`}
                          >
                            <span className={classes.eventTopRow}>
                              <span
                                className={[classes.eventSourceDot, queueSourceClassName(item.source)]
                                  .filter(Boolean)
                                  .join(' ')}
                              />
                              <span className={classes.eventTime}>{item.time}</span>
                            </span>
                            <span className={classes.eventTitle}>{item.title}</span>
                            <span className={classes.eventMeta}>{item.channel}</span>
                          </button>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>

              {visibleWeekItems.length === 0 ? (
                <div className={classes.emptyState}>
                  <Text fw={700}>Nothing is scheduled in this week</Text>
                  <Text size="sm" c="dimmed" mt={4}>
                    Add a custom queue item or move the calendar to another week.
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
                          <button
                            key={item.id}
                            type="button"
                            className={[
                              classes.monthEvent,
                              selectedCalendarItemId === item.id ? classes.selectedMonthEvent : '',
                            ]
                              .filter(Boolean)
                              .join(' ')}
                            onClick={() => setSelectedCalendarItemId(item.id)}
                            title={`${item.time} · ${item.title} · ${queueSourceLabel(item.source)}`}
                          >
                            <span
                              className={[classes.monthEventDot, queueSourceClassName(item.source)]
                                .filter(Boolean)
                                .join(' ')}
                            />
                            <span className={classes.monthEventText}>
                              <span className={classes.monthEventTime}>{item.time}</span>
                              <span className={classes.monthEventLabel}>{item.title}</span>
                            </span>
                          </button>
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
                    Add a custom queue item or move the calendar to another month.
                  </Text>
                </div>
              ) : null}
            </div>
          )}
        </section>
        </div>
        <Modal
          opened={Boolean(selectedVisibleCalendarItem)}
          onClose={() => setSelectedCalendarItemId(null)}
          centered
          size={720}
          radius="28px"
          withCloseButton={false}
          overlayProps={{ backgroundOpacity: 0.32, blur: 4 }}
          classNames={{
            content: classes.eventModalContent,
            body: classes.eventModalBody,
          }}
        >
          {selectedVisibleCalendarItem ? (
            <div className={classes.eventModalInner}>
              <Group justify="space-between" align="flex-start" gap="md" wrap="nowrap">
                <Group align="flex-start" gap="md" wrap="nowrap">
                  <span
                    className={[classes.eventModalMarker, queueSourceClassName(selectedVisibleCalendarItem.source)]
                      .filter(Boolean)
                      .join(' ')}
                  />
                  <div className={classes.eventModalHeaderBlock}>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                      {queueSourceLabel(selectedVisibleCalendarItem.source)}
                    </Text>
                    <Title order={1} className={classes.eventModalTitle}>
                      {selectedVisibleCalendarItem.title}
                    </Title>
                    <Text className={classes.eventModalDate}>
                      {formatEventDateTime(selectedVisibleCalendarItem)}
                    </Text>
                  </div>
                </Group>

                <ActionIcon
                  variant="subtle"
                  color="gray"
                  radius="xl"
                  size="lg"
                  aria-label="Close event details"
                  onClick={() => setSelectedCalendarItemId(null)}
                >
                  <IconX size={20} />
                </ActionIcon>
              </Group>

              <Group gap="xs" wrap="wrap" mt="lg">
                <Badge color="gray" variant="light">
                  {queueSourceLabel(selectedVisibleCalendarItem.source)}
                </Badge>
                <Badge
                  color={queueStatusColor(selectedVisibleCalendarItem.status)}
                  variant="light"
                >
                  {queueStatusLabel(selectedVisibleCalendarItem.status)}
                </Badge>
                <Badge color="gray" variant="light">
                  {selectedVisibleCalendarItem.channel}
                </Badge>
                <Badge color="gray" variant="light">
                  {formatSidebarDayLabel(selectedVisibleCalendarItem.day)}
                </Badge>
              </Group>

              <Text className={classes.eventModalDescription}>
                {selectedVisibleCalendarItem.description}
              </Text>

              <div className={classes.eventModalMetaGrid}>
                <div className={classes.eventModalMetaItem}>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                    Time
                  </Text>
                  <Text fw={700}>{selectedVisibleCalendarItem.time}</Text>
                </div>
                <div className={classes.eventModalMetaItem}>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                    Channel
                  </Text>
                  <Text fw={700}>{selectedVisibleCalendarItem.channel}</Text>
                </div>
                <div className={classes.eventModalMetaItem}>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                    Status
                  </Text>
                  <Text fw={700}>{queueStatusLabel(selectedVisibleCalendarItem.status)}</Text>
                </div>
                <div className={classes.eventModalMetaItem}>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                    Created by
                  </Text>
                  <Text fw={700}>{queueSourceLabel(selectedVisibleCalendarItem.source)}</Text>
                </div>
              </div>

              <Group gap="sm" wrap="wrap" mt="xl">
                <Button
                  radius="xl"
                  color="green"
                  leftSection={<IconCheck size={16} />}
                  onClick={() => handleApprove(selectedVisibleCalendarItem.id)}
                >
                  Approve
                </Button>
                <Button
                  radius="xl"
                  variant="light"
                  color="blue"
                  leftSection={<IconEdit size={16} />}
                  onClick={() => handleModify(selectedVisibleCalendarItem.id)}
                >
                  Modify
                </Button>
                <Button
                  radius="xl"
                  variant="light"
                  color="red"
                  leftSection={<IconTrash size={16} />}
                  onClick={() => handleDelete(selectedVisibleCalendarItem.id)}
                >
                  Remove
                </Button>
              </Group>
            </div>
          ) : null}
        </Modal>
      </Stack>
    </Container>
  );
}
