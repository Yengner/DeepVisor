'use client';
import { useLocale, useTranslations } from 'next-intl';
import DeleteMetaDataModal from './DeleteMetaDataModal';
import Disclosure from '@/components/product/Disclosure';
import product from '@/components/product/Product.module.css';
import StatusBadge from '@/components/product/StatusBadge';

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
  IconClock,
  IconLink,
  IconRefresh,
  IconSettings,
  IconTrash,
} from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import MetaIntegrationFlow from '@/components/integrations/MetaIntegrationFlow';
import { readPitchDetachedPlatforms, type PitchDetachedPlatform } from '@/components/integrations/pitchDetach';
import { getPlatformIcon } from '@/components/utils/utils';
import {
  getIntegrationPlatformImage,
  getIntegrationPlatformPalette,
  getIntegrationStatusColor,
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

/** Confirmations can open from inside the platform Details modal (Mantine default 200), so they sit above it. */
const CONFIRM_MODAL_Z = 400;

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
  const [disconnectTarget, setDisconnectTarget] = useState<Platform | null>(null);
  const [deleteDataTarget, setDeleteDataTarget] = useState<string | null>(null);
  const tDeletion = useTranslations('metaDeletion');
  const t = useTranslations('connections');
  const intl = useLocale() === 'es' ? 'es-US' : 'en-US';
  const when = (value: string | null) => {
    if (!value) return t('notAvailable');
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString(intl, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  };
  /** "5 minutes ago" / "hace 5 minutos". */
  const ago = (value: string | null) => {
    const time = value ? Date.parse(value) : Number.NaN;
    if (!Number.isFinite(time)) return t('notSynced');
    const seconds = (time - Date.now()) / 1000;
    const format = new Intl.RelativeTimeFormat(intl, { numeric: 'auto' });
    for (const [unit, size] of [['day', 86400], ['hour', 3600], ['minute', 60]] as const) {
      if (Math.abs(seconds) >= size) return format.format(Math.round(seconds / size), unit);
    }
    return format.format(0, 'minute');
  };
  const statusLabel = (status: IntegrationStatus) => t(`status.${status === 'connected' || status === 'needs_reauth' || status === 'error' ? status : 'other'}`);
  const availability = (platform: Pick<Platform, 'platformKey' | 'status' | 'lastSyncedAt'>) => isIntegrationConnected(platform.status)
    ? (platform.lastSyncedAt ? t('lastSynced', { when: ago(platform.lastSyncedAt) }) : t('settingUp'))
    : platform.platformKey === 'meta'
      ? t(integrationNeedsAttention(platform.status) ? 'reconnectHint' : 'availableNow')
      : t('preview');
  const [selectedPlatform, setSelectedPlatform] = useState<DisplayPlatform | null>(null);
  const [refreshing, setRefreshing] = useState(false);
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
  const focusedPlatform =
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
  const focusedPlatformUnavailable = Boolean(focusedPlatform) &&
    !focusedPlatformConnected &&
    focusedPlatform?.platformKey !== 'meta';
  const platformName = focusedPlatform?.platformName ?? '';
  const focusedHeroTitle = !focusedPlatform
    ? t('heroNone')
    : focusedPlatformPitchDetached
      ? t('heroDetached', { platform: platformName })
    : focusedPlatformConnected
      ? t('heroConnected', { platform: platformName })
      : t('heroConnect', { platform: platformName });
  const focusedHeroDescription = !focusedPlatform
    ? t('leadNone')
    : focusedPlatformPitchDetached
      ? t('leadDetached', { platform: platformName })
    : focusedPlatformConnected
      ? t('leadConnected')
      : focusedPlatform.platformKey === 'meta'
        ? t('leadMeta')
        : t('leadUnavailable', { platform: platformName });
  const focusedPrimaryLabel = !focusedPlatform
    ? t('primaryNone')
    : focusedPlatformPitchDetached
      ? t('reconnect', { platform: platformName })
    : focusedPlatformConnected
      ? t('sync', { platform: platformName })
      : focusedPlatformNeedsAttention
        ? t('reconnect', { platform: platformName })
        : t('connect', { platform: platformName });
  const heroCardStyle = {
    background: '#082d56',
    borderColor: '#284665',
  } satisfies CSSProperties;

  const syncPitchDetachedState = () => {
    setPitchDetachedPlatforms(readPitchDetachedPlatforms());
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
    if (!platform.integrationId) {
      toast.error(t('noIntegration'));
      return;
    }

    setDisconnectTarget(platform);
  };

  const confirmDisconnect = async () => {
    const platform = disconnectTarget;
    if (!platform?.integrationId) {
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

      toast.success(t('disconnected', { platform: platform.platformName }));
      router.refresh();
      setSelectedPlatform((current) => (current?.id === platform.id ? null : current));
    } catch (error) {
      console.error(`Error disconnecting ${platform.platformName}:`, error);
      toast.error(t('disconnectFailed', { platform: platform.platformName }));
    } finally {
      setDisconnectingPlatformId(null);
      setDisconnectTarget(null);
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
          throw new Error(t('waitSeconds', { seconds: Math.max(1, Math.ceil((result.retryAfterMs || 30000) / 1000)) }));
        }

        throw new Error(result.message || 'Failed to refresh sync');
      }

      toast.success(t('syncDone'));
      router.refresh();
    } catch (error) {
      console.error('Error refreshing connections:', error);
      toast.error(t('owner.refresh'));
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
      toast.error(t('owner.accounts'));
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
          ? t('accountChangedSetup')
          : t('accountChanged')
      );
      setAccountSelectionPlatform(null);
      router.refresh();
    } catch (error) {
      console.error('Error selecting Meta ad account:', error);
      toast.error(t('owner.selection'));
    } finally {
      setSubmittingAccountSelection(false);
    }
  };

  return (
    <MetaIntegrationFlow
      returnTo="/integration"
      afterSuccess={() => {
        // The Overview shows "Setting up your account" with live progress while the sync finishes.
        router.replace('/dashboard');
        router.refresh();
      }}
    >
      {({ connectMeta, connecting }) => (
        <Container size="xl" pos="relative" pb="xl" className={`${product.page} ${styles.page}`}>
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
              <SimpleGrid cols={1} spacing="xl">
                <Stack gap="md" className={styles.heroContent}>
                  <Group gap="xs" wrap="wrap">
                    <Badge variant="light" className="app-platform-page-badge">
                      {t('badge')}
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
                  </Group>

                  <div>
                    <Title order={1} size="h2" className="app-platform-page-title">
                      {t('title')}
                    </Title>
                    <Text size="md" mt="sm" maw={680} className="app-platform-page-copy">
                      {focusedHeroDescription}
                    </Text>
                  </div>
                  <Text size="sm" fw={600}>{focusedPlatform?.primaryAdAccountName || focusedHeroTitle}</Text>

                  <Group gap="sm" wrap="wrap">
                    {focusedPlatformUnavailable || !focusedPlatform ? (
                      <Badge variant="outline" color="gray">{t('unavailable')}</Badge>
                    ) : (
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
                      radius="xl"
                      className="app-platform-page-action-primary"
                    >
                      {focusedPrimaryLabel}
                      </Button>
                    )}
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
                        className="app-platform-page-action-secondary"
                      >
                        {focusedPlatformConnected &&
                        focusedPlatform.platformKey === 'meta' &&
                        focusedPlatform.discoveredAdAccountCount > 1
                          ? t('changeAccount')
                          : t('view', { platform: focusedPlatform.platformName })}
                      </Button>
                    ) : null}
                  </Group>

                </Stack>

              </SimpleGrid>
            </Card>

            <div>
              <Group justify="space-between" align="flex-end" mb="md" wrap="wrap">
                <div>
                  <Text size="sm" c="dimmed" fw={700}>
                    {t('directory')}
                  </Text>
                  <Title order={3} mt={4}>
                    {t('yours')}
                  </Title>
                  <Text size="sm" c="dimmed" mt={4}>
                    {t('yoursLead')}
                  </Text>
                </div>
                <Badge color="gray" variant="light">
                  {t('platforms', { count: sortedPlatforms.length })}
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
                          <StatusBadge status={platform.status}/>

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
                            <Text fw={700} size="lg" style={{ color: `light-dark(${palette.text}, var(--dv-text))` }}>
                              {platform.platformName}
                            </Text>
                            {!platform.integrationId && platform.platformKey !== 'meta' ? (
                              <Badge color="gray" variant="light">
                                {t('unavailable')}
                              </Badge>
                            ) : null}
                          </Group>
                          <Text size="sm" c="dimmed">
                            {platform.description || platform.fullDescription || t('noDescription')}
                          </Text>
                        </div>

                        <SimpleGrid cols={2} spacing="sm">
                          <Paper withBorder radius="lg" p="sm" className={styles.metricCard}>
                            <Text size="sm" c="dimmed" fw={700}>
                              {t('syncState')}
                            </Text>
                            <Text fw={700} mt={4}>
                              {ago(platform.lastSyncedAt)}
                            </Text>
                          </Paper>
                          <Paper withBorder radius="lg" p="sm" className={styles.metricCard}>
                            <Text size="sm" c="dimmed" fw={700}>
                              {t('accountRule')}
                            </Text>
                            <Text fw={700} mt={4}>
                              {t('onePrimary')}
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
                            {t('owner.connection')}
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
                          <Text size="sm" c="dimmed" fw={700}>
                            {t('goodAt')}
                          </Text>
                          <Text size="sm" mt={6}>
                            {platform.strengths || platform.description || t('noStrengths')}
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
                                  {t('refreshData')}
                                </Button>
                                {platform.platformKey === 'meta' &&
                                platform.discoveredAdAccountCount > 1 ? (
                                  <Button
                                    variant="default"
                                    onClick={() => void handleOpenAccountSelection(platform)}
                                  >
                                    {t('changeAccount')}
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
                                {integrationNeedsAttention(platform.status) ? t('reconnectMeta') : t('connectMeta')}
                              </Button>
                            ) : (
                              <Badge variant="outline" color="gray">{t('unavailable')}</Badge>
                            )}

                            <Button
                              variant="default"
                              onClick={() => setSelectedPlatform(platform)}
                            >
                              {t('details')}
                            </Button>
                          </Group>

                          {platform.integrationId ? (
                            <Menu shadow="md" position="bottom-end">
                              <Menu.Target>
                                <ActionIcon variant="default" radius="xl" size="lg" aria-label={t('settings', { platform: platform.platformName })}>
                                  <IconSettings size={16} />
                                </ActionIcon>
                              </Menu.Target>
                              <Menu.Dropdown>
                                <Menu.Label>{platform.platformName}</Menu.Label>
                                <Menu.Item onClick={() => setSelectedPlatform(platform)}>
                                  {t('viewDetails')}
                                </Menu.Item>

                                <Menu.Divider />
                                <Menu.Item
                                  color="red"
                                  leftSection={<IconTrash size={14} />}
                                  onClick={() => handleDisconnect(platform)}
                                  disabled={disconnecting}
                                >
                                  {disconnecting ? t('disconnecting') : t('disconnect')}
                                </Menu.Item>
                                {platform.platformKey === 'meta' && (
                                  <Menu.Item color="red" leftSection={<IconTrash size={14} />} onClick={() => setDeleteDataTarget(platform.integrationId)}>
                                    {tDeletion('menu')}
                                  </Menu.Item>
                                )}
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

            <DeleteMetaDataModal integrationId={deleteDataTarget} opened={Boolean(deleteDataTarget)} onClose={() => setDeleteDataTarget(null)} />

            <Modal
              opened={Boolean(disconnectTarget)}
              onClose={() => {
                if (!disconnectingPlatformId) {
                  setDisconnectTarget(null);
                }
              }}
              title={t('disconnectTitle')}
              centered
              zIndex={CONFIRM_MODAL_Z}
              closeOnClickOutside={!disconnectingPlatformId}
              closeOnEscape={!disconnectingPlatformId}
              withCloseButton={!disconnectingPlatformId}
            >
              <Stack gap="md">
                <Text size="sm">
                  {t('disconnectBody', { platform: disconnectTarget?.platformName ?? t('thisPlatform') })}
                </Text>
                <Group justify="flex-end">
                  <Button
                    variant="default"
                    onClick={() => setDisconnectTarget(null)}
                    disabled={Boolean(disconnectingPlatformId)}
                  >
                    {t('cancel')}
                  </Button>
                  <Button
                    color="red"
                    onClick={() => void confirmDisconnect()}
                    loading={Boolean(disconnectingPlatformId)}
                  >
                    {t('disconnect')}
                  </Button>
                </Group>
              </Stack>
            </Modal>

            <Modal
              opened={Boolean(accountSelectionPlatform)}
              onClose={() => {
                if (!submittingAccountSelection) {
                  setAccountSelectionPlatform(null);
                }
              }}
              title={t('changeTitle')}
              centered
              zIndex={CONFIRM_MODAL_Z}
            >
              <Stack gap="md">
                <Text size="sm" c="dimmed">
                  {t('changeBody')}
                </Text>

                <Select
                  label={t('accounts')}
                  placeholder={loadingAccountOptions ? t('loadingAccounts') : t('selectAccount')}
                  data={accountOptions}
                  value={selectedAccountExternalId}
                  onChange={setSelectedAccountExternalId}
                  disabled={loadingAccountOptions || submittingAccountSelection}
                  searchable
                  nothingFoundMessage={t('noAccounts')}
                  // The list must sit above this raised dialog, or it opens hidden behind it.
                  comboboxProps={{ zIndex: CONFIRM_MODAL_Z + 1 }}
                />

                {accountSelectionPlatform ? (
                  <Text size="sm" c="dimmed">
                    {t('currentAccount', { name: accountSelectionPlatform.primaryAdAccountName ||
                      accountSelectionPlatform.primaryAdAccountExternalId ||
                      t('notSelected') })}
                  </Text>
                ) : null}

                <Group justify="flex-end" gap="sm">
                  <Button
                    variant="default"
                    onClick={() => setAccountSelectionPlatform(null)}
                    disabled={submittingAccountSelection}
                  >
                    {t('cancel')}
                  </Button>
                  <Button
                    onClick={handleSelectAdAccount}
                    loading={submittingAccountSelection}
                    disabled={!selectedAccountExternalId || loadingAccountOptions}
                  >
                    {t('saveAndSync')}
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
                              <Text fw={700} size="xl" style={{ color: `light-dark(${palette.text}, var(--dv-text))` }}>
                                  {selectedPlatform.platformName}
                                </Text>
                                <StatusBadge status={selectedPlatform.status}/>
                  
                              </Group>
                              <Text size="sm" maw={460}>
                                {selectedPlatform.fullDescription ||
                                  selectedPlatform.description ||
                                  t('noDetail')}
                              </Text>
                            </div>
                          </Group>

                          <Button variant="subtle" onClick={() => setSelectedPlatform(null)}>
                            {t('close')}
                          </Button>
                        </Group>
                      </Paper>

                      <Disclosure title={t('diagnostics')}>
                      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                        <Paper withBorder radius="lg" p="md" className={styles.metricCard}>
                          <Text size="sm" c="dimmed" fw={700}>
                            {t('connectedOn')}
                          </Text>
                          <Text fw={700} mt={4}>
                            {when(selectedPlatform.connectedAt)}
                          </Text>
                        </Paper>

                        <Paper withBorder radius="lg" p="md" className={styles.metricCard}>
                          <Text size="sm" c="dimmed" fw={700}>
                            {t('lastSync')}
                          </Text>
                          <Text fw={700} mt={4}>
                            {when(selectedPlatform.lastSyncedAt)}
                          </Text>
                        </Paper>

                        <Paper withBorder radius="lg" p="md" className={styles.metricCard}>
                          <Text size="sm" c="dimmed" fw={700}>
                            {t('currentStatus')}
                          </Text>
                          <Text fw={700} mt={4}>
                            {statusLabel(selectedPlatform.status)}
                          </Text>
                        </Paper>

                        <Paper withBorder radius="lg" p="md" className={styles.metricCard}>
                          <Text size="sm" c="dimmed" fw={700}>
                            {t('lastUpdated')}
                          </Text>
                          <Text fw={700} mt={4}>
                            {when(selectedPlatform.updatedAt)}
                          </Text>
                        </Paper>

                        <Paper withBorder radius="lg" p="md" className={styles.metricCard}>
                          <Text size="sm" c="dimmed" fw={700}>
                            {t('syncRule')}
                          </Text>
                          <Text fw={700} mt={4}>
                            {t('onePrimaryLong')}
                          </Text>
                        </Paper>

                        <Paper withBorder radius="lg" p="md" className={styles.metricCard}>
                          <Text size="sm" c="dimmed" fw={700}>
                            {t('readiness')}
                          </Text>
                          <Text fw={700} mt={4}>
                            {availability(selectedPlatform)}
                          </Text>
                        </Paper>
                      </SimpleGrid>

                      </Disclosure>
                      {selectedPlatform.platformKey === 'meta' && connected ? (
                        <div>
                          <Text size="sm" c="dimmed" fw={700}>
                            {t('primaryAccount')}
                          </Text>
                          <Group gap="xs" mt="sm" wrap="wrap">
                            {canChangeMetaAccount ? (
                              <Button
                                radius="xl"
                                variant="default"
                                onClick={() => void handleOpenAccountSelection(selectedPlatform)}
                              >
                                {selectedPlatform.primaryAdAccountName ||
                                  selectedPlatform.primaryAdAccountExternalId ||
                                  t('notSelected')}
                              </Button>
                            ) : (
                              <Badge variant="light" color="signal" size="lg">
                                {selectedPlatform.primaryAdAccountName ||
                                  selectedPlatform.primaryAdAccountExternalId ||
                                  t('notSelected')}
                              </Badge>
                            )}
                            <Text size="sm" c="dimmed">
                              {selectedPlatform.discoveredAdAccountCount > 1
                                ? t('accountsMany', { count: selectedPlatform.discoveredAdAccountCount })
                                : selectedPlatform.discoveredAdAccountCount === 1
                                  ? t('accountsOne')
                                  : t('accountsNone')}
                            </Text>
                          </Group>
                        </div>
                      ) : null}

                      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                        <Paper withBorder radius="lg" p="md">
                          <Text size="sm" c="dimmed" fw={700}>
                            {t('strengths')}
                          </Text>
                          <Text size="sm" mt="sm">
                            {selectedPlatform.strengths ||
                              t('noStrengthsLong')}
                          </Text>
                        </Paper>

                        <Paper withBorder radius="lg" p="md">
                          <Text size="sm" c="dimmed" fw={700}>
                            {t('watchouts')}
                          </Text>
                          <Text size="sm" mt="sm">
                            {selectedPlatform.weaknesses ||
                              t('noWatchouts')}
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
                          {t('owner.connection')}
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
                                {t('refreshData')}
                              </Button>
                              {canChangeMetaAccount ? (
                                <Button
                                  variant="default"
                                  onClick={() => void handleOpenAccountSelection(selectedPlatform)}
                                >
                                  {t('changeAccount')}
                                </Button>
                              ) : null}
                  
                              <Button
                                color="red"
                                variant="light"
                                leftSection={<IconTrash size={16} />}
                                onClick={() => handleDisconnect(selectedPlatform)}
                                loading={disconnecting}
                              >
                                {t('disconnect')}
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
                              {integrationNeedsAttention(selectedPlatform.status) ? t('reconnectMeta') : t('connectMeta')}
                            </Button>
                          ) : (
                            <Badge variant="outline" color="gray">{t('unavailable')}</Badge>
                          )}
                        </Group>

                        <Group gap={8}>
                          <ThemeIcon color="gray" variant="light" radius="xl">
                            <IconClock size={16} />
                          </ThemeIcon>
                          <Text size="sm" c="dimmed">
                            {availability(selectedPlatform)}
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
