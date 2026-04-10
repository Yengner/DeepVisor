'use client';

import { useMemo, useState } from 'react';
import {
  ActionIcon,
  Button,
  Collapse,
  Group,
  Indicator,
  Paper,
  Popover,
  Stack,
  Text,
} from '@mantine/core';
import { IconBulb, IconChevronDown, IconSparkles } from '@tabler/icons-react';

export type NoticeWindow = 'today' | 'this_week' | 'last_week' | 'this_month' | 'last_month';

export type NoticeItem = {
  id: string;
  window: NoticeWindow;
  title: string;
  description: string;
};

export const DEEPVISOR_STATIC_NOTICES: NoticeItem[] = [
  {
    id: 'notice-today-1',
    window: 'today',
    title: 'Creative fatigue watch',
    description: 'DeepVisor noticed the current lead angle is repeating too often in recent active creative rotation.',
  },
  {
    id: 'notice-this-week-1',
    window: 'this_week',
    title: 'Budget pressure',
    description: 'This week looks concentrated around one campaign, so budget flexibility may need to be queued.',
  },
  {
    id: 'notice-last-week-1',
    window: 'last_week',
    title: 'Tracking confidence',
    description: 'Last week had weaker conversion confidence, which should lower how aggressively the system recommends changes.',
  },
  {
    id: 'notice-this-month-1',
    window: 'this_month',
    title: 'Audience expansion window',
    description: 'This month has room for a controlled prospecting expansion based on the stronger recent campaign pattern.',
  },
  {
    id: 'notice-last-month-1',
    window: 'last_month',
    title: 'Landing page friction',
    description: 'Last month showed a repeat drop after click-through, which suggests the funnel should stay in the planning queue.',
  },
];

const noticeWindowOptions: Array<{ label: string; value: NoticeWindow }> = [
  { label: 'Today', value: 'today' },
  { label: 'This week', value: 'this_week' },
  { label: 'Last week', value: 'last_week' },
  { label: 'This month', value: 'this_month' },
  { label: 'Last month', value: 'last_month' },
];

type DeepVisorNoticesProps = {
  anchorId?: string;
  notices?: NoticeItem[];
  showAgencyLink?: boolean;
  variant?: 'inline' | 'popover';
};

function NoticesPanel({
  noticeWindow,
  notices,
  onClose,
  onWindowChange,
  showAgencyLink,
}: {
  noticeWindow: NoticeWindow;
  notices: NoticeItem[];
  onClose: () => void;
  onWindowChange: (value: NoticeWindow) => void;
  showAgencyLink: boolean;
}) {
  return (
    <Paper withBorder radius="xl" p="md" w="100%" bg="white">
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start" gap="sm">
          <div>
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
              What DeepVisor noticed
            </Text>
            <Text fw={700} size="sm">
              Small notice board for recent account signals
            </Text>
          </div>
          <ActionIcon
            variant="subtle"
            color="gray"
            radius="xl"
            aria-label="Collapse DeepVisor notices"
            onClick={onClose}
          >
            <IconChevronDown size={16} />
          </ActionIcon>
        </Group>

        <Group gap="xs" wrap="wrap">
          {noticeWindowOptions.map((option) => (
            <Button
              key={option.value}
              size="xs"
              radius="xl"
              variant={noticeWindow === option.value ? 'light' : 'subtle'}
              color={noticeWindow === option.value ? 'yellow' : 'gray'}
              style={{ whiteSpace: 'nowrap' }}
              onClick={() => onWindowChange(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </Group>

        <Stack gap="xs">
          {notices.length > 0 ? (
            notices.map((notice) => (
              <Paper key={notice.id} withBorder radius="md" p="sm" bg="var(--mantine-color-gray-0)">
                <Text fw={700} size="sm">
                  {notice.title}
                </Text>
                <Text size="xs" c="dimmed" mt={4}>
                  {notice.description}
                </Text>
              </Paper>
            ))
          ) : (
            <Paper withBorder radius="md" p="sm" bg="var(--mantine-color-gray-0)">
              <Text size="xs" c="dimmed">
                Nothing notable is staged for this period yet.
              </Text>
            </Paper>
          )}
        </Stack>

        {showAgencyLink ? (
          <Group justify="flex-end">
            <Button component="a" href="/calendar" size="xs" radius="xl" variant="light" color="yellow">
              Open calendar
            </Button>
          </Group>
        ) : null}
      </Stack>
    </Paper>
  );
}

export default function DeepVisorNotices({
  anchorId,
  notices = DEEPVISOR_STATIC_NOTICES,
  showAgencyLink = false,
  variant = 'inline',
}: DeepVisorNoticesProps) {
  const panelWidth = 520;
  const [opened, setOpened] = useState(false);
  const [noticeWindow, setNoticeWindow] = useState<NoticeWindow>('today');

  const visibleNotices = useMemo(
    () => notices.filter((notice) => notice.window === noticeWindow),
    [noticeWindow, notices]
  );

  const trigger = (
    <Indicator
      inline
      disabled={notices.length === 0}
      color="yellow"
      size={18}
      offset={6}
      label={<IconSparkles size={10} />}
    >
      <ActionIcon
        size={44}
        radius="xl"
        variant={opened ? 'filled' : 'light'}
        color="yellow"
        aria-label={opened ? 'Hide DeepVisor notices' : 'Show DeepVisor notices'}
        onClick={() => setOpened((current) => !current)}
      >
        <IconBulb size={20} />
      </ActionIcon>
    </Indicator>
  );

  if (variant === 'popover') {
    return (
      <Popover opened={opened} onChange={setOpened} width={panelWidth} position="bottom-end" shadow="md">
        <Popover.Target>{trigger}</Popover.Target>
        <Popover.Dropdown p={0} bd="none" bg="transparent">
          <NoticesPanel
            noticeWindow={noticeWindow}
            notices={visibleNotices}
            onClose={() => setOpened(false)}
            onWindowChange={setNoticeWindow}
            showAgencyLink={showAgencyLink}
          />
        </Popover.Dropdown>
      </Popover>
    );
  }

  return (
    <Stack id={anchorId} gap="sm" align="flex-end">
      {trigger}
      <Collapse in={opened}>
        <div style={{ width: panelWidth, maxWidth: '100%' }}>
          <NoticesPanel
            noticeWindow={noticeWindow}
            notices={visibleNotices}
            onClose={() => setOpened(false)}
            onWindowChange={setNoticeWindow}
            showAgencyLink={showAgencyLink}
          />
        </div>
      </Collapse>
    </Stack>
  );
}
