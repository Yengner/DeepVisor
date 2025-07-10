import { useState } from 'react';
import {
    Modal, Text, Tabs, SimpleGrid, Paper, Image, Stack, Badge,
    Group, ThemeIcon, Button, Center, Loader, Pagination, Box, AspectRatio
} from '@mantine/core';
import {
    IconBrandFacebook, IconBrandInstagram, IconAlertCircle,
    IconPhoto, IconCheck, IconFileText
} from '@tabler/icons-react';
import { useExistingCreatives } from '../hooks/useExistingCreatives';
import { PreviewType } from '@/lib/actions/meta/creatives/previews';

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
    const [currentPage, setCurrentPage] = useState(1);

    // Determine which tabs to show based on objective and destination type
    const shouldShowLeadTab = objective === 'OUTCOME_LEADS' && destinationType === 'ON_AD';

    // Fetch creatives using our hook
    const {
        creatives,
        loading,
        error,
        totalPages,
    } = useExistingCreatives({
        platformId,
        adAccountId,
        enabled: opened,
        page: currentPage,
        limit: 9
    });

    // Single selection handler
    const handleSelection = (id: string) => {
        setSelectedId(id === selectedId ? null : id);
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

    return (
        <Modal
            opened={opened}
            onClose={onClose}
            size="xl"
            title="Select Creative"
            centered
            styles={{ body: { paddingBottom: 60 } }}
        >
            <Tabs value={activeTab} onChange={(value) => setActiveTab(value || 'creatives')} mb="md">
                <Tabs.List>
                    <Tabs.Tab value="creatives" leftSection={<IconPhoto size={16} />}>
                        Ad Creatives
                    </Tabs.Tab>
                    {shouldShowLeadTab && (
                        <Tabs.Tab value="leads" leftSection={<IconFileText size={16} />}>
                            Lead Form Creatives
                        </Tabs.Tab>
                    )}
                </Tabs.List>

                {/* Creatives Panel */}
                <Tabs.Panel value="creatives">
                    {loading && (
                        <Center py="xl">
                            <Stack align="center">
                                <Loader />
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
                            <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
                                {creatives.map((creative) => (
                                    <Paper
                                        key={creative.id}
                                        p="xs"
                                        withBorder
                                        style={{
                                            cursor: 'pointer',
                                            borderColor: selectedId === creative.id ? 'var(--mantine-color-blue-6)' : undefined,
                                            borderWidth: selectedId === creative.id ? 2 : 1,
                                            position: 'relative'
                                        }}
                                        onClick={() => handleSelection(creative.id)}
                                    >
                                        {selectedId === creative.id && (
                                            <ThemeIcon color="blue" size="md" radius="xl"
                                                style={{ position: 'absolute', top: 5, right: 5, zIndex: 2 }}>
                                                <IconCheck size={16} />
                                            </ThemeIcon>
                                        )}
                                        <Stack gap="xs">
                                            <AspectRatio ratio={16 / 9}>
                                                <Image
                                                    src={creative.thumbnail_url || 'https://placehold.co/400x225/e6f7ff/0099cc?text=Creative'}
                                                    alt={creative.name || 'Creative'}
                                                    radius="md"
                                                    fit="cover"
                                                />
                                            </AspectRatio>
                                            <Text fw={500} size="sm" lineClamp={1}>{creative.name}</Text>
                                            <Text size="xs" c="dimmed">{`Creative ID: ${creative.id}`}</Text>
                                            <Group justify="space-between">
                                                <Badge color="blue">{creative.object_type || 'Ad Creative'}</Badge>
                                            </Group>
                                        </Stack>
                                    </Paper>
                                ))}
                            </SimpleGrid>

                            {totalPages > 1 && (
                                <Center mt="lg">
                                    <Pagination
                                        total={totalPages}
                                        value={currentPage}
                                        onChange={setCurrentPage}
                                    />
                                </Center>
                            )}
                        </>
                    )}
                </Tabs.Panel>
            </Tabs>

            {/* Action Bar */}
            <Box
                style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    padding: '10px 16px',
                    background: 'white',
                    borderTop: '1px solid var(--mantine-color-gray-3)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    zIndex: 100
                }}
            >
                <Badge size="lg" color="blue">
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