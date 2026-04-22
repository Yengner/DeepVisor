'use client';

import {
    Alert,
    Badge,
    Button,
    Card,
    Divider,
    Group,
    Paper,
    SimpleGrid,
    Stack,
    Text,
    ThemeIcon,
    Title,
} from '@mantine/core';
import {
    IconAd,
    IconAlertCircle,
    IconArrowLeft,
    IconBrush,
    IconCalendar,
    IconCheck,
    IconLayersIntersect,
} from '@tabler/icons-react';
import { useCampaignSubmit } from '../hooks/useCampaignSubmit';
import type { CampaignFormValues } from '@/lib/server/actions/meta/types';

interface ManualMetaAdReviewProps {
    values: CampaignFormValues;
    campaignName: string;
    adSetName: string;
    onBack: () => void;
}

function formatDate(value: Date | null): string {
    return value ? new Date(value).toLocaleString() : 'Ongoing';
}

export default function ManualMetaAdReview({
    values,
    campaignName,
    adSetName,
    onBack,
}: ManualMetaAdReviewProps) {
    const {
        submitCampaign,
        isSubmitting,
        submitError,
        submitSuccess,
    } = useCampaignSubmit();

    const currentCreative = values.adSets[0]?.creatives?.[0];

    return (
        <Stack gap="lg">
            <Card withBorder radius="xl" p="xl">
                <Stack gap="lg">
                    <Group justify="apart" align="flex-start">
                        <Stack gap={4}>
                            <Badge w="fit-content" variant="light" color="violet">
                                Add Ad
                            </Badge>
                            <Title order={3}>Review your new ad</Title>
                            <Text c="dimmed">
                                This ad will be attached to <strong>{adSetName}</strong> inside{' '}
                                <strong>{campaignName}</strong> so you can reuse the ad set delivery context.
                            </Text>
                        </Stack>
                        {submitSuccess ? (
                            <ThemeIcon size={42} radius="xl" color="green" variant="light">
                                <IconCheck size={24} />
                            </ThemeIcon>
                        ) : null}
                    </Group>

                    <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                        <Paper withBorder radius="lg" p="md">
                            <Stack gap="sm">
                                <Group gap="sm">
                                    <ThemeIcon color="blue" variant="light" radius="xl">
                                        <IconLayersIntersect size={18} />
                                    </ThemeIcon>
                                    <Text fw={700}>Placement context</Text>
                                </Group>
                                <Text size="sm">{campaignName}</Text>
                                <Text size="sm" c="dimmed">{adSetName}</Text>
                            </Stack>
                        </Paper>

                        <Paper withBorder radius="lg" p="md">
                            <Stack gap="sm">
                                <Group gap="sm">
                                    <ThemeIcon color="indigo" variant="light" radius="xl">
                                        <IconCalendar size={18} />
                                    </ThemeIcon>
                                    <Text fw={700}>Ad schedule</Text>
                                </Group>
                                <Text size="sm">Start: {formatDate(values.schedule.startDate)}</Text>
                                <Text size="sm" c="dimmed">
                                    End: {formatDate(values.schedule.endDate)}
                                </Text>
                            </Stack>
                        </Paper>

                        <Paper withBorder radius="lg" p="md">
                            <Stack gap="sm">
                                <Group gap="sm">
                                    <ThemeIcon color="orange" variant="light" radius="xl">
                                        <IconBrush size={18} />
                                    </ThemeIcon>
                                    <Text fw={700}>Creative</Text>
                                </Group>
                                <Text size="sm">{currentCreative?.adHeadline || 'Headline not set yet'}</Text>
                                <Text size="sm" c="dimmed">
                                    CTA: {currentCreative?.adCallToAction || 'Learn more'}
                                </Text>
                                <Text size="sm" c="dimmed" lineClamp={2}>
                                    {currentCreative?.adPrimaryText || 'Primary text will show here once added.'}
                                </Text>
                            </Stack>
                        </Paper>

                        <Paper withBorder radius="lg" p="md">
                            <Stack gap="sm">
                                <Group gap="sm">
                                    <ThemeIcon color="violet" variant="light" radius="xl">
                                        <IconAd size={18} />
                                    </ThemeIcon>
                                    <Text fw={700}>Why this path</Text>
                                </Group>
                                <Text size="sm" c="dimmed">
                                    This creates a fresh ad inside the existing ad set instead of rebuilding the audience layer from scratch.
                                </Text>
                            </Stack>
                        </Paper>
                    </SimpleGrid>

                    <Divider />

                    {submitSuccess ? (
                        <Alert color="green" radius="lg" title="Submitted">
                            Your ad request has been sent successfully.
                        </Alert>
                    ) : null}

                    {submitError ? (
                        <Alert
                            color="red"
                            radius="lg"
                            title="Submission error"
                            icon={<IconAlertCircle size={16} />}
                        >
                            {submitError}
                        </Alert>
                    ) : null}

                    <Group justify="apart">
                        <Button
                            variant="subtle"
                            leftSection={<IconArrowLeft size={16} />}
                            onClick={onBack}
                        >
                            Back to creative
                        </Button>
                        <Button
                            size="md"
                            loading={isSubmitting}
                            onClick={() => void submitCampaign(values)}
                        >
                            Create ad
                        </Button>
                    </Group>
                </Stack>
            </Card>
        </Stack>
    );
}
