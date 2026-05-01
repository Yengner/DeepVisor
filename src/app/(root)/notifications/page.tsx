import {
  Alert,
  Badge,
  Button,
  Card,
  Container,
  Divider,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  IconArrowRight,
  IconBell,
  IconBolt,
  IconCalendarTime,
  IconChartBar,
  IconInbox,
  IconInfoCircle,
  IconPlug,
} from '@tabler/icons-react';
import { formatDisplayDate, type NotificationFeedItem } from '@/lib/shared';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import { getUserNotifications } from '@/lib/server/actions/user/settings';

function formatRelativeTime(value: string | null): string {
  if (!value) {
    return 'Recently';
  }

  const date = new Date(value);
  const deltaMs = Date.now() - date.getTime();

  if (!Number.isFinite(deltaMs)) {
    return 'Recently';
  }

  const hours = Math.round(deltaMs / (60 * 60 * 1000));
  if (hours < 1) {
    return 'Within the last hour';
  }

  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return 'Not available';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatTypeLabel(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function typeColor(value: string): string {
  switch (value) {
    case 'report':
      return 'blue';
    case 'calendar':
      return 'grape';
    case 'guardrail':
      return 'red';
    case 'sync':
      return 'teal';
    case 'insight':
      return 'violet';
    case 'workflow':
      return 'orange';
    default:
      return 'gray';
  }
}

function SummaryCard(props: {
  title: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <Card withBorder radius="md" p="lg">
      <Group justify="space-between" align="flex-start" mb="md">
        <div>
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            {props.title}
          </Text>
          <Title order={3} mt={6}>
            {props.value}
          </Title>
        </div>
        <ThemeIcon variant="light" color={props.color} radius="md" size="lg">
          {props.icon}
        </ThemeIcon>
      </Group>
      <Text size="sm" c="dimmed">
        {props.detail}
      </Text>
    </Card>
  );
}

function NotificationCard({ notification }: { notification: NotificationFeedItem }) {
  return (
    <Paper
      withBorder
      radius="md"
      p="md"
      style={{
        backgroundColor: notification.read ? undefined : 'var(--mantine-color-blue-0)',
      }}
    >
      <Group justify="space-between" align="flex-start" gap="md" wrap="nowrap">
        <div style={{ flex: 1, minWidth: 0 }}>
          <Group gap="xs" mb={6} wrap="wrap">
            {!notification.read ? (
              <Badge color="blue" variant="light">
                Unread
              </Badge>
            ) : (
              <Badge color="gray" variant="light">
                Read
              </Badge>
            )}
            <Badge color={typeColor(notification.type)} variant="outline">
              {formatTypeLabel(notification.type)}
            </Badge>
          </Group>

          <Text fw={700}>{notification.title}</Text>
          <Text size="sm" c="dimmed" mt={4}>
            {notification.message}
          </Text>

          <Group gap="xs" mt="md" wrap="wrap">
            <Text size="xs" c="dimmed">
              {formatDateTime(notification.created_at)}
            </Text>
            <Text size="xs" c="dimmed">
              -
            </Text>
            <Text size="xs" c="dimmed">
              {formatRelativeTime(notification.created_at)}
            </Text>
          </Group>
        </div>

        {notification.link ? (
          <Button
            component="a"
            href={notification.link}
            variant="light"
            size="xs"
            rightSection={<IconArrowRight size={14} />}
          >
            Open
          </Button>
        ) : null}
      </Group>
    </Paper>
  );
}

export default async function NotificationsPage() {
  const { user } = await getRequiredAppContext();
  const notifications = await getUserNotifications(user.id, 50);
  const unreadCount = notifications.filter((notification) => !notification.read).length;
  const actionableCount = notifications.filter((notification) => Boolean(notification.link)).length;
  const typeCount = new Set(notifications.map((notification) => notification.type)).size;
  const newestDate = notifications[0]?.created_at ?? null;

  return (
    <Container size="xl" py="md">
      <Stack gap="xl">
        <Group justify="space-between" align="flex-start" gap="lg" wrap="wrap">
          <div>
            <Badge variant="light" color="blue" mb="sm">
              Live inbox
            </Badge>
            <Title order={1}>Notifications</Title>
            <Text c="dimmed" size="lg" mt={8} maw={760}>
              This feed now reflects real DeepVisor notices for the current workspace, including
              trend findings, report-ready prompts, and workflow follow-up items.
            </Text>
          </div>

          <Group gap="sm">
            <Button component="a" href="/dashboard" variant="default">
              Dashboard
            </Button>
            <Button component="a" href="/integration" rightSection={<IconArrowRight size={16} />}>
              Open integrations
            </Button>
          </Group>
        </Group>

        <SimpleGrid cols={{ base: 1, md: 2, xl: 4 }} spacing="md">
          <SummaryCard
            title="Feed Size"
            value={`${notifications.length}`}
            detail="Notifications currently available in the workspace feed."
            icon={<IconInbox size={18} />}
            color="blue"
          />
          <SummaryCard
            title="Unread"
            value={`${unreadCount}`}
            detail="Messages that would still need attention in a live inbox."
            icon={<IconBell size={18} />}
            color="grape"
          />
          <SummaryCard
            title="Actionable"
            value={`${actionableCount}`}
            detail="Notifications with a direct destination inside the app."
            icon={<IconBolt size={18} />}
            color="orange"
          />
          <SummaryCard
            title="Latest Update"
            value={newestDate ? formatDisplayDate(newestDate) : 'N/A'}
            detail={newestDate ? formatRelativeTime(newestDate) : 'No notifications yet.'}
            icon={<IconCalendarTime size={18} />}
            color="teal"
          />
        </SimpleGrid>

        <SimpleGrid cols={{ base: 1, xl: 3 }} spacing="md" verticalSpacing="md">
          <Card withBorder radius="lg" p="xl" style={{ gridColumn: 'span 2' }}>
            <Group justify="space-between" align="flex-start" mb="lg" wrap="wrap">
              <div>
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                  Full Feed
                </Text>
                <Title order={3}>All notifications</Title>
                <Text size="sm" c="dimmed" mt={4}>
                  Ordered newest first, with direct links back to the parts of the product each notice points to.
                </Text>
              </div>
              <Badge color={unreadCount > 0 ? 'blue' : 'gray'} variant="light">
                {unreadCount} unread
              </Badge>
            </Group>

            <Stack gap="md">
              {notifications.map((notification) => (
                <NotificationCard key={notification.id} notification={notification} />
              ))}
            </Stack>
          </Card>

          <Stack gap="md">
            <Card withBorder radius="lg" p="xl">
              <Group gap="sm" mb="md">
                <ThemeIcon variant="light" color="violet" radius="md">
                  <IconChartBar size={16} />
                </ThemeIcon>
                <div>
                  <Text fw={700}>What will show up here</Text>
                  <Text size="sm" c="dimmed">
                    The intended notification categories for DeepVisor
                  </Text>
                </div>
              </Group>

              <Stack gap="sm">
                <Paper withBorder radius="md" p="sm">
                  <Text fw={700} size="sm">Reports and briefs</Text>
                  <Text size="sm" c="dimmed" mt={4}>
                    New summaries, wins, weak spots, and recommendation refreshes.
                  </Text>
                </Paper>
                <Paper withBorder radius="md" p="sm">
                  <Text fw={700} size="sm">Calendar and workflow prompts</Text>
                  <Text size="sm" c="dimmed" mt={4}>
                    Approval requests, queued work, and next-step reminders.
                  </Text>
                </Paper>
                <Paper withBorder radius="md" p="sm">
                  <Text fw={700} size="sm">Sync and integration status</Text>
                  <Text size="sm" c="dimmed" mt={4}>
                    Platform sync completions, token issues, and reconnect prompts.
                  </Text>
                </Paper>
                <Paper withBorder radius="md" p="sm">
                  <Text fw={700} size="sm">Guardrails and signals</Text>
                  <Text size="sm" c="dimmed" mt={4}>
                    Spend shifts, delivery concerns, and other notable account changes.
                  </Text>
                </Paper>
              </Stack>
            </Card>

            <Card withBorder radius="lg" p="xl">
              <Group gap="sm" mb="md">
                <ThemeIcon variant="light" color="teal" radius="md">
                  <IconPlug size={16} />
                </ThemeIcon>
                <div>
                  <Text fw={700}>How to use this feed</Text>
                  <Text size="sm" c="dimmed">
                    What these notices are meant to drive
                  </Text>
                </div>
              </Group>

              <Stack gap="sm">
                <Text size="sm" c="dimmed">
                  Use this page to review the current attention layer without leaving the workspace context:
                </Text>
                <Divider />
                <Text size="sm">1. Trend findings and report-ready prompts land here first.</Text>
                <Text size="sm">2. Calendar approvals and follow-up links stay directly actionable.</Text>
                <Text size="sm">3. Notification and report preferences can be managed from Settings.</Text>
                <Button component="a" href="/settings" variant="light" mt="sm">
                  Review settings
                </Button>
              </Stack>
            </Card>

            <Card withBorder radius="lg" p="xl">
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Categories
              </Text>
              <Title order={3} mt={6}>
                {typeCount} feed types
              </Title>
              <Text size="sm" c="dimmed" mt="xs">
                The static feed currently covers reporting, calendar, guardrails, sync, insights, system, and workflow messages.
              </Text>
            </Card>
          </Stack>
        </SimpleGrid>
      </Stack>
    </Container>
  );
}
