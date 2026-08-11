import {
  Badge,
  Button,
  Card,
  Container,
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
  IconInbox,
} from '@tabler/icons-react';
import {
  formatDisplayDate,
  formatNotificationPreviewMessage,
  formatRelativeTime,
  type NotificationFeedItem,
} from '@/lib/shared';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import { getUserNotifications } from '@/lib/server/actions/user/settings';
import classes from './NotificationsPage.module.css';
import NotificationAction from './NotificationAction';

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
      return 'signal';
    case 'calendar':
      return '#6e6bf4';
    case 'guardrail':
      return '#e76156';
    case 'sync':
      return 'signal';
    case 'insight':
      return '#6e6bf4';
    case 'workflow':
      return 'signal';
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
    <Card withBorder radius="md" p="lg" className={classes.summaryCard}>
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
      className={`${classes.notificationCard} ${notification.read ? '' : classes.unread}`}
    >
      <Group
        justify="space-between"
        align="flex-start"
        gap="md"
        wrap="wrap"
        className={classes.notificationRow}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <Group gap="xs" mb={6} wrap="wrap">
            {!notification.read ? (
              <Badge color="signal" variant="light">
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
          <Text
            size="sm"
            c="dimmed"
            mt={4}
            lineClamp={2}
            title={notification.message}
          >
            {formatNotificationPreviewMessage(notification.message)}
          </Text>

          <Group gap="xs" mt="md" wrap="wrap">
            <Text size="xs" c="dimmed">
              {formatDateTime(notification.created_at)}
            </Text>
            <Text size="xs" c="dimmed">
              -
            </Text>
            <Text size="xs" c="dimmed">
              {formatRelativeTime(notification.created_at, {
                emptyLabel: 'Recently',
                futureLabel: 'Just now',
                includeSeconds: true,
              })}
            </Text>
          </Group>
        </div>

        <NotificationAction
          notificationId={notification.id}
          unread={!notification.read}
          href={notification.link ?? null}
          className={classes.notificationAction}
        />
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
  const typeSummary = Array.from(
    notifications.reduce((counts, notification) => {
      counts.set(notification.type, (counts.get(notification.type) ?? 0) + 1);
      return counts;
    }, new Map<string, number>())
  ).sort((left, right) => right[1] - left[1]);
  const newestDate = notifications[0]?.created_at ?? null;

  return (
    <Container size="xl" py="md" className={`${classes.page} dv-app-page`}>
      <Stack gap="lg">
        <Group
          justify="space-between"
          align="flex-start"
          gap="lg"
          wrap="wrap"
          className={classes.hero}
        >
          <div>
            <Badge variant="light" mb="sm" className={classes.heroBadge}>
              Live inbox
            </Badge>
            <Title order={1} className={classes.heroTitle}>Notifications</Title>
            <Text size="md" mt={8} maw={720} className={classes.heroCopy}>
              Monitor report prompts, account signals, and workflow follow-ups from one live queue.
            </Text>
          </div>

          <Group gap="sm" className={classes.headerActions}>
            <Button component="a" href="/dashboard" variant="default" className={classes.heroSecondaryAction}>
              Dashboard
            </Button>
            <Button
              component="a"
              href="/integration"
              rightSection={<IconArrowRight size={16} />}
              className={classes.heroPrimaryAction}
            >
              Open integrations
            </Button>
          </Group>
        </Group>

        <SimpleGrid cols={{ base: 1, md: 2, xl: 4 }} spacing="md">
          <SummaryCard
            title="Recent Feed"
            value={`${notifications.length}`}
            detail="Newest items loaded for this workspace."
            icon={<IconInbox size={18} />}
            color="signal"
          />
          <SummaryCard
            title="Unread"
            value={`${unreadCount}`}
            detail="Items still awaiting review."
            icon={<IconBell size={18} />}
            color="signal"
          />
          <SummaryCard
            title="Actionable"
            value={`${actionableCount}`}
            detail="Notifications with a direct destination inside the app."
            icon={<IconBolt size={18} />}
            color="signal"
          />
          <SummaryCard
            title="Latest Update"
            value={newestDate ? formatDisplayDate(newestDate) : 'N/A'}
            detail={
              newestDate
                ? formatRelativeTime(newestDate, {
                    emptyLabel: 'Recently',
                    futureLabel: 'Just now',
                    includeSeconds: true,
                  })
                : 'No notifications yet.'
            }
            icon={<IconCalendarTime size={18} />}
            color="signal"
          />
        </SimpleGrid>

        <SimpleGrid cols={{ base: 1, xl: 3 }} spacing="md" verticalSpacing="md">
          <Card withBorder radius="lg" p="xl" className={classes.feedCard}>
            <Group justify="space-between" align="flex-start" mb="lg" wrap="wrap">
              <div>
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                  Full Feed
                </Text>
                <Title order={3}>Recent notifications</Title>
                <Text size="sm" c="dimmed" mt={4}>
                  Newest first, with direct links for actionable items.
                </Text>
              </div>
              <Badge color={unreadCount > 0 ? 'signal' : 'gray'} variant="light">
                {unreadCount} unread
              </Badge>
            </Group>

            {notifications.length > 0 ? (
              <Stack gap="md">
                {notifications.map((notification) => (
                  <NotificationCard key={notification.id} notification={notification} />
                ))}
              </Stack>
            ) : (
              <Stack align="center" ta="center" py="xl" gap="xs">
                <ThemeIcon size="xl" variant="light" color="signal" radius="md">
                  <IconInbox size={20} />
                </ThemeIcon>
                <Text fw={750}>Inbox clear</Text>
                <Text size="sm" c="dimmed" maw={420}>
                  There are no report, workflow, sync, or account-signal notifications yet.
                </Text>
              </Stack>
            )}
          </Card>

          <Stack gap="md" className={classes.sideRail}>
            <Card withBorder radius="lg" p="xl">
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Feed composition
              </Text>
              <Title order={3} mt={6}>
                {typeCount} active {typeCount === 1 ? 'type' : 'types'}
              </Title>
              {typeSummary.length > 0 ? (
                <Stack gap={8} mt="md">
                  {typeSummary.map(([type, count]) => (
                    <Group key={type} justify="space-between" gap="sm">
                      <Badge color={typeColor(type)} variant="light">
                        {formatTypeLabel(type)}
                      </Badge>
                      <Text size="sm" fw={750}>{count}</Text>
                    </Group>
                  ))}
                </Stack>
              ) : (
                <Text size="sm" c="dimmed" mt="xs">No categories recorded.</Text>
              )}
              <Button component="a" href="/settings" variant="light" fullWidth mt="lg">
                Notification settings
              </Button>
            </Card>
          </Stack>
        </SimpleGrid>
      </Stack>
    </Container>
  );
}
