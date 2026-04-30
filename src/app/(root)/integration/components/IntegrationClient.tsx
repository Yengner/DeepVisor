'use client';

import { useEffect, useMemo, useState } from 'react';
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
  Select,
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
import {
  clearPitchDetachedPlatform,
  readPitchDetachedPlatforms,
  upsertPitchDetachedPlatform,
  type PitchDetachedPlatform,
} from '@/components/integrations/pitchDetach';
import { getPlatformIcon } from '@/components/utils/utils';
import {
  formatDateTime,
  formatRelativeTime,
  formatRetryDelay,
  getIntegrationAvailabilityCopy,
  getIntegrationPlatformImage,
  getIntegrationPlatformPalette,
  getIntegrationStatusColor,
  getIntegrationStatusLabel,
  integrationNeedsAttention,
  isIntegrationConnected,
  sortIntegrationPlatforms,
} from '@/lib/shared';
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
  primaryAdAccountExternalId: string | null;
  primaryAdAccountName: string | null;
  discoveredAdAccountCount: number;
};

type DisplayPlatform = Platform & {
  pitchDetached: boolean;
};

type PlatformListProps = {
  platforms: Platform[];
};

type MetaAccountOption = {
  value: string;
  label: string;
};

type MetaAccountListResponse = {
  success?: boolean;
  data?: {
    accounts?: Array<{ externalAccountId: string; name: string | null; status: string | null }>;
    primaryAdAccountExternalId?: string | null;
  };
  error?: {
    userMessage?: string;
  };
};

type MetaSelectResponse = {
  success?: boolean;
  data?: {
    firstSyncJob?: { jobId?: string } | null;
  };
  error?: {
    userMessage?: string;
  };
};

/**
 * Shared summary card used in the integrations page hero for workspace-level counts and status.
 */
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

/**
 * Renders either branded platform artwork or a platform icon fallback when no image is available.
 */
