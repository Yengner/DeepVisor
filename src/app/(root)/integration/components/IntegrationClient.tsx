'use client';

import { useState } from 'react';
import type { CSSProperties } from 'react';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Container,
  Group,
  Image as MantineImage,
  LoadingOverlay,
  Menu,
  Modal,
  Paper,
  Progress,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconArrowUpRight,
  IconCheck,
  IconClock,
  IconLink,
  IconLock,
  IconRefresh,
  IconSettings,
  IconTrash,
} from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import MetaIntegrationFlow from '@/components/integrations/MetaIntegrationFlow';
import { getPlatformIcon } from '@/components/utils/utils';
import { formatRetryDelay } from '@/lib/shared';
import type { IntegrationStatus } from '@/lib/shared/types/integrations';
import styles from './IntegrationClient.module.css';

type Platform = {
  id: string;
  platformKey: string;
  platformName: string;
  description: string | null;
  fullDescription: string | null;
  strengths: string | null;
  weaknesses: string | null;
  imageUrl: string | null;
  status: IntegrationStatus;
  integrationId: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
  connectedAt: string | null;
  disconnectedAt: string | null;
  updatedAt: string | null;
};

type PlatformListProps = {
  platforms: Platform[];
};

type PlatformPalette = {
  accent: string;
  accentSoft: string;
  accentSurface: string;
  border: string;
  text: string;
};

const PLATFORM_IMAGE_BY_KEY: Record<string, string> = {
  meta: '/images/platforms/logo/meta.png',
  google: '/images/platforms/logo/google.png',
  tiktok: '/images/platforms/logo/tiktok.png',
};

const PLATFORM_PALETTE_BY_KEY: Record<string, PlatformPalette> = {
  meta: {
    accent: '#1877f2',
    accentSoft: 'rgba(24, 119, 242, 0.12)',
    accentSurface: 'rgba(24, 119, 242, 0.10)',
    border: 'rgba(24, 119, 242, 0.2)',
    text: '#154273',
  },
  google: {
    accent: '#34a853',
    accentSoft: 'rgba(52, 168, 83, 0.12)',
    accentSurface: 'rgba(52, 168, 83, 0.10)',
    border: 'rgba(52, 168, 83, 0.18)',
    text: '#24503a',
  },
  tiktok: {
    accent: '#fe2c55',
    accentSoft: 'rgba(254, 44, 85, 0.12)',
    accentSurface: 'rgba(254, 44, 85, 0.10)',
    border: 'rgba(254, 44, 85, 0.18)',
    text: '#5a2134',
  },
  default: {
    accent: '#2563eb',
    accentSoft: 'rgba(37, 99, 235, 0.12)',
    accentSurface: 'rgba(37, 99, 235, 0.10)',
    border: 'rgba(37, 99, 235, 0.18)',
    text: '#173868',
  },
};

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

