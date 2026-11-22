'use client';

import { useLocale, useTranslations } from 'next-intl';
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

    const t = useTranslations('createManual.adReview');
    const tc = useTranslations('createManual.common');
    const intl = useLocale() === 'es' ? 'es-US' : 'en-US';
    const formatDate = (value: Date | null): string =>
        value ? new Date(value).toLocaleString(intl) : tc('ongoing');

    const currentCreative = values.adSets[0]?.creatives?.[0];

    return (
        <Stack gap="lg">
            <Card withBorder radius="xl" p="xl">
                <Stack gap="lg">
                    <Group justify="apart" align="flex-start">
                        <Stack gap={4}>
                            <Badge w="fit-content" variant="light" color="violet">
                                {t('badge')}
                            </Badge>
                            <Title order={3}>{t('title')}</Title>
                            <Text c="dimmed">
                                {t.rich('intro', {
                                    adSet: adSetName,
                                    campaign: campaignName,
                                    b: (chunks) => <strong>{chunks}</strong>,
                                })}
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
                                    <Text fw={700}>{t('placementContext')}</Text>
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
                                    <Text fw={700}>{tc('adSchedule')}</Text>
                                </Group>
                                <Text size="sm">{t('start', { date: formatDate(values.schedule.startDate) })}</Text>
                                <Text size="sm" c="dimmed">
                                    {t('end', { date: formatDate(values.schedule.endDate) })}
                                </Text>
                            </Stack>
                        </Paper>

                        <Paper withBorder radius="lg" p="md">
                            <Stack gap="sm">
                                <Group gap="sm">
                                    <ThemeIcon color="orange" variant="light" radius="xl">
                                        <IconBrush size={18} />
                                    </ThemeIcon>
                                    <Text fw={700}>{tc('creative')}</Text>
                                </Group>
                                <Text size="sm">{currentCreative?.adHeadline || tc('headlineEmpty')}</Text>
                                <Text size="sm" c="dimmed">
                                    {tc('ctaLine', { value: currentCreative?.adCallToAction || tc('ctaDefault') })}
                                </Text>
                                <Text size="sm" c="dimmed" lineClamp={2}>
                                    {currentCreative?.adPrimaryText || tc('primaryTextEmpty')}
                                </Text>
                            </Stack>
                        </Paper>

                        <Paper withBorder radius="lg" p="md">
                            <Stack gap="sm">
                                <Group gap="sm">
                                    <ThemeIcon color="violet" variant="light" radius="xl">
                                        <IconAd size={18} />
                                    </ThemeIcon>
                                    <Text fw={700}>{t('whyThisPath')}</Text>
                                </Group>
                                <Text size="sm" c="dimmed">
                                    {t('whyThisPathBody')}
                                </Text>
                            </Stack>
                        </Paper>
                    </SimpleGrid>

                    <Divider />

                    {submitSuccess ? (
                        <Alert color="green" radius="lg" title={tc('submittedTitle')}>
                            {t('submittedBody')}
                        </Alert>
                    ) : null}

                    {submitError ? (
                        <Alert
                            color="red"
                            radius="lg"
                            title={tc('submissionError')}
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
                            {tc('backToCreative')}
                        </Button>
                        <Button
                            size="md"
                            loading={isSubmitting}
                            onClick={() => void submitCampaign(values)}
                        >
                            {t('create')}
                        </Button>
                    </Group>
                </Stack>
            </Card>
        </Stack>
    );
}
