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
    IconAlertCircle,
    IconArrowLeft,
    IconBrush,
    IconCheck,
    IconLayersIntersect,
    IconTargetArrow,
} from '@tabler/icons-react';
import { useCampaignSubmit } from '../hooks/useCampaignSubmit';
import type { CampaignFormValues } from '@/lib/server/actions/meta/types';

interface ManualMetaAdSetReviewProps {
    values: CampaignFormValues;
    campaignName: string;
    onBack: () => void;
}

function formatObjective(value: string): string {
    return value
        .toLowerCase()
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

export default function ManualMetaAdSetReview({
    values,
    campaignName,
    onBack,
}: ManualMetaAdSetReviewProps) {
    const {
        submitCampaign,
        isSubmitting,
        submitError,
        submitSuccess,
    } = useCampaignSubmit();

    const currentAdSet = values.adSets[0];
    const currentCreative = currentAdSet?.creatives?.[0];

    return (
        <Stack gap="lg">
            <Card withBorder radius="xl" p="xl">
                <Stack gap="lg">
                    <Group justify="apart" align="flex-start">
                        <Stack gap={4}>
                            <Badge w="fit-content" variant="light" color="blue">
                                Add Ad Set
                            </Badge>
                            <Title order={3}>Review your new ad set</Title>
                            <Text c="dimmed">
                                This will be attached to <strong>{campaignName}</strong> and will include
                                its first creative from this form.
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
                                    <Text fw={700}>Campaign context</Text>
                                </Group>
                                <Text size="sm">{campaignName}</Text>
                                <Text size="sm" c="dimmed">
                                    Objective: {formatObjective(values.campaign.objective)}
                                </Text>
                            </Stack>
                        </Paper>

                        <Paper withBorder radius="lg" p="md">
                            <Stack gap="sm">
                                <Group gap="sm">
                                    <ThemeIcon color="violet" variant="light" radius="xl">
                                        <IconTargetArrow size={18} />
                                    </ThemeIcon>
                                    <Text fw={700}>Ad set setup</Text>
                                </Group>
                                <Text size="sm">{currentAdSet?.adSetName || 'Untitled ad set'}</Text>
                                <Text size="sm" c="dimmed">
                                    Optimization: {currentAdSet?.optimization_goal || 'Not selected'}
                                </Text>
                                <Text size="sm" c="dimmed">
                                    Placements: {currentAdSet?.useAdvantagePlacements ? 'Advantage+' : 'Manual'}
                                </Text>
                            </Stack>
                        </Paper>

                        <Paper withBorder radius="lg" p="md">
                            <Stack gap="sm">
                                <Group gap="sm">
                                    <ThemeIcon color="orange" variant="light" radius="xl">
                                        <IconBrush size={18} />
                                    </ThemeIcon>
                                    <Text fw={700}>First creative</Text>
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
                                <Text fw={700}>Budget context</Text>
                                <Text size="sm">
                                    ${values.budget.amount.toFixed(2)} {values.budget.type} budget
                                </Text>
                                <Text size="sm" c="dimmed">
                                    This flow keeps the new ad set tied to the parent campaign while
                                    you focus on targeting and creative.
                                </Text>
                            </Stack>
                        </Paper>
                    </SimpleGrid>

                    <Divider />

                    {submitSuccess ? (
                        <Alert color="green" radius="lg" title="Submitted">
                            Your ad set request has been sent successfully.
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
                            Create ad set
                        </Button>
                    </Group>
                </Stack>
            </Card>
        </Stack>
    );
}