function ChannelArtwork({
  platform,
  size = 120,
}: {
  platform: Platform;
  size?: number;
}) {
  const src = getIntegrationPlatformImage(platform.platformKey, platform.imageUrl);

  if (!src) {
    return (
      <ThemeIcon
        size={size}
        radius="xl"
        variant="light"
        color={getIntegrationStatusColor(platform.status)}
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
  const [selectedPlatform, setSelectedPlatform] = useState<DisplayPlatform | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [focusedPlatformId, setFocusedPlatformId] = useState<string | null>(null);
  const [accountSelectionPlatform, setAccountSelectionPlatform] = useState<Platform | null>(null);
  const [accountOptions, setAccountOptions] = useState<MetaAccountOption[]>([]);
  const [selectedAccountExternalId, setSelectedAccountExternalId] = useState<string | null>(null);
  const [loadingAccountOptions, setLoadingAccountOptions] = useState(false);
  const [submittingAccountSelection, setSubmittingAccountSelection] = useState(false);
  const [pitchDetachedPlatforms, setPitchDetachedPlatforms] = useState<PitchDetachedPlatform[]>([]);
  const router = useRouter();

  useEffect(() => {
    const syncPitchDetachedPlatforms = () => {
      setPitchDetachedPlatforms(readPitchDetachedPlatforms());
    };

    syncPitchDetachedPlatforms();
    window.addEventListener('storage', syncPitchDetachedPlatforms);

    return () => {
      window.removeEventListener('storage', syncPitchDetachedPlatforms);
    };
  }, []);

  const pitchDetachedByPlatformId = useMemo(
    () => new Map(pitchDetachedPlatforms.map((platform) => [platform.platformId, platform])),
    [pitchDetachedPlatforms]
  );

  const sortedPlatforms = sortIntegrationPlatforms(
    platforms.map((platform) => {
      const detached = pitchDetachedByPlatformId.has(platform.id);

      return {
        ...platform,
        status: detached ? 'disconnected' : platform.status,
        lastError: detached ? null : platform.lastError,
        pitchDetached: detached,
      } satisfies DisplayPlatform;
    })
  );
  const connectedPlatforms = sortedPlatforms.filter((platform) => isIntegrationConnected(platform.status));
  const attentionPlatforms = sortedPlatforms.filter((platform) => integrationNeedsAttention(platform.status));
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
  const focusedPlatform =
    sortedPlatforms.find((platform) => platform.id === focusedPlatformId) ??
    connectedPlatforms[0] ??
    sortedPlatforms[0] ??
    null;
  const focusedPalette = getIntegrationPlatformPalette(focusedPlatform?.platformKey ?? 'default');
  const focusedPlatformConnected = focusedPlatform
    ? isIntegrationConnected(focusedPlatform.status)
    : false;
  const focusedPlatformPitchDetached = Boolean(focusedPlatform?.pitchDetached);
  const focusedPlatformNeedsAttention = focusedPlatform
    ? integrationNeedsAttention(focusedPlatform.status)
    : false;
  const focusedPlatformPreviewOnly = Boolean(focusedPlatform) &&
    !focusedPlatformConnected &&
    focusedPlatform?.platformKey !== 'meta';
  const focusedHeroTitle = !focusedPlatform
    ? 'Connect each ad channel once, then let DeepVisor run from it.'
    : focusedPlatformPitchDetached
      ? `Reconnect ${focusedPlatform.platformName} and reattach saved workspace data.`
    : focusedPlatformConnected
      ? `${focusedPlatform.platformName} is connected and driving this workspace.`
      : `Connect ${focusedPlatform.platformName}`;
  const focusedHeroDescription = !focusedPlatform
    ? 'Pick the platform, choose the one ad account DeepVisor should watch, and see which channels are live, preview-only, or need attention before reports, dashboard, and calendar work depend on them.'
    : focusedPlatformPitchDetached
      ? `This pitch-safe detach keeps the synced workspace data intact while making ${focusedPlatform.platformName} look disconnected here. Reconnect to replay the Meta connection story without rebuilding the workspace.`
    : focusedPlatformConnected
      ? `${focusedPlatform.platformName} is already live in DeepVisor. Keep its sync current, manage its primary ad account, and use this as the clean channel source for dashboard, reports, and calendar work.`
      : focusedPlatform.platformKey === 'meta'
        ? 'Authorize Meta, choose the one ad account DeepVisor should watch, and start feeding reporting, calendar, and recommendations from a single clean source.'
        : `${focusedPlatform.platformName} is still a preview channel. Its connection pattern is visible here so you can plan how it will slot into the workspace once support is enabled.`;
  const focusedPrimaryLabel = !focusedPlatform
    ? 'Sync connected channels'
    : focusedPlatformPitchDetached
      ? `Reconnect ${focusedPlatform.platformName}`
    : focusedPlatformConnected
      ? `Sync ${focusedPlatform.platformName}`
      : focusedPlatformNeedsAttention
        ? `Reconnect ${focusedPlatform.platformName}`
        : `Connect ${focusedPlatform.platformName}`;
  const focusedPrimaryDisabled = !focusedPlatform || focusedPlatformPreviewOnly;
  const heroCardStyle = {
    background: `linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, ${focusedPalette.accentSurface} 100%)`,
    borderColor: focusedPalette.border,
  } satisfies CSSProperties;

  const syncPitchDetachedState = () => {
    setPitchDetachedPlatforms(readPitchDetachedPlatforms());
  };

  const handlePitchDetach = (platform: Platform) => {
    if (platform.platformKey !== 'meta' || !platform.integrationId) {
      toast.error('Pitch detach is currently set up for Meta only.');
      return;
    }

    if (!confirm(`Pitch-detach ${platform.platformName}? This will not delete any synced data.`)) {
      return;
    }

    upsertPitchDetachedPlatform({
      platformId: platform.id,
      platformKey: platform.platformKey,
      platformName: platform.platformName,
      integrationId: platform.integrationId,
      primaryAdAccountExternalId: platform.primaryAdAccountExternalId,
      primaryAdAccountName: platform.primaryAdAccountName,
      detachedAt: new Date().toISOString(),
    });
    syncPitchDetachedState();
    toast.success('Meta detached for the pitch. Synced data is preserved.');
  };

  useEffect(() => {
    if (!selectedPlatform) {
      return;
    }

    const nextSelectedPlatform = sortedPlatforms.find((platform) => platform.id === selectedPlatform.id) ?? null;

    if (
      nextSelectedPlatform &&
      (
        nextSelectedPlatform.status !== selectedPlatform.status ||
        nextSelectedPlatform.pitchDetached !== selectedPlatform.pitchDetached ||
        nextSelectedPlatform.primaryAdAccountExternalId !== selectedPlatform.primaryAdAccountExternalId ||
        nextSelectedPlatform.primaryAdAccountName !== selectedPlatform.primaryAdAccountName
      )
    ) {
      setSelectedPlatform(nextSelectedPlatform);
    }
  }, [selectedPlatform, sortedPlatforms]);

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

  const handleOpenAccountSelection = async (platform: Platform) => {
    if (platform.platformKey !== 'meta' || !platform.integrationId) {
      return;
    }

    setSelectedPlatform(null);
    setAccountSelectionPlatform(platform);
    setAccountOptions([]);
    setSelectedAccountExternalId(platform.primaryAdAccountExternalId);
    setLoadingAccountOptions(true);

    try {
      const response = await fetch(
        `/api/integrations/meta/ad-accounts?integrationId=${platform.integrationId}`
      );
      const body = (await response.json().catch(() => ({}))) as MetaAccountListResponse;

      if (!response.ok || !body?.success) {
        throw new Error(body?.error?.userMessage || 'Failed to load Meta ad accounts');
      }

      const options = Array.isArray(body.data?.accounts)
        ? body.data.accounts.map((account) => ({
            value: account.externalAccountId,
            label: account.name || account.externalAccountId,
          }))
        : [];

      setAccountOptions(options);
      setSelectedAccountExternalId(
        body.data?.primaryAdAccountExternalId ??
          platform.primaryAdAccountExternalId ??
          options[0]?.value ??
          null
      );
    } catch (error) {
      console.error('Error loading Meta ad accounts:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to load Meta ad accounts.');
      setAccountSelectionPlatform(null);
    } finally {
      setLoadingAccountOptions(false);
    }
  };

  const handleSelectAdAccount = async () => {
    if (
      !accountSelectionPlatform?.integrationId ||
      !selectedAccountExternalId ||
      submittingAccountSelection
    ) {
      return;
    }

    setSubmittingAccountSelection(true);

    try {
      const response = await fetch('/api/integrations/meta/select-ad-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          integrationId: accountSelectionPlatform.integrationId,
          externalAccountId: selectedAccountExternalId,
        }),
      });
      const body = (await response.json().catch(() => ({}))) as MetaSelectResponse;

      if (!response.ok || !body?.success) {
        throw new Error(body?.error?.userMessage || 'Failed to change Meta ad account');
      }

      toast.success(
        body.data?.firstSyncJob
          ? 'Primary Meta ad account changed. Full history sync started.'
          : 'Primary Meta ad account changed and sync started.'
      );
      setAccountSelectionPlatform(null);
      router.refresh();
    } catch (error) {
      console.error('Error selecting Meta ad account:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to change Meta ad account.');
    } finally {
      setSubmittingAccountSelection(false);
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
            <Card
              withBorder
              radius="xl"
              p="xl"
              className={`${styles.heroCard} app-platform-page-hero`}
              style={heroCardStyle}
            >
              <div
                className={styles.heroGlowLeft}
                style={{ background: focusedPalette.accentSurface } as CSSProperties}
              />
              <div
                className={styles.heroGlowRight}
                style={{ background: focusedPalette.accentSoft } as CSSProperties}
              />
              <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="xl">
                <Stack gap="md" className={styles.heroContent}>
                  <Group gap="xs" wrap="wrap">
                    <Badge variant="light" className="app-platform-page-badge">
                      Integrations
                    </Badge>
                    {focusedPlatform ? (
                      <Badge
                        variant="light"
                        style={{
                          backgroundColor: focusedPalette.accentSoft,
                          color: focusedPalette.text,
                        }}
                        >
                          {focusedPlatform.platformName}
                        </Badge>
                    ) : null}
                    {focusedPlatformPitchDetached ? (
                      <Badge color="violet" variant="light">
                        Pitch detached
                      </Badge>
                    ) : null}
                  </Group>

                  <div>
                    <Title order={2} style={{ color: focusedPalette.text }}>
                      {focusedHeroTitle}
                    </Title>
                    <Text size="md" c="dimmed" mt="sm" maw={680}>
                      {focusedHeroDescription}
                    </Text>
                  </div>

                  <Group gap="sm" wrap="wrap">
                    <Button
                      leftSection={
                        focusedPlatformConnected ? <IconRefresh size={16} /> : <IconLink size={16} />
                      }
                      onClick={() => {
                        if (!focusedPlatform) {
                          void handleRefreshConnections();
                          return;
                        }

                        if (focusedPlatformConnected) {
                          void handleRefreshConnections();
                          return;
                        }

                        if (focusedPlatform.platformKey === 'meta') {
                          void connectMeta();
                        }
                      }}
                      loading={
                        focusedPlatformConnected
                          ? refreshing
                          : focusedPlatform?.platformKey === 'meta'
                            ? connecting
                            : false
                      }
                      disabled={focusedPrimaryDisabled}
                      radius="xl"
                      style={
                        focusedPrimaryDisabled
                          ? undefined
                          : ({
                              backgroundColor: focusedPalette.accent,
                              color: '#ffffff',
                            } as CSSProperties)
                      }
                    >
                      {focusedPrimaryLabel}
                    </Button>
                    {focusedPlatformConnected && focusedPlatform?.platformKey === 'meta' ? (
                      <Button
                        leftSection={<IconSettings size={16} />}
                        variant="default"
                        radius="xl"
                        onClick={() => handlePitchDetach(focusedPlatform)}
                      >
                        Pitch detach
                      </Button>
                    ) : null}
                    {focusedPlatform ? (
                      <Button
                        leftSection={
                          focusedPlatformConnected &&
                          focusedPlatform.platformKey === 'meta' &&
                          focusedPlatform.discoveredAdAccountCount > 1
                            ? <IconSettings size={16} />
                            : <IconArrowUpRight size={16} />
                        }
                        variant="light"
                        radius="xl"
                        onClick={() => {
                          if (
                            focusedPlatform.platformKey === 'meta' &&
                            focusedPlatformConnected &&
                            focusedPlatform.discoveredAdAccountCount > 1
                          ) {
                            void handleOpenAccountSelection(focusedPlatform);
                            return;
                          }

                          setSelectedPlatform(focusedPlatform);
                        }}
                        style={{
                          backgroundColor: focusedPalette.accentSoft,
                          color: focusedPalette.text,
                        }}
                      >
                        {focusedPlatformConnected &&
                        focusedPlatform.platformKey === 'meta' &&
                        focusedPlatform.discoveredAdAccountCount > 1
                          ? 'Change ad account'
                          : `View ${focusedPlatform.platformName}`}
                      </Button>
                    ) : null}
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
                          ? formatRelativeTime(latestSyncedPlatform.lastSyncedAt, { emptyLabel: 'Not synced yet' })
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

                  <Progress
                    value={syncCoverage}
                    size="lg"
                    radius="xl"
                    color={focusedPalette.accent}
                  />
                  <Text size="xs" c="dimmed" mt="sm">
                    Select a channel to update the hero card and action state.
                  </Text>

                  <Stack gap="sm" mt="lg">
                    {sortedPlatforms.map((platform) => {
                      const palette = getIntegrationPlatformPalette(platform.platformKey);
                      const isFocused = focusedPlatform?.id === platform.id;

                      return (
                        <Paper
                          key={platform.id}
                          withBorder
                          radius="lg"
                          p="sm"
                          className={`${styles.statusRow} ${isFocused ? styles.statusRowActive : ''}`}
                          style={{
                            borderColor: isFocused ? palette.accent : palette.border,
                            background: isFocused ? palette.accentSurface : '#fff',
                            boxShadow: isFocused
                              ? `0 18px 36px ${palette.accentSoft}`
                              : undefined,
                          } as CSSProperties}
                          role="button"
                          tabIndex={0}
                          onClick={() => setFocusedPlatformId(platform.id)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              setFocusedPlatformId(platform.id);
                            }
                          }}
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
                                  {getIntegrationAvailabilityCopy(platform)}
                                </Text>
                              </div>
                            </Group>

                            <Badge
                              size="sm"
                              color={getIntegrationStatusColor(platform.status)}
                              variant={isIntegrationConnected(platform.status) ? 'light' : 'outline'}
                            >
                              {getIntegrationStatusLabel(platform.status)}
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
                  const palette = getIntegrationPlatformPalette(platform.platformKey);
                  const artwork = getIntegrationPlatformImage(platform.platformKey, platform.imageUrl);
                  const disconnected = !isIntegrationConnected(platform.status);
                  const canConnectNow = platform.platformKey === 'meta' && disconnected;
                  const canManageLive = Boolean(platform.integrationId) && isIntegrationConnected(platform.status);
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
                            color={getIntegrationStatusColor(platform.status)}
                            variant={isIntegrationConnected(platform.status) ? 'light' : 'outline'}
                            leftSection={
                              isIntegrationConnected(platform.status) ? (
                                <IconCheck size={12} />
                              ) : integrationNeedsAttention(platform.status) ? (
                                <IconAlertTriangle size={12} />
                              ) : undefined
                            }
                          >
                            {getIntegrationStatusLabel(platform.status)}
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
                              {formatRelativeTime(platform.lastSyncedAt, { emptyLabel: 'Not synced yet' })}
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
                              <>
                                <Button
                                  leftSection={<IconRefresh size={16} />}
                                  variant="light"
                                  onClick={handleRefreshConnections}
                                  loading={refreshing}
                                >
                                  Refresh data
                                </Button>
                                {platform.platformKey === 'meta' &&
                                platform.discoveredAdAccountCount > 1 ? (
                                  <Button
                                    variant="default"
                                    onClick={() => void handleOpenAccountSelection(platform)}
                                  >
                                    Change ad account
                                  </Button>
                                ) : null}
                                {platform.platformKey === 'meta' ? (
                                  <Button
                                    variant="default"
                                    onClick={() => handlePitchDetach(platform)}
                                  >
                                    Pitch detach
                                  </Button>
                                ) : null}
                              </>
                            ) : canConnectNow ? (
                              <Button
                                leftSection={<IconLink size={16} />}
                                onClick={() => {
                                  void connectMeta();
                                }}
                                loading={connecting}
                              >
                                {integrationNeedsAttention(platform.status) ? 'Reconnect Meta' : 'Connect Meta'}
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
                                {platform.platformKey === 'meta' && !platform.pitchDetached ? (
                                  <Menu.Item
                                    leftSection={<IconClock size={14} />}
                                    onClick={() => handlePitchDetach(platform)}
                                  >
                                    Pitch detach
                                  </Menu.Item>
                                ) : null}
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
              opened={Boolean(accountSelectionPlatform)}
              onClose={() => {
                if (!submittingAccountSelection) {
                  setAccountSelectionPlatform(null);
                }
              }}
              title="Change Meta ad account"
              centered
            >
              <Stack gap="md">
                <Text size="sm" c="dimmed">
                  Choose which discovered Meta ad account DeepVisor should watch next. Saving this
                  selection also starts sync for that account.
                </Text>

                <Select
                  label="Discovered Meta ad accounts"
                  placeholder={loadingAccountOptions ? 'Loading ad accounts...' : 'Select one ad account'}
                  data={accountOptions}
                  value={selectedAccountExternalId}
                  onChange={setSelectedAccountExternalId}
                  disabled={loadingAccountOptions || submittingAccountSelection}
                  searchable
                  nothingFoundMessage="No discovered ad accounts found"
                />

                {accountSelectionPlatform ? (
                  <Text size="sm" c="dimmed">
                    Current primary account:{' '}
                    {accountSelectionPlatform.primaryAdAccountName ||
                      accountSelectionPlatform.primaryAdAccountExternalId ||
                      'Not selected yet'}
                  </Text>
                ) : null}

                <Group justify="flex-end" gap="sm">
                  <Button
                    variant="default"
                    onClick={() => setAccountSelectionPlatform(null)}
                    disabled={submittingAccountSelection}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSelectAdAccount}
                    loading={submittingAccountSelection}
                    disabled={!selectedAccountExternalId || loadingAccountOptions}
                  >
                    Save and sync account
                  </Button>
                </Group>
              </Stack>
            </Modal>

            <Modal
              opened={Boolean(selectedPlatform)}
              onClose={() => setSelectedPlatform(null)}
              size="lg"
              withCloseButton={false}
              centered
            >
              {selectedPlatform ? (
                (() => {
                  const palette = getIntegrationPlatformPalette(selectedPlatform.platformKey);
                  const disconnecting = disconnectingPlatformId === selectedPlatform.id;
                  const connected = isIntegrationConnected(selectedPlatform.status);
                  const canConnectNow = selectedPlatform.platformKey === 'meta' && !connected;
                  const canChangeMetaAccount =
                    selectedPlatform.platformKey === 'meta' &&
                    connected &&
                    selectedPlatform.discoveredAdAccountCount > 1;

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
                                  color={getIntegrationStatusColor(selectedPlatform.status)}
                                  variant={connected ? 'light' : 'outline'}
                                >
                                  {getIntegrationStatusLabel(selectedPlatform.status)}
                                </Badge>
                                {selectedPlatform.pitchDetached ? (
                                  <Badge color="violet" variant="light">
                                    Pitch detached
                                  </Badge>
                                ) : null}
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
                            {getIntegrationStatusLabel(selectedPlatform.status)}
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
                            {getIntegrationAvailabilityCopy(selectedPlatform)}
                          </Text>
                        </Paper>
                      </SimpleGrid>

                      {selectedPlatform.platformKey === 'meta' && connected ? (
                        <div>
                          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                            Primary ad account
                          </Text>
                          <Group gap="xs" mt="sm" wrap="wrap">
                            <Button
                              radius="xl"
                              variant="default"
                              onClick={
                                canChangeMetaAccount
                                  ? () => void handleOpenAccountSelection(selectedPlatform)
                                  : undefined
                              }
                            >
                              {selectedPlatform.primaryAdAccountName ||
                                selectedPlatform.primaryAdAccountExternalId ||
                                'Not selected yet'}
                            </Button>
                            <Text size="sm" c="dimmed">
                              {selectedPlatform.discoveredAdAccountCount > 1
                                ? `${selectedPlatform.discoveredAdAccountCount} discovered ad accounts can be switched and synced from here.`
                                : selectedPlatform.discoveredAdAccountCount === 1
                                  ? 'Only one discovered ad account is currently available.'
                                  : 'No saved Meta ad accounts have been discovered yet.'}
                            </Text>
                          </Group>
                        </div>
                      ) : null}

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
                              {canChangeMetaAccount ? (
                                <Button
                                  variant="default"
                                  onClick={() => void handleOpenAccountSelection(selectedPlatform)}
                                >
                                  Change ad account
                                </Button>
                              ) : null}
                              {selectedPlatform.platformKey === 'meta' ? (
                                <Button
                                  variant="default"
                                  onClick={() => handlePitchDetach(selectedPlatform)}
                                >
                                  Pitch detach
                                </Button>
                              ) : null}
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
                              onClick={() => {
                                void connectMeta();
                              }}
                              loading={connecting}
                            >
                              {integrationNeedsAttention(selectedPlatform.status) ? 'Reconnect Meta' : 'Connect Meta'}
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
                            {getIntegrationAvailabilityCopy(selectedPlatform)}
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
