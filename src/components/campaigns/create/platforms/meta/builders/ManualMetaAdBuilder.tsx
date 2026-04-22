'use client';

import '@mantine/dates/styles.css';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    Alert,
    Badge,
    Button,
    Container,
    Grid,
    Group,
    Paper,
    Stack,
    Stepper,
    Text,
    ThemeIcon,
    Title,
} from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import {
    IconAd,
    IconArrowLeft,
    IconArrowRight,
    IconBrush,
    IconCalendar,
    IconInfoCircle,
    IconLayersIntersect,
} from '@tabler/icons-react';
import type { CampaignTreeAdsetNode, CampaignTreeNode } from '@/lib/server/data';
import { useMetaCampaignForm } from '../hooks/useMetaCampaignForm';
import CreativeAssetsStep from '../steps/CreativeAssetsStep';
import ManualMetaAdReview from '../components/ManualMetaAdReview';

interface ManualMetaAdBuilderProps {
    platformData: {
        id: string;
        platform_name: string;
    };
    adAccountId: string;
    existingCampaign: CampaignTreeNode;
    existingAdSet: CampaignTreeAdsetNode;
}

export default function ManualMetaAdBuilder({
    platformData,
    adAccountId,
    existingCampaign,
    existingAdSet,
}: ManualMetaAdBuilderProps) {
    const router = useRouter();
    const form = useMetaCampaignForm(platformData.id, adAccountId, false, null);
    const [active, setActive] = useState(0);
    const initializedKeyRef = useRef<string | null>(null);

    useEffect(() => {
        const initKey = `${existingCampaign.id}:${existingAdSet.id}`;
        if (initializedKeyRef.current === initKey) {
            return;
        }

        initializedKeyRef.current = initKey;
        form.setFieldValue('creationScope', 'ad');
        form.setFieldValue('parentCampaignExternalId', existingCampaign.id);
        form.setFieldValue('parentAdSetExternalId', existingAdSet.id);
        form.setFieldValue('step', 'adset');
        form.setFieldValue('activeAdSetIdx', 0);
        form.setFieldValue('adSetSubStep', 'creative');
        form.setFieldValue('campaign.campaignName', existingCampaign.name);

        if (existingCampaign.objective) {
            form.setFieldValue('campaign.objective', existingCampaign.objective);
        }

        form.setFieldValue('adSets.0.adSetName', existingAdSet.name);
    }, [existingAdSet.id, existingAdSet.name, existingCampaign.id, existingCampaign.name, existingCampaign.objective]);

    const handleBackToStarter = () => {
        router.push('/campaigns/create?scope=ad');
    };

    return (
        <Container size="lg" py="xl">
            <Stack gap="xl">
                <Group justify="apart" align="flex-start">
                    <Stack gap="xs">
                        <Badge w="fit-content" size="lg" variant="light" color="violet">
                            Add Ad
                        </Badge>
                        <Title order={2}>Build a new ad inside {existingAdSet.name}</Title>
                        <Text c="dimmed" maw={760}>
                            This flow keeps the ad set in place and lets you launch a fresh creative with its own timing,
                            so Meta can keep learning from the audience and delivery setup that is already favorable.
                        </Text>
                    </Stack>
                    <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={handleBackToStarter}>
                        Choose a different ad set
                    </Button>
                </Group>

                <Paper withBorder radius="xl" p="lg">
                    <Group gap="md" wrap="wrap">
                        <Group gap="sm">
                            <ThemeIcon color="blue" variant="light" radius="xl">
                                <IconLayersIntersect size={18} />
                            </ThemeIcon>
                            <Stack gap={0}>
                                <Text size="sm" fw={700}>Parent campaign</Text>
                                <Text size="sm" c="dimmed">{existingCampaign.name}</Text>
                            </Stack>
                        </Group>
                        <Group gap="sm">
                            <ThemeIcon color="violet" variant="light" radius="xl">
                                <IconAd size={18} />
                            </ThemeIcon>
                            <Stack gap={0}>
                                <Text size="sm" fw={700}>Target ad set</Text>
                                <Text size="sm" c="dimmed">{existingAdSet.name}</Text>
                            </Stack>
                        </Group>
                        <Badge variant="light" color="gray">
                            {existingAdSet.ads_metrics.length} existing ads
                        </Badge>
                    </Group>
                </Paper>

                <Paper withBorder radius="xl" p="xl">
                    <Stepper
                        id="top"
                        active={active}
                        onStepClick={setActive}
                        allowNextStepsSelect={false}
                        color="violet"
                        iconSize={34}
                    >
                        <Stepper.Step
                            label="Creative"
                            description="Creative and timing"
                            icon={<IconBrush size={18} />}
                        >
                            <Paper withBorder radius="lg" p="md" mb="md">
                                <Stack gap="sm">
                                    <Group gap="sm">
                                        <ThemeIcon color="indigo" variant="light" radius="xl">
                                            <IconCalendar size={18} />
                                        </ThemeIcon>
                                        <Stack gap={2}>
                                            <Text fw={700}>Ad schedule</Text>
                                            <Text size="sm" c="dimmed">
                                                Give this new ad its own launch window while keeping it inside the existing ad set.
                                            </Text>
                                        </Stack>
                                    </Group>

                                    <Grid gutter="md">
                                        <Grid.Col span={{ base: 12, md: 6 }}>
                                            <DateTimePicker
                                                label="Start date"
                                                placeholder="Select date and time"
                                                required
                                                minDate={new Date()}
                                                size="md"
                                                {...form.getInputProps('schedule.startDate')}
                                            />
                                        </Grid.Col>
                                        <Grid.Col span={{ base: 12, md: 6 }}>
                                            <DateTimePicker
                                                label="End date"
                                                placeholder="Optional"
                                                clearable
                                                minDate={form.values.schedule.startDate || new Date()}
                                                size="md"
                                                {...form.getInputProps('schedule.endDate')}
                                            />
                                        </Grid.Col>
                                    </Grid>

                                    <Alert
                                        color="violet"
                                        variant="light"
                                        radius="md"
                                        icon={<IconInfoCircle size={16} />}
                                    >
                                        Use a new start date so this ad launches as a fresh delivery branch inside the ad set that is already working.
                                    </Alert>
                                </Stack>
                            </Paper>

                            <CreativeAssetsStep
                                form={form}
                                platformData={platformData}
                                adAccountId={adAccountId}
                                isSmart={false}
                            />

                            <Group justify="apart" mt="md">
                                <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={handleBackToStarter}>
                                    Back
                                </Button>
                                <Button rightSection={<IconArrowRight size={16} />} onClick={() => setActive(1)}>
                                    Continue to review
                                </Button>
                            </Group>
                        </Stepper.Step>

                        <Stepper.Step
                            label="Review"
                            description="Ready to submit"
                            icon={<IconLayersIntersect size={18} />}
                        >
                            <ManualMetaAdReview
                                values={form.values}
                                campaignName={existingCampaign.name}
                                adSetName={existingAdSet.name}
                                onBack={() => setActive(0)}
                            />
                        </Stepper.Step>
                    </Stepper>
                </Paper>
            </Stack>
        </Container>
    );
}
