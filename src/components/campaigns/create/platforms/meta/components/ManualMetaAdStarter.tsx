'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
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

interface ManualMetaAdStarterProps {
    campaigns: CampaignTreeNode[];
    initialCampaignId?: string | null;
    initialAdSetId?: string | null;
}

function formatObjective(value: string | null): string {
    if (!value) {
        return 'Lead generation';
    }

    return value
        .toLowerCase()
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
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
                <Stack gap="xs">
                    <Badge w="fit-content" size="lg" variant="light" color="violet">
                        Meta Ad Builder
                    </Badge>
                    <Title order={2}>Add a new ad inside an existing ad set</Title>
                    <Text c="dimmed" maw={760}>
                        Pick the campaign and ad set that already have favorable delivery, then add a
                        fresh creative without resetting the ad set context you want Meta to keep learning from.
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
                                    <Text fw={700}>Choose where the new ad should live</Text>
                                    <Text size="sm" c="dimmed">
                                        The new creative will be attached to the selected ad set and launched with its own schedule.
                                    </Text>
                                </Stack>
                            </Group>

                            <Select
                                label="Existing campaign"
                                placeholder="Pick a campaign"
                                searchable
                                size="md"
                                value={selectedCampaignId}
                                onChange={setSelectedCampaignId}
                                data={campaigns.map((campaign) => ({
                                    value: campaign.id,
                                    label: campaign.name,
                                }))}
                                nothingFoundMessage="No campaigns found for this ad account"
                            />

                            <Select
                                label="Existing ad set"
                                placeholder="Pick an ad set"
                                searchable
                                size="md"
                                value={selectedAdSetId}
                                onChange={setSelectedAdSetId}
                                disabled={!selectedCampaign || selectedCampaign.adset_metrics.length === 0}
                                data={(selectedCampaign?.adset_metrics ?? []).map((adSet) => ({
                                    value: adSet.id,
                                    label: adSet.name,
                                }))}
                                nothingFoundMessage="No ad sets found in this campaign"
                            />

                            <Group justify="apart">
                                <Button
                                    variant="subtle"
                                    leftSection={<IconArrowLeft size={16} />}
                                    onClick={() => router.push('/campaigns')}
                                >
                                    Back to campaigns
                                </Button>
                                <Button
                                    size="md"
                                    rightSection={<IconArrowRight size={16} />}
                                    disabled={!selectedCampaignId || !selectedAdSetId}
                                    onClick={handleContinue}
                                >
                                    Continue to ad form
                                </Button>
                            </Group>
                        </Stack>
                    </Card>

                    <Card
                        withBorder
                        radius="xl"
                        p="xl"
                        style={{
                            background:
                                'linear-gradient(180deg, rgba(248,246,255,0.94) 0%, rgba(255,255,255,0.98) 100%)',
                        }}
                    >
                        {selectedCampaign && selectedAdSet ? (
                            <Stack gap="lg" h="100%">
                                <Group justify="space-between" align="flex-start">
                                    <Stack gap={4}>
                                        <Text size="sm" tt="uppercase" fw={700} c="dimmed" lts="0.08em">
                                            Selected target
                                        </Text>
                                        <Title order={3}>{selectedAdSet.name}</Title>
                                        <Text size="sm" c="dimmed">
                                            Inside {selectedCampaign.name}
                                        </Text>
                                    </Stack>
                                    <Badge
                                        variant="light"
                                        color={selectedCampaign.status?.toLowerCase() === 'active' ? 'green' : 'gray'}
                                    >
                                        {selectedCampaign.status ?? 'Status unavailable'}
                                    </Badge>
                                </Group>

                                <SimpleGrid cols={2} spacing="md">
                                    <Card withBorder radius="lg" p="md">
                                        <Group align="flex-start" gap="sm" wrap="nowrap">
                                            <ThemeIcon color="violet" variant="light" radius="xl">
                                                <IconTargetArrow size={18} />
                                            </ThemeIcon>
                                            <Stack gap={2}>
                                                <Text size="sm" fw={600}>Campaign objective</Text>
                                                <Text size="sm" c="dimmed">
                                                    {formatObjective(selectedCampaign.objective)}
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
                                                <Text size="sm" fw={600}>Existing ads</Text>
                                                <Text size="sm" c="dimmed">
                                                    {selectedAdSet.ads_metrics.length} already attached to this ad set
                                                </Text>
                                            </Stack>
                                        </Group>
                                    </Card>
                                </SimpleGrid>

                                <Card withBorder radius="lg" p="md" bg="white">
                                    <Stack gap="xs">
                                        <Text size="sm" fw={700}>
                                            What happens next
                                        </Text>
                                        <Text size="sm" c="dimmed">
                                            You will choose either a new or existing creative, set the launch dates,
                                            and send one more ad into this ad set so Meta can keep learning from the
                                            delivery history that is already working.
                                        </Text>
                                    </Stack>
                                </Card>
                            </Stack>
                        ) : (
                            <Stack justify="center" align="center" h="100%" gap="sm">
                                <Text fw={600}>No ad set selected yet</Text>
                                <Text size="sm" c="dimmed" ta="center">
                                    Choose the campaign and ad set on the left to preview where the new ad will go.
                                </Text>
                            </Stack>
                        )}
                    </Card>
                </SimpleGrid>
            </Stack>
        </Container>
    );
}
