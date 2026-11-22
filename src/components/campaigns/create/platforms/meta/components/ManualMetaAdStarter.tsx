'use client';

import { useEffect, useMemo, useState } from 'react';
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
    IconAd,
    IconArrowLeft,
    IconArrowRight,
    IconBrush,
    IconLayersIntersect,
    IconTargetArrow,
} from '@tabler/icons-react';
import type { CampaignTreeNode } from '@/lib/server/data';
import { useCodeLabels } from '../hooks/useCodeLabels';

interface ManualMetaAdStarterProps {
    campaigns: CampaignTreeNode[];
    initialCampaignId?: string | null;
    initialAdSetId?: string | null;
}

function findCampaignForAdSet(campaigns: CampaignTreeNode[], adSetId: string | null): CampaignTreeNode | null {
    if (!adSetId) {
        return null;
    }

    return campaigns.find((campaign) =>
        campaign.adset_metrics.some((adSet) => adSet.id === adSetId)
    ) ?? null;
}

export default function ManualMetaAdStarter({
    campaigns,
    initialCampaignId = null,
    initialAdSetId = null,
}: ManualMetaAdStarterProps) {
    const router = useRouter();
    const t = useTranslations('createManual.adStarter');
    const codes = useCodeLabels();
    const initialCampaign =
        findCampaignForAdSet(campaigns, initialAdSetId) ??
        (initialCampaignId
            ? campaigns.find((campaign) => campaign.id === initialCampaignId) ?? null
            : null) ??
        campaigns[0] ??
        null;

    const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(
        initialCampaign?.id ?? null
    );
    const [selectedAdSetId, setSelectedAdSetId] = useState<string | null>(() => {
        if (initialAdSetId && initialCampaign?.adset_metrics.some((adSet) => adSet.id === initialAdSetId)) {
            return initialAdSetId;
        }

        return initialCampaign?.adset_metrics[0]?.id ?? null;
    });

    const selectedCampaign = useMemo(
        () => campaigns.find((campaign) => campaign.id === selectedCampaignId) ?? null,
        [campaigns, selectedCampaignId]
    );
    const selectedAdSet = useMemo(
        () => selectedCampaign?.adset_metrics.find((adSet) => adSet.id === selectedAdSetId) ?? null,
        [selectedAdSetId, selectedCampaign]
    );

    useEffect(() => {
        if (!selectedCampaign) {
            setSelectedAdSetId(null);
            return;
        }

        if (!selectedCampaign.adset_metrics.some((adSet) => adSet.id === selectedAdSetId)) {
            setSelectedAdSetId(selectedCampaign.adset_metrics[0]?.id ?? null);
        }
    }, [selectedAdSetId, selectedCampaign]);

    const handleContinue = () => {
        if (!selectedCampaignId || !selectedAdSetId) {
            return;
        }

        const params = new URLSearchParams({
            scope: 'ad',
            campaign_id: selectedCampaignId,
            adset_id: selectedAdSetId,
        });

        router.push(`/campaigns/create?${params.toString()}`);
    };

    return (
        <Container size="lg" py="xl">
            <Stack gap="xl">
                <Stack gap="xs" className="dv-create-hero">
                    <Badge w="fit-content" size="lg" variant="light" color="violet">
                        {t('badge')}
                    </Badge>
                    <Title order={2}>{t('title')}</Title>
                    <Text c="dimmed" maw={760}>
                        {t('intro')}
                    </Text>
                </Stack>

                <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
                    <Card withBorder radius="xl" p="xl">
                        <Stack gap="lg">
                            <Group gap="sm">
                                <ThemeIcon size={42} radius="xl" color="violet" variant="light">
                                    <IconAd size={22} />
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

                            <Select
                                label={t('adSetLabel')}
                                placeholder={t('adSetPlaceholder')}
                                searchable
                                size="md"
                                value={selectedAdSetId}
                                onChange={setSelectedAdSetId}
                                disabled={!selectedCampaign || selectedCampaign.adset_metrics.length === 0}
                                data={(selectedCampaign?.adset_metrics ?? []).map((adSet) => ({
                                    value: adSet.id,
                                    label: adSet.name,
                                }))}
                                nothingFoundMessage={t('noAdSets')}
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
                                    disabled={!selectedCampaignId || !selectedAdSetId}
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
                        {selectedCampaign && selectedAdSet ? (
                            <Stack gap="lg" h="100%">
                                <Group justify="space-between" align="flex-start">
                                    <Stack gap={4}>
                                        <Text size="sm" tt="uppercase" fw={700} c="dimmed" lts="0.08em">
                                            {t('selectedTarget')}
                                        </Text>
                                        <Title order={3}>{selectedAdSet.name}</Title>
                                        <Text size="sm" c="dimmed">
                                            {t('insideCampaign', { campaign: selectedCampaign.name })}
                                        </Text>
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
                                                <Text size="sm" fw={600}>{t('campaignObjective')}</Text>
                                                <Text size="sm" c="dimmed">
                                                    {selectedCampaign.objective ? codes.objective(selectedCampaign.objective) : t('leadGeneration')}
                                                </Text>
                                            </Stack>
                                        </Group>
                                    </Card>

                                    <Card withBorder radius="lg" p="md">
                                        <Group align="flex-start" gap="sm" wrap="nowrap">
                                            <ThemeIcon color="blue" variant="light" radius="xl">
                                                <IconBrush size={18} />
                                            </ThemeIcon>
                                            <Stack gap={2}>
                                                <Text size="sm" fw={600}>{t('existingAds')}</Text>
                                                <Text size="sm" c="dimmed">
                                                    {t('existingAdsCount', { count: selectedAdSet.ads_metrics.length })}
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
