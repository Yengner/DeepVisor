'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  AspectRatio,
  Badge,
  Box,
  Button,
  Center,
  Divider,
  Group,
  Image,
  Loader,
  Modal,
  Paper,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  ThemeIcon,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconCalendar,
  IconCheck,
  IconCurrencyDollar,
  IconPhoto,
  IconSparkles,
  IconStarFilled,
  IconTargetArrow,
} from '@tabler/icons-react';
import type {
  CreativeLibraryItem,
  CreativeLibrarySort,
  CreativeLibrarySource,
  CreativeLibraryStats,
} from '@/lib/shared/types/creativeLibrary';
import { formatCurrencyAmount } from '@/lib/shared';
import { useExistingCreatives } from '../hooks/useExistingCreatives';
import { useCreativePreview } from '../hooks/useCreativePreview';

const FALLBACK_PREVIEW = 'https://placehold.co/640x640/f4f7fb/64748b?text=No+Preview';

interface MediaSelectionModalProps {
  opened: boolean;
  onClose: () => void;
  onSelectCreative: (creative: SelectedCreative | null) => void;
  objective: string;
  destinationType: string;
  platformId: string;
  adAccountId: string;
  currencyCode?: string | null;
  initialSelectedId?: string | null;
}

export interface SelectedCreative {
  id: string;
  name: string;
  thumbnail_url?: string | null;
  type: string;
  source?: CreativeLibrarySource;
  sourceId?: string;
  postId?: string | null;
  creativeIds?: string[];
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 1,
    notation: value >= 10000 ? 'compact' : 'standard',
  }).format(value);
}

function formatRate(value: number | null): string {
  if (value == null) {
    return '-';
  }

  const normalized = value > 1 ? value : value * 100;
  return `${normalized.toFixed(normalized >= 10 ? 1 : 2)}%`;
}

function formatDate(value: string | null): string {
  if (!value) {
    return 'No date yet';
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

function statLabel(stats: CreativeLibraryStats): string {
  if (stats.results > 0) {
    return `${formatNumber(stats.results)} results`;
  }

  if (stats.clicks > 0) {
    return `${formatNumber(stats.clicks)} clicks`;
  }

  if (stats.impressions > 0) {
    return `${formatNumber(stats.impressions)} impressions`;
  }

  return 'No delivery yet';
}

function sortLabel(sort: CreativeLibrarySort): string {
  switch (sort) {
    case 'newest':
      return 'Newest first';
    case 'oldest':
      return 'Oldest first';
    case 'spend':
      return 'Highest spend';
    case 'results':
      return 'Most results';
    case 'best':
    default:
      return 'Best first';
  }
}

function StatsGrid({
  stats,
  currencyCode,
}: {
  stats: CreativeLibraryStats;
  currencyCode?: string | null;
}) {
  const items = [
    {
      label: 'Spend',
      value: formatCurrencyAmount(stats.spend, currencyCode, {
        minimumFractionDigits: 0,
        maximumFractionDigits: stats.spend >= 100 ? 0 : 2,
      }),
      icon: IconCurrencyDollar,
    },
    { label: 'Results', value: formatNumber(stats.results), icon: IconTargetArrow },
    { label: 'CTR', value: formatRate(stats.ctr), icon: IconSparkles },
  ];

  return (
    <SimpleGrid cols={3} spacing="xs">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Paper key={item.label} withBorder radius="md" p="xs" bg="gray.0">
            <Group gap={5} wrap="nowrap">
              <Icon size={13} color="var(--mantine-color-blue-6)" />
              <Text size="10px" c="dimmed" tt="uppercase" fw={800} style={{ letterSpacing: 0.3 }}>
                {item.label}
              </Text>
            </Group>
            <Text fw={900} size="sm" mt={2} c="dark.8">
              {item.value}
            </Text>
          </Paper>
        );
      })}
    </SimpleGrid>
  );
}

