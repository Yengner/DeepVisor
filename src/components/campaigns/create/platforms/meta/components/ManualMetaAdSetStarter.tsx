'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
    Badge,
    Button,
    Card,
    Container,
    Group,
    Select,
    SimpleGrid,
    Stack,
    Text,
    ThemeIcon,
    Title,
} from '@mantine/core';
import {
    IconArrowLeft,
    IconArrowRight,
    IconBriefcase,
    IconLayersIntersect,
    IconTargetArrow,
} from '@tabler/icons-react';
import type { CampaignTreeNode } from '@/lib/server/data';
import { useCodeLabels } from '../hooks/useCodeLabels';

interface ManualMetaAdSetStarterProps {
    campaigns: CampaignTreeNode[];
    initialCampaignId?: string | null;
}

export default function ManualMetaAdSetStarter({
    campaigns,
    initialCampaignId = null,
}: ManualMetaAdSetStarterProps) {
    const router = useRouter();
    const t = useTranslations('createManual.adSetStarter');
    const codes = useCodeLabels();
    const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(
        initialCampaignId && campaigns.some((campaign) => campaign.id === initialCampaignId)
            ? initialCampaignId
            : campaigns[0]?.id ?? null
    );

    const selectedCampaign = useMemo(
        () => campaigns.find((campaign) => campaign.id === selectedCampaignId) ?? null,
        [campaigns, selectedCampaignId]
    );

    const handleContinue = () => {
        if (!selectedCampaignId) {
            return;
        }

        router.push(`/campaigns/create?scope=adset&campaign_id=${selectedCampaignId}`);
    };

    return (
        <Container size="lg" py="xl">
            <Stack gap="xl">
                <Stack gap="xs" className="dv-create-hero">
                    <Badge w="fit-content" size="lg" variant="light" className="app-platform-page-badge">
                        {t('badge')}
                    </Badge>
                    <Title order={2}>{t('title')}</Title>
                    <Text c="dimmed" maw={720}>
                        {t('intro')}
                    </Text>
                </Stack>

                <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
                    <Card withBorder radius="xl" p="xl">
                        <Stack gap="lg">
                            <Group gap="sm">
                                <ThemeIcon size={42} radius="xl" color="blue" variant="light">
                                    <IconLayersIntersect size={22} />
                                </ThemeIcon>
                                <Stack gap={2}>
                                    <Text fw={700}>{t('chooseTitle')}</Text>
                                    <Text size="sm" c="dimmed">
                                        {t('chooseHint')}
                                    </Text>
                                </Stack>
                            </Group>

                            <Select
                                label={t('campaignLabel')}
                                placeholder={t('campaignPlaceholder')}
                                searchable
                                size="md"
                                value={selectedCampaignId}
                                onChange={setSelectedCampaignId}
                                data={campaigns.map((campaign) => ({
                                    value: campaign.id,
                                    label: campaign.name,
                                }))}
                                nothingFoundMessage={t('noCampaigns')}
                            />

                            <Group justify="apart">
                                <Button
                                    variant="subtle"
                                    leftSection={<IconArrowLeft size={16} />}
                                    onClick={() => router.push('/campaigns')}
                                >
                                    {t('backToCampaigns')}
                                </Button>
                                <Button
                                    size="md"
                                    rightSection={<IconArrowRight size={16} />}
                                    disabled={!selectedCampaignId}
                                    onClick={handleContinue}
                                >
                                    {t('continue')}
                                </Button>
                            </Group>
                        </Stack>
                    </Card>

                    <Card
                        withBorder
                        radius="xl"
                        p="xl"
                        style={{
                            background: 'var(--dv-canvas)',
                        }}
                    >
                        {selectedCampaign ? (
                            <Stack gap="lg" h="100%">
                                <Group justify="apart" align="flex-start">
                                    <Stack gap={4}>
                                        <Text size="sm" tt="uppercase" fw={700} c="dimmed" lts="0.08em">
                                            {t('selectedCampaign')}
                                        </Text>
                                        <Title order={3}>{selectedCampaign.name}</Title>
                                    </Stack>
                                    <Badge
                                        variant="light"
                                        color={selectedCampaign.status?.toLowerCase() === 'active' ? 'green' : 'gray'}
                                    >
                                        {selectedCampaign.status ? codes.status(selectedCampaign.status) : t('statusUnavailable')}
                                    </Badge>
                                </Group>

                                <SimpleGrid cols={2} spacing="md">
                                    <Card withBorder radius="lg" p="md">
                                        <Group align="flex-start" gap="sm" wrap="nowrap">
                                            <ThemeIcon color="violet" variant="light" radius="xl">
                                                <IconTargetArrow size={18} />
                                            </ThemeIcon>
                                            <Stack gap={2}>
                                                <Text size="sm" fw={600}>{t('objective')}</Text>
                                                <Text size="sm" c="dimmed">
                                                    {selectedCampaign.objective ? codes.objective(selectedCampaign.objective) : t('leadGeneration')}
                                                </Text>
                                            </Stack>
                                        </Group>
                                    </Card>

                                    <Card withBorder radius="lg" p="md">
                                        <Group align="flex-start" gap="sm" wrap="nowrap">
                                            <ThemeIcon color="blue" variant="light" radius="xl">
                                                <IconBriefcase size={18} />
                                            </ThemeIcon>
                                            <Stack gap={2}>
                                                <Text size="sm" fw={600}>{t('existingAdSets')}</Text>
                                                <Text size="sm" c="dimmed">
                                                    {t('existingAdSetsCount', { count: selectedCampaign.adset_metrics.length })}
                                                </Text>
                                            </Stack>
                                        </Group>
                                    </Card>
                                </SimpleGrid>

                                <Card withBorder radius="lg" p="md" bg="var(--dv-card-panel)">
                                    <Stack gap="xs">
                                        <Text size="sm" fw={700}>
                                            {t('whatNext')}
                                        </Text>
                                        <Text size="sm" c="dimmed">
                                            {t('whatNextBody')}
                                        </Text>
                                    </Stack>
                                </Card>
                            </Stack>
                        ) : (
                            <Stack justify="center" align="center" h="100%" gap="sm">
                                <Text fw={600}>{t('emptyTitle')}</Text>
                                <Text size="sm" c="dimmed" ta="center">
                                    {t('emptyBody')}
                                </Text>
                            </Stack>
                        )}
                    </Card>
                </SimpleGrid>
            </Stack>
        </Container>
    );
}