function formatRelativeTime(value: string | null): string {
  if (!value) {
    return 'Not synced yet';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const deltaMs = Date.now() - date.getTime();
  if (!Number.isFinite(deltaMs) || deltaMs < 0) {
    return 'Recently updated';
  }

  const minutes = Math.round(deltaMs / (60 * 1000));
  if (minutes < 60) {
    return minutes <= 1 ? 'Just now' : `${minutes}m ago`;
  }

  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function isConnected(status: IntegrationStatus): boolean {
  return status === 'connected';
}

function needsAttention(status: IntegrationStatus): boolean {
  return status === 'error' || status === 'needs_reauth';
}

function getStatusColor(status: IntegrationStatus): 'green' | 'gray' | 'red' | 'yellow' {
  if (status === 'connected') return 'green';
  if (status === 'needs_reauth') return 'yellow';
  if (status === 'error') return 'red';
  return 'gray';
}

function getStatusLabel(status: IntegrationStatus): string {
  if (status === 'connected') return 'Connected';
  if (status === 'needs_reauth') return 'Reconnect needed';
  if (status === 'error') return 'Issue detected';
  return 'Not connected';
}

function getPlatformPalette(platformKey: string): PlatformPalette {
  return PLATFORM_PALETTE_BY_KEY[platformKey] ?? PLATFORM_PALETTE_BY_KEY.default;
}

function getPlatformImage(platform: Platform): string | null {
  return PLATFORM_IMAGE_BY_KEY[platform.platformKey] ?? platform.imageUrl ?? null;
}

function sortPlatforms(platforms: Platform[]): Platform[] {
  const order = ['meta', 'google', 'tiktok'];

  return [...platforms].sort((left, right) => {
    const leftConnected = isConnected(left.status) ? 1 : 0;
    const rightConnected = isConnected(right.status) ? 1 : 0;

    if (leftConnected !== rightConnected) {
      return rightConnected - leftConnected;
    }

    const leftAttention = needsAttention(left.status) ? 1 : 0;
    const rightAttention = needsAttention(right.status) ? 1 : 0;
    if (leftAttention !== rightAttention) {
      return rightAttention - leftAttention;
    }

    const leftOrder = order.indexOf(left.platformKey);
    const rightOrder = order.indexOf(right.platformKey);
    const safeLeft = leftOrder === -1 ? Number.MAX_SAFE_INTEGER : leftOrder;
    const safeRight = rightOrder === -1 ? Number.MAX_SAFE_INTEGER : rightOrder;

    if (safeLeft !== safeRight) {
      return safeLeft - safeRight;
    }

    return left.platformName.localeCompare(right.platformName);
  });
}

function getAvailabilityCopy(platform: Platform): string {
  if (isConnected(platform.status)) {
    return platform.lastSyncedAt
      ? `Last synced ${formatRelativeTime(platform.lastSyncedAt)}`
      : 'Connected and waiting for first sync';
  }

  if (platform.platformKey === 'meta') {
    return platform.status === 'error' || platform.status === 'needs_reauth'
      ? 'Reconnect Meta to restore syncing.'
      : 'Available to connect now.';
  }

  return 'Preview channel for future integrations.';
}

function SummaryCard({
  label,
  title,
  detail,
  accent,
}: {
  label: string;
  title: string;
  detail: string;
  accent: string;
}) {
  return (
    <Paper withBorder radius="xl" p="lg" className={styles.summaryCard}>
      <div className={styles.summaryAccent} style={{ backgroundColor: accent }} />
      <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
        {label}
      </Text>
      <Title order={3} mt={8}>
        {title}
      </Title>
      <Text size="sm" c="dimmed" mt={6}>
        {detail}
      </Text>
    </Paper>
  );
}

function ChannelArtwork({
  platform,
  size = 120,
}: {
  platform: Platform;
  size?: number;
}) {
  const src = getPlatformImage(platform);

  if (!src) {
    return (
      <ThemeIcon
        size={size}
        radius="xl"
        variant="light"
        color={getStatusColor(platform.status)}
      >
        {getPlatformIcon(platform.platformKey, Math.round(size * 0.48), 1.5)}
      </ThemeIcon>
    );
  }

  return (
    <MantineImage
      src={src}
      alt={platform.platformName}
      w={size}
      h={size}
      fit="contain"
      className={styles.platformArtwork}
    />
  );
}

export default function IntegrationClient({ platforms }: PlatformListProps) {
  const [disconnectingPlatformId, setDisconnectingPlatformId] = useState<string | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const sortedPlatforms = sortPlatforms(platforms);
  const connectedPlatforms = sortedPlatforms.filter((platform) => isConnected(platform.status));
  const attentionPlatforms = sortedPlatforms.filter((platform) => needsAttention(platform.status));
  const latestSyncedPlatform = [...connectedPlatforms]
    .filter((platform) => platform.lastSyncedAt)
    .sort((left, right) => {
      const leftValue = new Date(left.lastSyncedAt ?? '').getTime();
      const rightValue = new Date(right.lastSyncedAt ?? '').getTime();
      return rightValue - leftValue;
    })[0] ?? null;

  const syncCoverage = sortedPlatforms.length > 0
    ? Math.round((connectedPlatforms.length / sortedPlatforms.length) * 100)
    : 0;

  const handleDisconnect = async (platform: Platform) => {
    if (!confirm(`Disconnect ${platform.platformName}?`)) {
      return;
    }

    if (!platform.integrationId) {
      toast.error('No integration found for this platform.');
      return;
    }

    setDisconnectingPlatformId(platform.id);
    try {
      const response = await fetch('/api/integrations/disconnect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ integrationId: platform.integrationId }),
      });

      if (!response.ok) {
        throw new Error('Failed to disconnect integration');
      }

      toast.success(`${platform.platformName} disconnected successfully.`);
      router.refresh();
      setSelectedPlatform((current) => (current?.id === platform.id ? null : current));
    } catch (error) {
      console.error(`Error disconnecting ${platform.platformName}:`, error);
      toast.error(`Failed to disconnect ${platform.platformName}. Please try again.`);
    } finally {
      setDisconnectingPlatformId(null);
    }
  };

  const handleRefreshConnections = async () => {
    setRefreshing(true);
    try {
      const response = await fetch('/api/sync/refresh', {
        method: 'POST',
      });
      const result = (await response.json()) as {
        success?: boolean;
        message?: string;
        retryAfterMs?: number;
      };

      if (!response.ok || !result.success) {
        if (response.status === 429) {
          throw new Error(result.message || formatRetryDelay(result.retryAfterMs));
        }

        throw new Error(result.message || 'Failed to refresh sync');
      }

      toast.success(result.message || 'Sync completed successfully.');
      router.refresh();
    } catch (error) {
      console.error('Error refreshing connections:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to refresh sync.');
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <MetaIntegrationFlow returnTo="/integration">
      {({ connectMeta, connecting }) => (
        <Container size="xl" pos="relative" pb="xl">
          <LoadingOverlay
            visible={refreshing}
            zIndex={1000}
            overlayProps={{ radius: 'sm', blur: 2 }}
          />

          <Stack gap="xl">
            <Card withBorder radius="xl" p="xl" className={`${styles.heroCard} app-platform-page-hero`}>
              <div className={styles.heroGlowLeft} />
              <div className={styles.heroGlowRight} />
              <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="xl">
                <Stack gap="md" className={styles.heroContent}>
                  <Group gap="xs" wrap="wrap">
                    <Badge variant="light" className="app-platform-page-badge">
                      Integrations
                    </Badge>
                    <Badge color="gray" variant="outline">
                      One primary ad account per platform
                    </Badge>
                  </Group>

                  <div>
                    <Title order={2}>Connect each ad channel once, then let DeepVisor run from it.</Title>
                    <Text size="md" c="dimmed" mt="sm" maw={680}>
                      Pick the platform, choose the one ad account DeepVisor should watch, and see
                      which channels are live, preview-only, or need attention before reports,
                      dashboard, and calendar work depend on them.
                    </Text>
                  </div>

                  <Group gap="sm" wrap="wrap">
                    <Button
                      leftSection={<IconRefresh size={16} />}
                      onClick={handleRefreshConnections}
                      loading={refreshing}
                      radius="xl"
                    >
                      Sync connected channels
                    </Button>
                    <Button
                      leftSection={<IconLink size={16} />}
                      variant="light"
                      radius="xl"
                      onClick={connectMeta}
                      loading={connecting}
                    >
                      Connect Meta now
                    </Button>
                  </Group>

                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                    <SummaryCard
                      label="Connected"
                      title={String(connectedPlatforms.length)}
                      detail={`${sortedPlatforms.length} total channels in your workspace`}
                      accent="#1877f2"
                    />
                    <SummaryCard
                      label="Needs Attention"
                      title={String(attentionPlatforms.length)}
                      detail={
                        attentionPlatforms.length > 0
                          ? 'At least one channel needs review or reconnect.'
                          : 'No reconnect or error states right now.'
                      }
                      accent="#f59e0b"
                    />
                    <SummaryCard
                      label="Latest Sync"
                      title={
                        latestSyncedPlatform
                          ? latestSyncedPlatform.platformName
                          : 'No completed sync'
                      }
                      detail={
                        latestSyncedPlatform
                          ? formatRelativeTime(latestSyncedPlatform.lastSyncedAt)
                          : 'Connect a platform to start pulling data.'
                      }
                      accent="#10b981"
                    />
                    <SummaryCard
                      label="Primary Scope"
                      title="1 account / platform"
                      detail="Keeps reporting, recommendations, and queueing focused on one clean dataset."
                      accent="#64748b"
                    />
                  </SimpleGrid>
                </Stack>

                <Paper withBorder radius="xl" p="lg" className={`${styles.heroSidebar} app-platform-page-hero-panel`}>
                  <Group justify="space-between" align="flex-start" mb="md">
                    <div>
                      <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                        Channel status
                      </Text>
                      <Title order={4} mt={4}>
                        Current connection map
                      </Title>
                    </div>
                    <Badge color={syncCoverage > 0 ? 'blue' : 'gray'} variant="light">
                      {syncCoverage}%
                    </Badge>
                  </Group>

                  <Progress value={syncCoverage} size="lg" radius="xl" color="blue" />

                  <Stack gap="sm" mt="lg">
                    {sortedPlatforms.map((platform) => {
                      const palette = getPlatformPalette(platform.platformKey);

                      return (
                        <Paper
                          key={platform.id}
                          withBorder
                          radius="lg"
                          p="sm"
                          className={styles.statusRow}
                          style={{ borderColor: palette.border } as CSSProperties}
                        >
                          <Group justify="space-between" align="center" wrap="nowrap" gap="sm">
                            <Group gap="sm" wrap="nowrap">
                              <ThemeIcon
                                size="lg"
                                radius="xl"
                                variant="light"
                                style={{
                                  backgroundColor: palette.accentSoft,
                                  color: palette.accent,
                                }}
                              >
                                {getPlatformIcon(platform.platformKey, 18, 1.5)}
                              </ThemeIcon>
                              <div style={{ minWidth: 0 }}>
                                <Text fw={700} size="sm" lineClamp={1}>
                                  {platform.platformName}
                                </Text>
                                <Text size="xs" c="dimmed" lineClamp={1}>
                                  {getAvailabilityCopy(platform)}
                                </Text>
                              </div>
                            </Group>

                            <Badge
                              size="sm"
                              color={getStatusColor(platform.status)}
                              variant={isConnected(platform.status) ? 'light' : 'outline'}
                            >
                              {getStatusLabel(platform.status)}
                            </Badge>
                          </Group>
                        </Paper>
                      );
                    })}
                  </Stack>
                </Paper>
              </SimpleGrid>
            </Card>

            <Paper withBorder radius="xl" p="xl" className={styles.guideCard}>
              <Group justify="space-between" align="flex-start" mb="lg" wrap="wrap">
                <div>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                    Setup Flow
                  </Text>
                  <Title order={3} mt={4}>
                    How channel setup works in DeepVisor
                  </Title>
                </div>
                <Badge color="gray" variant="light">
                  Built for simple account scope
                </Badge>
              </Group>

              <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
                <Paper withBorder radius="lg" p="md" className={styles.stepCard}>
                  <ThemeIcon size="xl" radius="xl" variant="light" color="blue">
                    <IconLink size={20} />
                  </ThemeIcon>
                  <Text fw={700} mt="md">
                    1. Connect a platform
                  </Text>
                  <Text size="sm" c="dimmed" mt={6}>
                    Start with Meta today. Other channels stay visible as preview cards so the
                    product direction remains clear.
                  </Text>
                </Paper>

                <Paper withBorder radius="lg" p="md" className={styles.stepCard}>
                  <ThemeIcon size="xl" radius="xl" variant="light" color="violet">
                    <IconLock size={20} />
                  </ThemeIcon>
                  <Text fw={700} mt="md">
                    2. Choose one primary ad account
                  </Text>
                  <Text size="sm" c="dimmed" mt={6}>
                    Each platform syncs one clean account into Dashboard, Reports, Calendar, and the
                    assistant so the workspace stays focused.
                  </Text>
                </Paper>

                <Paper withBorder radius="lg" p="md" className={styles.stepCard}>
                  <ThemeIcon size="xl" radius="xl" variant="light" color="teal">
                    <IconArrowUpRight size={20} />
                  </ThemeIcon>
                  <Text fw={700} mt="md">
                    3. DeepVisor keeps data flowing
                  </Text>
                  <Text size="sm" c="dimmed" mt={6}>
                    Once connected, sync keeps performance data, recommendations, and queued work
                    aligned across the rest of the app.
                  </Text>
                </Paper>
              </SimpleGrid>
            </Paper>

            <div>
              <Group justify="space-between" align="flex-end" mb="md" wrap="wrap">
                <div>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                    Channel Directory
                  </Text>
                  <Title order={3} mt={4}>
                    Connect, inspect, and manage each advertising platform
                  </Title>
                  <Text size="sm" c="dimmed" mt={4}>
                    Connected channels surface health and sync timing. Preview channels show how the
                    workspace can expand next.
                  </Text>
                </div>
                <Badge color="gray" variant="light">
                  {sortedPlatforms.length} platforms
                </Badge>
              </Group>

              <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }} spacing="lg">
                {sortedPlatforms.map((platform) => {
                  const palette = getPlatformPalette(platform.platformKey);
                  const artwork = getPlatformImage(platform);
                  const disconnected = !isConnected(platform.status);
                  const canConnectNow = platform.platformKey === 'meta' && disconnected;
                  const canManageLive = Boolean(platform.integrationId) && isConnected(platform.status);
                  const platformError = platform.lastError;
                  const disconnecting = disconnectingPlatformId === platform.id;

                  return (
                    <Card
                      key={platform.id}
                      withBorder
                      radius="xl"
                      p={0}
                      className={styles.channelCard}
                    >
                      <Card.Section
                        className={styles.channelVisual}
                        style={{
                          background: palette.accentSurface,
                          borderBottom: `1px solid ${palette.border}`,
                        }}
                      >
                        <Group justify="space-between" align="flex-start" mb="xl">
                          <Badge
                            className={styles.channelStatusBadge}
                            color={getStatusColor(platform.status)}
                            variant={isConnected(platform.status) ? 'light' : 'outline'}
                            leftSection={
                              isConnected(platform.status) ? (
                                <IconCheck size={12} />
                              ) : needsAttention(platform.status) ? (
                                <IconAlertTriangle size={12} />
                              ) : undefined
                            }
                          >
                            {getStatusLabel(platform.status)}
                          </Badge>

                          <ThemeIcon
                            size="xl"
                            radius="xl"
                            variant="white"
                            style={{ color: palette.accent }}
                          >
                            {getPlatformIcon(platform.platformKey, 22, 1.6)}
                          </ThemeIcon>
                        </Group>

                        <div className={styles.channelArtworkStage}>
                          <div
                            className={styles.channelGlowPrimary}
                            style={{ backgroundColor: palette.accentSoft }}
                          />
                          <div
                            className={styles.channelGlowSecondary}
                            style={{ backgroundColor: palette.accentSoft }}
                          />
                          <div className={styles.channelArtworkShadow} />
                          <div className={styles.channelArtworkWrap}>
                            {artwork ? (
                              <ChannelArtwork platform={platform} size={112} />
                            ) : null}
                          </div>
                        </div>
                      </Card.Section>

                      <Stack gap="md" p="lg" style={{ flex: 1 }}>
                        <div>
                          <Group gap="xs" wrap="wrap" mb={6}>
                            <Text fw={700} size="lg" style={{ color: palette.text }}>
                              {platform.platformName}
                            </Text>
                            {!platform.integrationId && platform.platformKey !== 'meta' ? (
                              <Badge color="gray" variant="light">
                                Preview
                              </Badge>
                            ) : null}
                          </Group>
                          <Text size="sm" c="dimmed">
                            {platform.description || platform.fullDescription || 'No description available yet.'}
                          </Text>
                        </div>

                        <SimpleGrid cols={2} spacing="sm">
                          <Paper withBorder radius="lg" p="sm" className={styles.metricCard}>
                            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                              Sync state
                            </Text>
                            <Text fw={700} mt={4}>
                              {formatRelativeTime(platform.lastSyncedAt)}
                            </Text>
                          </Paper>
                          <Paper withBorder radius="lg" p="sm" className={styles.metricCard}>
                            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                              Account rule
                            </Text>
                            <Text fw={700} mt={4}>
                              1 primary account
                            </Text>
                          </Paper>
                        </SimpleGrid>

                        {platformError ? (
                          <Alert
                            color="red"
                            radius="lg"
                            variant="light"
                            icon={<IconAlertTriangle size={16} />}
                          >
                            {platformError}
                          </Alert>
                        ) : null}

                        <Paper
                          withBorder
                          radius="lg"
                          p="sm"
                          className={styles.copyPanel}
                          style={{
                            borderColor: palette.border,
                            backgroundColor: palette.accentSoft,
                          }}
                        >
                          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                            What this channel is good at
                          </Text>
                          <Text size="sm" mt={6}>
                            {platform.strengths || platform.description || 'No strengths summary yet.'}
                          </Text>
                        </Paper>

                        <Group justify="space-between" align="center" mt="auto" wrap="wrap">
                          <Group gap="xs" wrap="wrap">
                            {canManageLive ? (
                              <Button
                                leftSection={<IconRefresh size={16} />}
                                variant="light"
                                onClick={handleRefreshConnections}
                                loading={refreshing}
                              >
                                Refresh data
                              </Button>
                            ) : canConnectNow ? (
                              <Button
                                leftSection={<IconLink size={16} />}
                                onClick={connectMeta}
                                loading={connecting}
                              >
                                {needsAttention(platform.status) ? 'Reconnect Meta' : 'Connect Meta'}
                              </Button>
                            ) : (
                              <Button
                                leftSection={<IconLock size={16} />}
                                variant="light"
                                color="gray"
                                disabled
                              >
                                Preview only
                              </Button>
                            )}

                            <Button
                              variant="default"
                              onClick={() => setSelectedPlatform(platform)}
                            >
                              Details
                            </Button>
                          </Group>

                          {platform.integrationId ? (
                            <Menu shadow="md" position="bottom-end">
                              <Menu.Target>
                                <ActionIcon variant="default" radius="xl" size="lg">
                                  <IconSettings size={16} />
                                </ActionIcon>
                              </Menu.Target>
                              <Menu.Dropdown>
                                <Menu.Label>{platform.platformName}</Menu.Label>
                                <Menu.Item onClick={() => setSelectedPlatform(platform)}>
                                  View details
                                </Menu.Item>
                                <Menu.Divider />
                                <Menu.Item
                                  color="red"
                                  leftSection={<IconTrash size={14} />}
                                  onClick={() => handleDisconnect(platform)}
                                  disabled={disconnecting}
                                >
                                  {disconnecting ? 'Disconnecting...' : 'Disconnect'}
                                </Menu.Item>
                              </Menu.Dropdown>
                            </Menu>
                          ) : null}
                        </Group>
                      </Stack>
                    </Card>
                  );
                })}
              </SimpleGrid>
            </div>

            <Modal
              opened={Boolean(selectedPlatform)}
              onClose={() => setSelectedPlatform(null)}
              size="lg"
              withCloseButton={false}
              centered
            >
              {selectedPlatform ? (
                (() => {
                  const palette = getPlatformPalette(selectedPlatform.platformKey);
                  const disconnecting = disconnectingPlatformId === selectedPlatform.id;
                  const connected = isConnected(selectedPlatform.status);
                  const canConnectNow = selectedPlatform.platformKey === 'meta' && !connected;

                  return (
                    <Stack gap="lg">
                      <Paper
                        withBorder
                        radius="xl"
                        p="xl"
                        className={styles.detailHero}
                        style={{
                          background: palette.accentSurface,
                          borderColor: palette.border,
                        }}
                      >
                        <Group justify="space-between" align="flex-start" wrap="wrap" gap="md">
                          <Group gap="md" wrap="nowrap" align="flex-start">
                            <ChannelArtwork platform={selectedPlatform} size={96} />
                            <div>
                              <Group gap="xs" wrap="wrap" mb={8}>
                                <Text fw={700} size="xl" style={{ color: palette.text }}>
                                  {selectedPlatform.platformName}
                                </Text>
                                <Badge
                                  color={getStatusColor(selectedPlatform.status)}
                                  variant={connected ? 'light' : 'outline'}
                                >
                                  {getStatusLabel(selectedPlatform.status)}
                                </Badge>
                              </Group>
                              <Text size="sm" maw={460}>
                                {selectedPlatform.fullDescription ||
                                  selectedPlatform.description ||
                                  'No detailed description available yet.'}
                              </Text>
                            </div>
                          </Group>

                          <Button variant="subtle" onClick={() => setSelectedPlatform(null)}>
                            Close
                          </Button>
                        </Group>
                      </Paper>

                      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                        <Paper withBorder radius="lg" p="md" className={styles.metricCard}>
                          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                            Connected on
                          </Text>
                          <Text fw={700} mt={4}>
                            {formatDateTime(selectedPlatform.connectedAt)}
                          </Text>
                        </Paper>

                        <Paper withBorder radius="lg" p="md" className={styles.metricCard}>
                          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                            Last sync
                          </Text>
                          <Text fw={700} mt={4}>
                            {formatDateTime(selectedPlatform.lastSyncedAt)}
                          </Text>
                        </Paper>

                        <Paper withBorder radius="lg" p="md" className={styles.metricCard}>
                          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                            Current status
                          </Text>
                          <Text fw={700} mt={4}>
                            {getStatusLabel(selectedPlatform.status)}
                          </Text>
                        </Paper>

                        <Paper withBorder radius="lg" p="md" className={styles.metricCard}>
                          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                            Last updated
                          </Text>
                          <Text fw={700} mt={4}>
                            {formatDateTime(selectedPlatform.updatedAt)}
                          </Text>
                        </Paper>

                        <Paper withBorder radius="lg" p="md" className={styles.metricCard}>
                          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                            Sync rule
                          </Text>
                          <Text fw={700} mt={4}>
                            One primary ad account
                          </Text>
                        </Paper>

                        <Paper withBorder radius="lg" p="md" className={styles.metricCard}>
                          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                            Channel readiness
                          </Text>
                          <Text fw={700} mt={4}>
                            {getAvailabilityCopy(selectedPlatform)}
                          </Text>
                        </Paper>
                      </SimpleGrid>

                      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                        <Paper withBorder radius="lg" p="md">
                          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                            Strengths
                          </Text>
                          <Text size="sm" mt="sm">
                            {selectedPlatform.strengths ||
                              'Strengths summary is not available yet for this platform.'}
                          </Text>
                        </Paper>

                        <Paper withBorder radius="lg" p="md">
                          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                            Watchouts
                          </Text>
                          <Text size="sm" mt="sm">
                            {selectedPlatform.weaknesses ||
                              'Known limitations are not available yet for this platform.'}
                          </Text>
                        </Paper>
                      </SimpleGrid>

                      {selectedPlatform.lastError ? (
                        <Alert
                          color="red"
                          radius="lg"
                          variant="light"
                          icon={<IconAlertTriangle size={16} />}
                        >
                          {selectedPlatform.lastError}
                        </Alert>
                      ) : null}

                      <Group justify="space-between" align="center" wrap="wrap">
                        <Group gap="sm" wrap="wrap">
                          {connected ? (
                            <>
                              <Button
                                leftSection={<IconRefresh size={16} />}
                                variant="light"
                                onClick={handleRefreshConnections}
                                loading={refreshing}
                              >
                                Refresh data
                              </Button>
                              <Button
                                color="red"
                                variant="light"
                                leftSection={<IconTrash size={16} />}
                                onClick={() => handleDisconnect(selectedPlatform)}
                                loading={disconnecting}
                              >
                                Disconnect
                              </Button>
                            </>
                          ) : canConnectNow ? (
                            <Button
                              leftSection={<IconLink size={16} />}
                              onClick={connectMeta}
                              loading={connecting}
                            >
                              {needsAttention(selectedPlatform.status) ? 'Reconnect Meta' : 'Connect Meta'}
                            </Button>
                          ) : (
                            <Button
                              leftSection={<IconLock size={16} />}
                              variant="light"
                              color="gray"
                              disabled
                            >
                              Preview only
                            </Button>
                          )}
                        </Group>

                        <Group gap={8}>
                          <ThemeIcon color="gray" variant="light" radius="xl">
                            <IconClock size={16} />
                          </ThemeIcon>
                          <Text size="sm" c="dimmed">
                            {getAvailabilityCopy(selectedPlatform)}
                          </Text>
                        </Group>
                      </Group>
                    </Stack>
                  );
                })()
              ) : null}
            </Modal>
          </Stack>
        </Container>
      )}
    </MetaIntegrationFlow>
  );
}