function CreativeCard({
  creative,
  selected,
  onClick,
  currencyCode,
}: {
  creative: CreativeLibraryItem;
  selected: boolean;
  onClick: () => void;
  currencyCode?: string | null;
}) {
  return (
    <Paper
      withBorder
      radius="lg"
      p="xs"
      onClick={onClick}
      style={{
        cursor: 'pointer',
        borderColor: selected ? 'var(--mantine-color-blue-6)' : 'var(--mantine-color-gray-2)',
        borderWidth: selected ? 2 : 1,
        background: selected ? 'var(--mantine-color-blue-0)' : 'white',
      }}
    >
      <Stack gap="xs">
        <Box style={{ position: 'relative' }}>
          <AspectRatio ratio={1}>
            <Image
              src={creative.thumbnail_url || FALLBACK_PREVIEW}
              alt={creative.name}
              fit="cover"
              radius="md"
            />
          </AspectRatio>
          {creative.isBest ? (
            <Badge
              size="sm"
              radius="xl"
              color="yellow"
              leftSection={<IconStarFilled size={12} />}
              style={{ position: 'absolute', top: 8, left: 8 }}
            >
              Best
            </Badge>
          ) : null}
          {selected ? (
            <ThemeIcon
              color="blue"
              size="lg"
              radius="xl"
              style={{ position: 'absolute', right: 8, top: 8 }}
            >
              <IconCheck size={16} />
            </ThemeIcon>
          ) : null}
        </Box>

        <Stack gap={3}>
          <Text fw={850} size="sm" lineClamp={2} c="dark.8">
            {creative.name}
          </Text>
          <Group gap={6} justify="space-between" wrap="nowrap">
            <Badge variant="light" color={creative.source === 'page_post' ? 'grape' : 'blue'} size="xs">
              {creative.type}
            </Badge>
            <Text size="xs" c="dimmed">
              {statLabel(creative.stats)}
            </Text>
          </Group>
        </Stack>

        <StatsGrid stats={creative.stats} currencyCode={currencyCode} />
      </Stack>
    </Paper>
  );
}

