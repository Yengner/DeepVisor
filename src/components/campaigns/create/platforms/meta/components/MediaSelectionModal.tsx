'use client';

import { useEffect, useState, useMemo } from 'react';
import {
    Modal, Text, Tabs, SimpleGrid, Paper, Image, Stack, Badge,
    Group, ThemeIcon, Button, Center, Loader, Box, AspectRatio,
    ScrollArea, Divider, Alert
} from '@mantine/core';
import {
    IconAlertCircle, IconPhoto, IconCheck, IconFileText, IconChevronLeft, IconChevronRight
} from '@tabler/icons-react';
import { useExistingCreatives } from '../hooks/useExistingCreatives';
import { MetaCreative } from '@/lib/actions/meta/creatives/actions';
import { useCreativePreview } from '../hooks/useCreativePreview';

interface MediaSelectionModalProps {
    opened: boolean;
    onClose: () => void;
    onSelectCreative: (creative: SelectedCreative | null) => void;
    objective: string;
    destinationType: string;
    platformId: string;
    adAccountId: string;
    initialSelectedId?: string | null;
}

interface SelectedCreative {
    id: string;
    name: string;
    thumbnail_url?: string;
    type: string;
}

export default function MediaSelectionModal({
    opened,
    onClose,
    onSelectCreative,
    objective = '',
    destinationType = '',
    platformId,
    adAccountId,
    initialSelectedId = null
}: MediaSelectionModalProps) {
    const [activeTab, setActiveTab] = useState<string>('creatives');
    const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);

    const shouldShowLeadTab = objective === 'OUTCOME_LEADS' && destinationType === 'ON_AD';

    const {
        creatives,
        loading,
        error,
        hasNextPage,
        hasPreviousPage,
        goToNextPage,
        goToPreviousPage,
        reset
    } = useExistingCreatives({
        platformId,
        adAccountId,
        enabled: opened,
        thumbnailWidth: 400,
        thumbnailHeight: 300
    });

    // --- Creative Preview logic ---
    const {
        previews,
        loading: loadingPreview,
        error: previewError,
        hasLoaded: previewLoaded
    } = useCreativePreview({
        platformId,
        creativeId: selectedId,
        enabled: !!selectedId,
        previewTypes: ['DESKTOP_FEED_STANDARD']
    });

    const previewHtml = useMemo(() => {
        if (previews && previews['DESKTOP_FEED_STANDARD']?.body) {
            return previews['DESKTOP_FEED_STANDARD'].body;
        }
        return null;
    }, [previews]);

    useEffect(() => {
        if (opened) {
            reset();
            setSelectedId(initialSelectedId);
        }
    }, [opened, initialSelectedId, reset]);

    const handleSelection = (creative: MetaCreative) => {
        setSelectedId(creative.id === selectedId ? null : creative.id);
    };

    const handleConfirmSelection = () => {
        if (!selectedId) {
            onSelectCreative(null);
            onClose();
            return;
        }

        const selectedCreative = creatives.find(c => c.id === selectedId);
        if (selectedCreative) {
            onSelectCreative({
                id: selectedCreative.id,
                name: selectedCreative.name || `Creative ${selectedCreative.id}`,
                thumbnail_url: selectedCreative.thumbnail_url,
                type: selectedCreative.object_type || 'UNKNOWN'
            });
        } else {
            onSelectCreative(null);
        }

        onClose();
    };

    // Memoize selected creative for preview fallback
    const selectedCreative = useMemo(
        () => creatives.find(c => c.id === selectedId) || null,
        [selectedId, creatives]
    );

    return (
        <Modal
            opened={opened}
            onClose={onClose}
            size="xxl"
            styles={{
                body: { padding: '0' },
                inner: { paddingBottom: 0 },
                content: {
                    minWidth: 1000,
                    minHeight: 600,
                    maxHeight: '90vh',
                    display: 'flex',
                    flexDirection: 'column'
                }
            }}
            title={
                <Group>
                    <IconPhoto size={20} />
                    <Text fw={600}>Select Creative</Text>
                </Group>
            }
            centered
            scrollAreaComponent={ScrollArea.Autosize}
        >
            {/* Main content area: fill modal height */}
            <Box
                style={{
                    display: 'flex',
                    gap: 32,
                    flex: 1,
                    minHeight: 0,
                    padding: 16,
                    height: 722, // 690 + 32px padding
                    maxHeight: 722,
                }}
            >
                {/* Left: Creatives Grid (scrollable) */}
                <Box
                    style={{
                        width: 420,
                        minWidth: 320,
                        maxWidth: 480,
                        flexShrink: 0,
                        height: '100%',
                        overflowY: 'auto',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'stretch',
                        justifyContent: 'flex-start',
                        borderRight: '1px solid var(--mantine-color-gray-2)',
                        paddingRight: 8,
                    }}
                >
                    {loading && (
                        <Center py="xl">
                            <Stack align="center">
                                <Loader size="md" />
                                <Text size="sm" c="dimmed">Loading your creatives...</Text>
                            </Stack>
                        </Center>
                    )}

                    {error && (
                        <Paper p="md" withBorder bg="red.0">
                            <Group>
                                <ThemeIcon color="red" variant="light"><IconAlertCircle size={16} /></ThemeIcon>
                                <Text size="sm">{error}</Text>
                            </Group>
                        </Paper>
                    )}

                    {!loading && !error && creatives.length === 0 && (
                        <Paper p="md" withBorder>
                            <Stack align="center" py="md">
                                <ThemeIcon color="blue" variant="light" size="lg"><IconPhoto size={24} /></ThemeIcon>
                                <Text c="dimmed" size="sm" ta="center">No creatives available.</Text>
                            </Stack>
                        </Paper>
                    )}

                    {!loading && !error && creatives.length > 0 && (
                        <>
                            <SimpleGrid cols={2} spacing="md">
                                {creatives.slice(0, 10).map((creative) => {
                                    const isSelected = selectedId === creative.id;
                                    return (
                                        <Paper
                                            key={creative.id}
                                            withBorder
                                            style={{
                                                cursor: 'pointer',
                                                borderColor: isSelected ? 'var(--mantine-color-blue-6)' : undefined,
                                                borderWidth: isSelected ? 2 : 1,
                                                overflow: 'hidden',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                minHeight: 90,
                                            }}
                                            onClick={() => handleSelection(creative)}
                                        >
                                            <Box style={{ position: 'relative' }}>
                                                <AspectRatio ratio={4 / 3}>
                                                    <Image
                                                        src={creative.thumbnail_url || 'https://placehold.co/400x300/e6f7ff/0099cc?text=No+Preview'}
                                                        alt={creative.name || 'Creative'}
                                                        fit="cover"
                                                    />
                                                </AspectRatio>
                                                {isSelected && (
                                                    <Box
                                                        style={{
                                                            position: 'absolute',
                                                            top: 0,
                                                            right: 0,
                                                            bottom: 0,
                                                            left: 0,
                                                            background: 'rgba(0, 0, 0, 0.15)',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center'
                                                        }}
                                                    >
                                                        <ThemeIcon color="blue" size="xl" radius="xl">
                                                            <IconCheck size={20} />
                                                        </ThemeIcon>
                                                    </Box>
                                                )}
                                            </Box>
                                            <Box p="xs">
                                                <Text fw={500} size="sm" lineClamp={1}>
                                                    {creative.name || "Untitled Creative"}
                                                </Text>
                                                <Text size="xs" c="dimmed" mb="xs">
                                                    {`ID: ${creative.id.slice(-12)}`}
                                                </Text>
                                                <Badge color="blue" fullWidth>
                                                    {creative.object_type || 'Ad Creative'}
                                                </Badge>
                                            </Box>
                                        </Paper>
                                    );
                                })}
                            </SimpleGrid>

                            {(hasNextPage || hasPreviousPage) && (
                                <Group justify="center" mt="xl" mb="md" pt="md"
                                    style={{ borderTop: '1px solid var(--mantine-color-gray-2)' }}
                                >
                                    <Button
                                        variant="subtle"
                                        disabled={!hasPreviousPage}
                                        onClick={goToPreviousPage}
                                        leftSection={<IconChevronLeft size={16} />}
                                    >
                                        Previous
                                    </Button>
                                    <Text size="sm" c="dimmed" px="md">
                                        {loading ? 'Loading...' : `${creatives.length} items`}
                                    </Text>
                                    <Button
                                        variant="subtle"
                                        disabled={!hasNextPage}
                                        onClick={goToNextPage}
                                        rightSection={<IconChevronRight size={16} />}
                                    >
                                        Next
                                    </Button>
                                </Group>
                            )}
                        </>
                    )}
                </Box>

                {/* Right: Preview (fixed 540x690, never scrolls) */}
                <Box
                    style={{
                        width: 540,
                        height: 690,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'white',
                    }}
                >
                    {selectedCreative ? (
                        <>
                            {loadingPreview && (
                                <Center w={540} h={690}>
                                    <Loader size="md" />
                                </Center>
                            )}
                            {previewError && (
                                <Alert color="red" title="Preview Error" mb="md">
                                    {previewError}
                                </Alert>
                            )}
                            {!loadingPreview && !previewError && previewHtml ? (
                                <Box
                                    className="creative-preview"
                                    dangerouslySetInnerHTML={{ __html: previewHtml }}
                                    style={{
                                        width: 540,
                                        height: 600,
                                        border: '1px solid #eee',
                                        borderRadius: '8px',
                                        overflow: 'hidden',
                                    }}
                                />
                            ) : null}
                            {!loadingPreview && !previewError && !previewHtml && (
                                <Image
                                    src={selectedCreative.thumbnail_url || 'https://placehold.co/540x690/e6f7ff/0099cc?text=No+Preview'}
                                    alt="Creative Preview"
                                    width={540}
                                    height={690}
                                    fit="contain"
                                    style={{ borderRadius: 8, border: '1px solid #eee' }}
                                />
                            )}
                        </>
                    ) : (
                        <Center w={540} h={690}>
                            <ThemeIcon color="gray" variant="light" size="lg"><IconPhoto size={24} /></ThemeIcon>
                        </Center>
                    )}
                </Box>
            </Box>

            {/* Action Bar - Fixed at the bottom */}
            <Box
                style={{
                    position: 'sticky',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    padding: '15px 20px',
                    background: 'white',
                    borderTop: '1px solid var(--mantine-color-gray-3)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: 'auto'
                }}
            >
                <Badge size="lg" color="blue" variant="light" radius="md">
                    {selectedId ? '1 creative selected' : 'No selection'}
                </Badge>

                <Group>
                    <Button variant="light" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleConfirmSelection}
                        color="blue"
                        disabled={!selectedId}
                    >
                        Confirm Selection
                    </Button>
                </Group>
            </Box>
        </Modal>
    );
}