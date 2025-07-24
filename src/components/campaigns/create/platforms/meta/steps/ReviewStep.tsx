'use client';

import {
    Card, Group, Paper, Stack, Text, ThemeIcon, Title, Divider, Box,
    Badge, Button, Grid, Timeline, Alert, Progress,
    List, Tooltip, SimpleGrid, Table, Accordion, Avatar
} from '@mantine/core';
import {
    IconCheck, IconX, IconInfoCircle, IconBrandFacebook, IconBrandInstagram,
    IconCalendar, IconMapPin, IconUsers, IconTargetArrow, IconCurrencyDollar,
    IconPhoto, IconBulb, IconRocket, IconAd, IconChartBar, IconChartPie,
    IconSettings, IconEditCircle, IconMessageCircle, IconDeviceImac,
    IconBuildingStore, IconUser, IconEdit, IconListDetails
} from '@tabler/icons-react';
import { UseFormReturnType } from '@mantine/form';
import { CampaignFormValues } from '@/lib/actions/meta/types';
import { useCampaignSubmit } from '../hooks/useCampaignSubmit';
import { ProgressModal } from '../components/ProgressModal';
import { useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';

interface ReviewStepProps {
    form: UseFormReturnType<CampaignFormValues>;
    setActive: (step: number) => void;
    isSmart?: boolean;
}

/**
 * Campaign Review step
 * Provides a comprehensive overview of all campaign settings before submission
 */
export default function ReviewStep({ form, setActive, isSmart = false }: ReviewStepProps) {
    const {
        submitCampaign,
        isSubmitting,
        submitError,
        submitSuccess,
        jobId,
        showProgressModal,
        setShowProgressModal,
        resetSubmission,
        progressNodes,
        progressEdges
    } = useCampaignSubmit();



    // Calculate estimated reach based on budget
    const getEstimatedReach = (budget: number) => {
        const minReach = Math.floor(budget * 200);
        const maxReach = Math.floor(budget * 650);
        return { min: minReach, max: maxReach };
    };

    const estimatedReach = getEstimatedReach(form.values.budget.amount);

    // Calculate total days of campaign
    const getTotalDays = () => {
        if (!form.values.schedule.startDate) return 'N/A';
        if (!form.values.schedule.endDate) return 'Ongoing';

        const start = new Date(form.values.schedule.startDate);
        const end = new Date(form.values.schedule.endDate);
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    };

    // Calculate total campaign budget
    const getTotalBudget = () => {
        const days = getTotalDays();
        if (days === 'N/A' || days === 'Ongoing') return 'Varies';
        if (form.values.budget.type === 'lifetime') return form.values.budget.amount;
        return form.values.budget.amount * Number(days);
    };

    // Handle campaign submission
    const handleSubmit = async () => {
        await submitCampaign(form.values);
    };

    // Helper: Render creatives for an ad set
    const renderCreatives = (adSet: any) => (
        <Stack gap="xs" mt="xs">
            {(adSet.creatives || []).length === 0 ? (
                <Text size="xs" c="dimmed">No creatives added.</Text>
            ) : (
                adSet.creatives.map((creative: any, idx: number) => (
                    <Paper key={idx} withBorder p="sm" radius="md" bg="violet.0">
                        <Group align="flex-start" gap="sm">
                            <ThemeIcon color="violet" size="sm" variant="light">
                                <IconPhoto size={14} />
                            </ThemeIcon>
                            <Stack gap={2} style={{ flex: 1 }}>
                                <Group gap={4}>
                                    <Text size="xs" fw={500}>Headline:</Text>
                                    <Text size="xs" lineClamp={1}>{creative.adHeadline || "Not set"}</Text>
                                </Group>
                                <Group gap={4}>
                                    <Text size="xs" fw={500}>Primary Text:</Text>
                                    <Text size="xs" lineClamp={1}>{creative.adPrimaryText || "Not set"}</Text>
                                </Group>
                                <Group gap={4}>
                                    <Text size="xs" fw={500}>Description:</Text>
                                    <Text size="xs" lineClamp={1}>{creative.adDescription || "Not set"}</Text>
                                </Group>
                                <Group gap={4}>
                                    <Text size="xs" fw={500}>Destination:</Text>
                                    <Text size="xs">{form.values.campaign.destinationType || "N/A"}</Text>
                                </Group>
                                <Group gap={4}>
                                    <Text size="xs" fw={500}>Media:</Text>
                                    <Text size="xs">
                                        {creative.contentSource === 'upload'
                                            ? `${creative.uploadedFiles?.length || 0} uploaded`
                                            : creative.contentSource === 'existing'
                                                ? `${creative.existingCreativeIds?.length || 0} existing`
                                                : 'AI optimized'}
                                    </Text>
                                </Group>
                            </Stack>
                        </Group>
                    </Paper>
                ))
            )}
        </Stack>
    );

    // Helper: Render ad sets and their creatives
    const renderAdSets = () => (
        <Accordion variant="contained" radius="md" defaultValue={form.values.adSets?.length ? `adset-0` : undefined}>
            {(form.values.adSets || []).map((adSet: any, idx: number) => (
                <Accordion.Item key={idx} value={`adset-${idx}`}>
                    <Accordion.Control icon={<IconListDetails size={18} />}>
                        <Group gap={8}>
                            <Text fw={500} size="sm">{adSet.adSetName || `Ad Set #${idx + 1}`}</Text>
                            <Badge size="xs" color="orange" variant="light">{adSet.optimization_goal}</Badge>
                        </Group>
                    </Accordion.Control>
                    <Accordion.Panel>
                        <Stack gap="xs">
                            <Group gap={8}>
                                <ThemeIcon size="xs" color="orange" variant="light"><IconTargetArrow size={12} /></ThemeIcon>
                                <Text size="xs" fw={500}>Audience:</Text>
                                <Text size="xs">{adSet.useAdvantageAudience ? "Meta Advantage" : "Custom"}</Text>
                            </Group>
                            {!adSet.useAdvantageAudience && (
                                <>
                                    <Group gap={8}>
                                        <ThemeIcon size="xs" color="blue" variant="light"><IconUser size={12} /></ThemeIcon>
                                        <Text size="xs" fw={500}>Age:</Text>
                                        <Text size="xs">{adSet.targeting.age.min} - {adSet.targeting.age.max}</Text>
                                    </Group>
                                    <Group gap={8}>
                                        <ThemeIcon size="xs" color="blue" variant="light"><IconMapPin size={12} /></ThemeIcon>
                                        <Text size="xs" fw={500}>Location:</Text>
                                        <Text size="xs">
                                            {adSet.targeting.location?.markerPosition
                                                ? `${adSet.targeting.location.radius || 10}km radius`
                                                : "Not specified"}
                                        </Text>
                                    </Group>
                                </>
                            )}
                            <Group gap={8}>
                                <ThemeIcon size="xs" color="green" variant="light"><IconCurrencyDollar size={12} /></ThemeIcon>
                                <Text size="xs" fw={500}>Budget:</Text>
                                <Text size="xs">{form.values.budget.amount} ({form.values.budget.type})</Text>
                            </Group>
                            <Group gap={8}>
                                <ThemeIcon size="xs" color="indigo" variant="light"><IconCalendar size={12} /></ThemeIcon>
                                <Text size="xs" fw={500}>Schedule:</Text>
                                <Text size="xs">
                                    {form.values.schedule.startDate ? new Date(form.values.schedule.startDate).toLocaleDateString() : "Not set"}
                                    {" - "}
                                    {form.values.schedule.endDate ? new Date(form.values.schedule.endDate).toLocaleDateString() : "Ongoing"}
                                </Text>
                            </Group>
                            {/* Creatives */}
                            <Divider my="xs" />
                            <Text size="xs" fw={500} c="violet">Creatives</Text>
                            {renderCreatives(adSet)}
                        </Stack>
                    </Accordion.Panel>
                </Accordion.Item>
            ))}
        </Accordion>
    );

    return (
        <>
            <Grid gutter="md">
                {/* Left column - Campaign summary */}
                <Grid.Col span={{ base: 12, md: 8 }}>
                    <Card p="md" withBorder radius="md" mb="md" mt="lg" shadow="xs">
                        <Stack>
                            <Group justify="apart">
                                <Stack gap={0}>
                                    <Title order={4}>Campaign Review</Title>
                                    <Text size="sm" c="dimmed">
                                        Review your campaign settings before launching
                                    </Text>
                                </Stack>
                                <ThemeIcon size={42} radius="md" color="blue" variant="light">
                                    <IconRocket size={24} />
                                </ThemeIcon>
                            </Group>
                            <Divider my="md" />

                            {/* Campaign Details */}
                            <Paper withBorder p="md" radius="md" shadow="xs" mb="md">
                                <Group mb="xs">
                                    <ThemeIcon size="md" variant="filled" radius="md" color="blue">
                                        <IconAd size={16} />
                                    </ThemeIcon>
                                    <Title order={5}>Campaign Details</Title>
                                    <Button
                                        variant="subtle"
                                        size="compact-xs"
                                        onClick={() => setActive(1)}
                                        ml="auto"
                                    >
                                        Edit
                                    </Button>
                                </Group>
                                <Divider mb="sm" />
                                <SimpleGrid cols={2} spacing="xs">
                                    <Stack gap={2}>
                                        <Group gap={4}>
                                            <Text size="xs" c="dimmed">Name:</Text>
                                            <Text size="xs" fw={500}>{form.values.campaign.campaignName || "Unnamed Campaign"}</Text>
                                        </Group>
                                        <Group gap={4}>
                                            <Text size="xs" c="dimmed">Objective:</Text>
                                            <Badge size="xs">{form.values.campaign.objective}</Badge>
                                        </Group>
                                        <Group gap={4}>
                                            <Text size="xs" c="dimmed">Page:</Text>
                                            <Group gap={4}>
                                                <ThemeIcon size="xs" radius="xl">
                                                    <IconBrandFacebook size={10} />
                                                </ThemeIcon>
                                                <Text size="xs" fw={500}>
                                                    {(form.values.adSets[0]?.page_id) || "Not selected"}
                                                </Text>
                                            </Group>
                                        </Group>
                                        <Group gap={4}>
                                            <Text size="xs" c="dimmed">Platform:</Text>
                                            <Group gap={4}>
                                                <ThemeIcon size="xs" color="blue" radius="xl">
                                                    <IconBrandFacebook size={10} />
                                                </ThemeIcon>
                                                {form.values.adSets[0]?.useAdvantagePlacements && (
                                                    <ThemeIcon size="xs" color="grape" radius="xl">
                                                        <IconBrandInstagram size={10} />
                                                    </ThemeIcon>
                                                )}
                                            </Group>
                                        </Group>
                                    </Stack>
                                    <Stack gap={2}>
                                        <Group gap={4}>
                                            <Text size="xs" c="dimmed">Budget Type:</Text>
                                            <Text size="xs" fw={500}>
                                                {form.values.budget.type === 'daily' ? 'Daily' : 'Lifetime'} Budget
                                            </Text>
                                        </Group>
                                        <Group gap={4}>
                                            <Text size="xs" c="dimmed">Amount:</Text>
                                            <Badge size="xs" color="green">{form.values.budget.amount}</Badge>
                                            <Text size="xs" c="dimmed">per {form.values.budget.type === 'daily' ? 'day' : 'campaign'}</Text>
                                        </Group>
                                        <Group gap={4}>
                                            <Text size="xs" c="dimmed">Duration:</Text>
                                            <Text size="xs" fw={500}>{getTotalDays()} days</Text>
                                        </Group>
                                        <Group gap={4}>
                                            <Text size="xs" c="dimmed">Total Est. Spend:</Text>
                                            <Badge size="xs" color="green">{getTotalBudget()}</Badge>
                                        </Group>
                                    </Stack>
                                </SimpleGrid>
                            </Paper>

                            {/* Ad Sets & Creatives */}
                            <Paper withBorder p="md" radius="md" shadow="xs" mb="md">
                                <Group mb="xs">
                                    <ThemeIcon size="md" variant="filled" radius="md" color="orange">
                                        <IconListDetails size={16} />
                                    </ThemeIcon>
                                    <Title order={5}>Ad Sets & Creatives</Title>
                                    <Button
                                        variant="subtle"
                                        size="compact-xs"
                                        onClick={() => setActive(2)}
                                        ml="auto"
                                    >
                                        Edit
                                    </Button>
                                </Group>
                                <Divider mb="sm" />
                                {renderAdSets()}
                            </Paper>

                            {/* Campaign Timeline */}
                            <Paper withBorder p="md" radius="md" shadow="xs">
                                <Group mb="md">
                                    <ThemeIcon size="md" variant="filled" radius="md" color="indigo">
                                        <IconCalendar size={16} />
                                    </ThemeIcon>
                                    <Title order={5}>Campaign Timeline</Title>
                                </Group>

                                <Timeline active={1} bulletSize={24} lineWidth={2}>
                                    <Timeline.Item bullet={<IconRocket size={12} />} title="Campaign Creation">
                                        <Text size="sm" c="dimmed">Today</Text>
                                        <Text size="xs" mt={4}>
                                            Campaign setup and configuration
                                        </Text>
                                    </Timeline.Item>

                                    <Timeline.Item bullet={<IconBulb size={12} />} title="Review Period">
                                        <Text size="sm" c="dimmed">24-48 hours</Text>
                                        <Text size="xs" mt={4}>
                                            Meta reviews your ad for policy compliance
                                        </Text>
                                    </Timeline.Item>

                                    <Timeline.Item bullet={<IconChartBar size={12} />} title="Campaign Active">
                                        <Text size="sm" c="dimmed">
                                            {form.values.schedule.startDate
                                                ? new Date(form.values.schedule.startDate).toLocaleDateString()
                                                : "Not scheduled"}
                                        </Text>
                                        <Text size="xs" mt={4}>
                                            Campaign begins delivering ads to your audience
                                        </Text>
                                    </Timeline.Item>

                                    <Timeline.Item bullet={<IconSettings size={12} />} title="Optimization Phase">
                                        <Text size="sm" c="dimmed">Ongoing</Text>
                                        <Text size="xs" mt={4}>
                                            Campaign performance is monitored and optimized
                                        </Text>
                                    </Timeline.Item>

                                    {form.values.schedule.endDate && (
                                        <Timeline.Item bullet={<IconCheck size={12} />} title="Campaign End">
                                            <Text size="sm" c="dimmed">
                                                {new Date(form.values.schedule.endDate).toLocaleDateString()}
                                            </Text>
                                            <Text size="xs" mt={4}>
                                                Campaign concludes, final reports available
                                            </Text>
                                        </Timeline.Item>
                                    )}
                                </Timeline>
                            </Paper>
                        </Stack>
                    </Card>
                </Grid.Col>

                {/* Right column - performance estimates and action buttons */}
                <Grid.Col span={{ base: 12, md: 4 }}>
                    <Box style={{ position: 'sticky', top: '20px' }}>
                        <Card p="md" withBorder radius="md" mb="md" mt="lg" shadow="xs">
                            <Stack>
                                <Group mb="md" justify="apart">
                                    <Title order={4}>Campaign Estimates</Title>
                                    <ThemeIcon size="md" radius="md" color="blue" variant="light">
                                        <IconChartPie size={18} />
                                    </ThemeIcon>
                                </Group>

                                {/* Performance Estimates */}
                                <Paper withBorder radius="md" p="md">
                                    <Group justify="apart" mb="xs">
                                        <Text fw={500} size="sm">Estimated Daily Reach</Text>
                                        <Tooltip label="Number of unique people who will see your ads">
                                            <ThemeIcon color="gray" variant="light" size="sm" radius="xl">
                                                <IconInfoCircle size={14} />
                                            </ThemeIcon>
                                        </Tooltip>
                                    </Group>
                                    <Group justify="apart">
                                        <Text size="xl" fw={700}>
                                            {estimatedReach.min.toLocaleString()} - {estimatedReach.max.toLocaleString()}
                                        </Text>
                                        <Badge color="blue" size="lg">People</Badge>
                                    </Group>
                                    <Text size="xs" c="dimmed" mt="xs">
                                        Based on your {form.values.budget.amount} {form.values.budget.type} budget
                                    </Text>
                                </Paper>

                                {/* Key Metrics */}
                                <Paper withBorder radius="md" p="md">
                                    <Text fw={500} size="sm" mb="md">Estimated Performance</Text>

                                    <Stack gap="xs">
                                        <Box>
                                            <Group justify="apart">
                                                <Text size="xs" fw={500}>CTR (Click-Through Rate)</Text>
                                                <Text size="xs" fw={700}>1.8% - 2.4%</Text>
                                            </Group>
                                            <Progress
                                                value={40}
                                                color="blue"
                                                size="sm"
                                                mt={4}
                                            />
                                        </Box>

                                        <Box>
                                            <Group justify="apart">
                                                <Text size="xs" fw={500}>Estimated CPC</Text>
                                                <Text size="xs" fw={700}>{0.58} - {0.82}</Text>
                                            </Group>
                                            <Progress
                                                value={65}
                                                color="green"
                                                size="sm"
                                                mt={4}
                                            />
                                        </Box>

                                        <Box>
                                            <Group justify="apart">
                                                <Text size="xs" fw={500}>Conversion Rate</Text>
                                                <Text size="xs" fw={700}>2.1% - 3.5%</Text>
                                            </Group>
                                            <Progress
                                                value={55}
                                                color="violet"
                                                size="sm"
                                                mt={4}
                                            />
                                        </Box>
                                    </Stack>

                                    <Text size="xs" c="dimmed" mt="md" ta="center">
                                        Estimates based on similar campaigns in your industry
                                    </Text>
                                </Paper>

                                {/* Budget Summary */}
                                <Paper withBorder radius="md" p="md" bg="blue.0">
                                    <Group mb="xs">
                                        <ThemeIcon size="sm" color="green" radius="xl">
                                            <IconCurrencyDollar size={14} />
                                        </ThemeIcon>
                                        <Text fw={500} size="sm">Budget Summary</Text>
                                    </Group>

                                    <Table striped highlightOnHover withTableBorder={false} withColumnBorders={false}>
                                        <Table.Tbody>
                                            <Table.Tr>
                                                <Table.Td>
                                                    <Text size="xs">Daily Budget</Text>
                                                </Table.Td>
                                                <Table.Td align="right">
                                                    <Text size="xs" fw={500}>
                                                        {form.values.budget.type === 'daily'
                                                            ? form.values.budget.amount
                                                            : 'Varies'}
                                                    </Text>
                                                </Table.Td>
                                            </Table.Tr>
                                            <Table.Tr>
                                                <Table.Td>
                                                    <Text size="xs">Campaign Duration</Text>
                                                </Table.Td>
                                                <Table.Td align="right">
                                                    <Text size="xs" fw={500}>
                                                        {getTotalDays()} days
                                                    </Text>
                                                </Table.Td>
                                            </Table.Tr>
                                            <Table.Tr>
                                                <Table.Td>
                                                    <Text size="xs" fw={500}>Total Budget</Text>
                                                </Table.Td>
                                                <Table.Td align="right">
                                                    <Text size="xs" fw={700}>
                                                        {getTotalBudget()}
                                                    </Text>
                                                </Table.Td>
                                            </Table.Tr>
                                        </Table.Tbody>
                                    </Table>
                                </Paper>

                                {/* Action Buttons */}
                                <Stack mt="md">
                                    <Button
                                        color="blue"
                                        fullWidth
                                        size="md"
                                        leftSection={<IconRocket size={20} />}
                                        disabled={isSubmitting}
                                        onClick={handleSubmit}
                                        loading={isSubmitting}
                                    >
                                        {isSubmitting ? 'Launching Campaign...' : 'Launch Campaign'}
                                    </Button>

                                    <Button
                                        variant="light"
                                        fullWidth
                                        onClick={() => setActive(0)}
                                    >
                                        Review Settings
                                    </Button>

                                    {submitSuccess && (
                                        <Alert color="green" icon={<IconCheck size={16} />} title="Campaign Created Successfully">
                                            Your campaign has been submitted to Meta for review.
                                        </Alert>
                                    )}

                                    {submitError && (
                                        <Alert color="red" icon={<IconX size={16} />} title="Error Creating Campaign">
                                            {submitError}
                                        </Alert>
                                    )}
                                </Stack>
                            </Stack>
                        </Card>
                    </Box>
                </Grid.Col>
            </Grid>
            {/* Show progress modal when showProgressModal is true and jobId exists */}
            {showProgressModal && jobId && progressEdges && progressNodes && (
                <ProgressModal
                    jobId={jobId}
                    opened={showProgressModal}
                    onClose={() => setShowProgressModal(false)}
                    nodes={progressNodes}
                    edges={progressEdges} />

            )}
        </>
    );
}