export default function MediaSelectionModal({
  opened,
  onClose,
  onSelectCreative,
  platformId,
  adAccountId,
  currencyCode,
  initialSelectedId = null,
}: MediaSelectionModalProps) {
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);
  const [activeSource, setActiveSource] = useState<CreativeLibrarySource>(
    initialSelectedId?.startsWith('post:') ? 'page_post' : 'ad_creative'
  );
  const [sort, setSort] = useState<CreativeLibrarySort>('best');

  const {
    creatives,
    allCreatives,
    loading,
    error,
  } = useExistingCreatives({
    platformId,
    adAccountId,
    enabled: opened,
    source: activeSource,
    sort,
    limit: 160,
  });

  const allItems = useMemo(
    () => [...allCreatives.adCreatives, ...allCreatives.pagePosts],
    [allCreatives.adCreatives, allCreatives.pagePosts]
  );

  const selectedCreative = useMemo(
    () => allItems.find((creative) => creative.id === selectedId) || null,
    [allItems, selectedId]
  );

  const previewCreativeId =
    selectedCreative?.source === 'ad_creative' ? selectedCreative.sourceId : null;

  const {
    previews,
    loading: loadingPreview,
    error: previewError,
  } = useCreativePreview({
    platformId,
    creativeId: previewCreativeId,
    enabled: opened && !!previewCreativeId,
    previewTypes: ['DESKTOP_FEED_STANDARD'],
  });

  const previewHtml = useMemo(() => {
    return previews?.DESKTOP_FEED_STANDARD?.body || null;
  }, [previews]);

  useEffect(() => {
    if (!opened) {
      return;
    }

    setSelectedId(initialSelectedId);
    setActiveSource(initialSelectedId?.startsWith('post:') ? 'page_post' : 'ad_creative');
    setSort('best');
  }, [initialSelectedId, opened]);

  const handleSelection = (creative: CreativeLibraryItem) => {
    setSelectedId(creative.id === selectedId ? null : creative.id);
  };

  const handleConfirmSelection = () => {
    if (!selectedCreative) {
      onSelectCreative(null);
      onClose();
      return;
    }

    onSelectCreative({
      id: selectedCreative.id,
      name: selectedCreative.name,
      thumbnail_url: selectedCreative.thumbnail_url,
      type: selectedCreative.type,
      source: selectedCreative.source,
      sourceId: selectedCreative.sourceId,
      postId: selectedCreative.postId ?? null,
      creativeIds: selectedCreative.creativeIds,
    });
    onClose();
  };

  const activeEmptyText =
    activeSource === 'page_post'
      ? 'No synced Page posts with ad history yet.'
      : 'No synced ad creatives yet.';

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="min(1120px, 96vw)"
      styles={{
        body: { padding: 0 },
        content: {
          maxHeight: '92vh',
          overflow: 'hidden',
        },
      }}
      title={
        <Group gap="xs">
          <ThemeIcon color="blue" variant="light" radius="xl">
            <IconPhoto size={18} />
          </ThemeIcon>
          <Stack gap={0}>
            <Text fw={900}>Select existing creative</Text>
            <Text size="xs" c="dimmed">
              Ranked by synced Meta performance
            </Text>
          </Stack>
        </Group>
      }
      centered
      scrollAreaComponent={ScrollArea.Autosize}
    >
      <Box
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))',
          gap: 18,
          padding: 16,
          minHeight: 620,
        }}
      >
        <Stack gap="sm" style={{ minHeight: 0 }}>
          <Tabs
            value={activeSource}
            onChange={(value) => {
              const nextSource = (value || 'ad_creative') as CreativeLibrarySource;
              setActiveSource(nextSource);
              setSelectedId(null);
            }}
          >
            <Tabs.List grow>
              <Tabs.Tab value="ad_creative">Ad creatives</Tabs.Tab>
              <Tabs.Tab value="page_post">Page posts</Tabs.Tab>
            </Tabs.List>
          </Tabs>

          <Group justify="space-between" align="center" gap="xs" wrap="nowrap">
            <Text size="sm" fw={800} c="dark.8">
              {creatives.length} {activeSource === 'page_post' ? 'posts' : 'creatives'}
            </Text>
            <Select
              aria-label="Sort creative library"
              value={sort}
              onChange={(value) => setSort((value || 'best') as CreativeLibrarySort)}
              size="xs"
              w={170}
              data={[
                { value: 'best', label: 'Best first' },
                { value: 'results', label: 'Most results' },
                { value: 'spend', label: 'Highest spend' },
                { value: 'newest', label: 'Newest first' },
                { value: 'oldest', label: 'Oldest first' },
              ]}
            />
          </Group>

          <ScrollArea h={500} offsetScrollbars>
            <Stack gap="sm" pr="xs">
              {loading ? (
                <Center py="xl">
                  <Stack align="center" gap="xs">
                    <Loader size="md" />
                    <Text size="sm" c="dimmed">
                      Loading existing creative performance...
                    </Text>
                  </Stack>
                </Center>
              ) : null}

              {!loading && error ? (
                <Alert color="red" icon={<IconAlertCircle size={16} />}>
                  {error}
                </Alert>
              ) : null}

              {!loading && !error && creatives.length === 0 ? (
                <Paper p="lg" withBorder radius="lg">
                  <Stack align="center" gap="xs">
                    <ThemeIcon color="blue" variant="light" radius="xl" size="lg">
                      <IconPhoto size={22} />
                    </ThemeIcon>
                    <Text c="dimmed" size="sm" ta="center">
                      {activeEmptyText}
                    </Text>
                  </Stack>
                </Paper>
              ) : null}

              {!loading && !error && creatives.map((creative) => (
                <CreativeCard
                  key={creative.id}
                  creative={creative}
                  selected={selectedId === creative.id}
                  onClick={() => handleSelection(creative)}
                  currencyCode={currencyCode}
                />
              ))}
            </Stack>
          </ScrollArea>
        </Stack>

        <Paper withBorder radius="xl" p="md" bg="gray.0" style={{ minHeight: 0 }}>
          {selectedCreative ? (
            <Stack gap="md" h="100%">
              <Group justify="space-between" align="flex-start" gap="sm">
                <Stack gap={4} maw={420}>
                  <Group gap="xs">
                    {selectedCreative.isBest ? (
                      <Badge color="yellow" variant="filled" leftSection={<IconStarFilled size={12} />}>
                        Best performer
                      </Badge>
                    ) : null}
                    <Badge color={selectedCreative.source === 'page_post' ? 'grape' : 'blue'} variant="light">
                      {selectedCreative.source === 'page_post' ? 'Page post' : 'Ad creative'}
                    </Badge>
                  </Group>
                  <Text fw={900} size="lg" lineClamp={2} c="dark.8">
                    {selectedCreative.name}
                  </Text>
                  <Group gap={6} c="dimmed">
                    <IconCalendar size={14} />
                    <Text size="xs">
                      {sortLabel(sort)} · Updated {formatDate(selectedCreative.updatedTime)}
                    </Text>
                  </Group>
                </Stack>
              </Group>

              <Box style={{ flex: 1, minHeight: 300 }}>
                {loadingPreview ? (
                  <Center h="100%">
                    <Loader size="md" />
                  </Center>
                ) : null}

                {!loadingPreview && previewError ? (
                  <Alert color="yellow" icon={<IconAlertCircle size={16} />}>
                    {previewError}
                  </Alert>
                ) : null}

                {!loadingPreview && !previewError && selectedCreative.source === 'ad_creative' && previewHtml ? (
                  <Box
                    className="creative-preview"
                    dangerouslySetInnerHTML={{ __html: previewHtml }}
                    style={{
                      width: '100%',
                      height: '100%',
                      minHeight: 430,
                      border: '1px solid var(--mantine-color-gray-2)',
                      borderRadius: 8,
                      overflow: 'hidden',
                      background: 'white',
                    }}
                  />
                ) : null}

                {!loadingPreview && (selectedCreative.source === 'page_post' || !previewHtml) ? (
                  <Center
                    h="100%"
                    mih={430}
                    style={{
                      border: '1px solid var(--mantine-color-gray-2)',
                      borderRadius: 8,
                      overflow: 'hidden',
                      background: 'white',
                    }}
                  >
                    <Image
                      src={selectedCreative.thumbnail_url || FALLBACK_PREVIEW}
                      alt={selectedCreative.name}
                      fit="contain"
                      maw="100%"
                      mah={430}
                    />
                  </Center>
                ) : null}
              </Box>

              <Divider />
              <StatsGrid stats={selectedCreative.stats} currencyCode={currencyCode} />
              <SimpleGrid cols={3} spacing="xs">
                <Paper withBorder radius="md" p="xs" bg="white">
                  <Text size="10px" tt="uppercase" fw={800} c="dimmed" style={{ letterSpacing: 0.3 }}>
                    Clicks
                  </Text>
                  <Text fw={900}>{formatNumber(selectedCreative.stats.clicks)}</Text>
                </Paper>
                <Paper withBorder radius="md" p="xs" bg="white">
                  <Text size="10px" tt="uppercase" fw={800} c="dimmed" style={{ letterSpacing: 0.3 }}>
                    Impressions
                  </Text>
                  <Text fw={900}>{formatNumber(selectedCreative.stats.impressions)}</Text>
                </Paper>
                <Paper withBorder radius="md" p="xs" bg="white">
                  <Text size="10px" tt="uppercase" fw={800} c="dimmed" style={{ letterSpacing: 0.3 }}>
                    Cost/result
                  </Text>
                  <Text fw={900}>
                    {selectedCreative.stats.costPerResult == null
                      ? '-'
                      : formatCurrencyAmount(
                          selectedCreative.stats.costPerResult,
                          currencyCode,
                          {
                            minimumFractionDigits: 0,
                            maximumFractionDigits:
                              selectedCreative.stats.costPerResult >= 100 ? 0 : 2,
                          }
                        )}
                  </Text>
                </Paper>
              </SimpleGrid>
            </Stack>
          ) : (
            <Center h="100%" mih={560}>
              <Stack align="center" gap="xs">
                <ThemeIcon color="gray" variant="light" radius="xl" size="xl">
                  <IconPhoto size={24} />
                </ThemeIcon>
                <Text fw={800} c="dark.7">
                  Pick a creative to preview it
                </Text>
                <Text size="sm" c="dimmed" ta="center" maw={300}>
                  Start with the starred top performer, or switch sorting when you want the newest or oldest assets.
                </Text>
              </Stack>
            </Center>
          )}
        </Paper>
      </Box>

      <Box
        style={{
          position: 'sticky',
          bottom: 0,
          padding: '14px 18px',
          background: 'white',
          borderTop: '1px solid var(--mantine-color-gray-2)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <Badge size="lg" color={selectedId ? 'blue' : 'gray'} variant="light" radius="md">
          {selectedId ? '1 creative selected' : 'No selection'}
        </Badge>

        <Group>
          <Button variant="subtle" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleConfirmSelection} disabled={!selectedId}>
            Use selected creative
          </Button>
        </Group>
      </Box>
    </Modal>
  );
}
