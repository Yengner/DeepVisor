'use client';

import { useMemo, useState } from 'react';
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
    IconArrowLeft,
    IconArrowRight,
    IconBriefcase,
    IconLayersIntersect,
    IconTargetArrow,
} from '@tabler/icons-react';
import type { CampaignTreeNode } from '@/lib/server/data';

interface ManualMetaAdSetStarterProps {
    campaigns: CampaignTreeNode[];
    initialCampaignId?: string | null;
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

export default function ManualMetaAdSetStarter({
    campaigns,
    initialCampaignId = null,
}: ManualMetaAdSetStarterProps) {
    const router = useRouter();
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
                <Stack gap="xs">
                    <Badge w="fit-content" size="lg" variant="light" color="blue">
                        Meta Ad Set Builder
                    </Badge>
                    <Title order={2}>Add a new ad set inside an existing campaign</Title>
                    <Text c="dimmed" maw={720}>
                        Choose the campaign you want to build inside first. DeepVisor will then open
                        a focused ad set flow so you can dial in targeting and add the first creative
                        without stepping through the full campaign wizard.
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
                                    <Text fw={700}>Choose the parent campaign</Text>
                                    <Text size="sm" c="dimmed">
                                        Your new ad set and its first creative will live inside this
                                        existing campaign.
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
                                    disabled={!selectedCampaignId}
                                    onClick={handleContinue}
                                >
                                    Continue to ad set form
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
                                'linear-gradient(180deg, rgba(246,249,255,0.92) 0%, rgba(255,255,255,0.98) 100%)',
                        }}
                    >
                        {selectedCampaign ? (
                            <Stack gap="lg" h="100%">
                                <Group justify="apart" align="flex-start">
                                    <Stack gap={4}>
                                        <Text size="sm" tt="uppercase" fw={700} c="dimmed" lts="0.08em">
                                            Selected campaign
                                        </Text>
                                        <Title order={3}>{selectedCampaign.name}</Title>
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
                                                <Text size="sm" fw={600}>Objective</Text>
                                                <Text size="sm" c="dimmed">
                                                    {formatObjective(selectedCampaign.objective)}
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
                                                <Text size="sm" fw={600}>Existing ad sets</Text>
                                                <Text size="sm" c="dimmed">
                                                    {selectedCampaign.adset_metrics.length} currently inside this campaign
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
                                            You will go straight into the ad set builder with this
                                            campaign already chosen, then add the first creative for
                                            the new ad set before review.
                                        </Text>
                                    </Stack>
                                </Card>
                            </Stack>
                        ) : (
                            <Stack justify="center" align="center" h="100%" gap="sm">
                                <Text fw={600}>No campaign selected yet</Text>
                                <Text size="sm" c="dimmed" ta="center">
                                    Pick a campaign on the left and the builder preview will update here.
                                </Text>
                            </Stack>
                        )}
                    </Card>
                </SimpleGrid>
            </Stack>
        </Container>
    );
}
