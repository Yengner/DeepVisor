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
    IconAlertCircle,
    IconArrowLeft,
    IconBrush,
    IconCheck,
    IconLayersIntersect,
    IconTargetArrow,
} from '@tabler/icons-react';
import { useCampaignSubmit } from '../hooks/useCampaignSubmit';
import { useCodeLabels } from '../hooks/useCodeLabels';
import type { CampaignFormValues } from '@/lib/server/actions/meta/types';

interface ManualMetaAdSetReviewProps {
    values: CampaignFormValues;
    campaignName: string;
    onBack: () => void;
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

    const t = useTranslations('createManual.adSetReview');
    const tc = useTranslations('createManual.common');
    const codes = useCodeLabels();
    const intl = useLocale() === 'es' ? 'es-US' : 'en-US';
    const budgetKey =
        values.budget.type === 'daily' ? 'budgetDaily' : values.budget.type === 'lifetime' ? 'budgetLifetime' : 'budgetOther';
    const budgetAmount = new Intl.NumberFormat(intl, { style: 'currency', currency: 'USD' }).format(values.budget.amount);

    const currentAdSet = values.adSets[0];
    const currentCreative = currentAdSet?.creatives?.[0];

    return (
        <Stack gap="lg">
            <Card withBorder radius="xl" p="xl">
                <Stack gap="lg">
                    <Group justify="apart" align="flex-start">
                        <Stack gap={4}>
                            <Badge w="fit-content" variant="light" color="blue">
                                {t('badge')}
                            </Badge>
                            <Title order={3}>{t('title')}</Title>
                            <Text c="dimmed">
                                {t.rich('intro', {
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
                                    <Text fw={700}>{t('campaignContext')}</Text>
                                </Group>
                                <Text size="sm">{campaignName}</Text>
                                <Text size="sm" c="dimmed">
                                    {t('objective', { value: codes.objective(values.campaign.objective) })}
                                </Text>
                            </Stack>
                        </Paper>

                        <Paper withBorder radius="lg" p="md">
                            <Stack gap="sm">
                                <Group gap="sm">
                                    <ThemeIcon color="violet" variant="light" radius="xl">
                                        <IconTargetArrow size={18} />
                                    </ThemeIcon>
                                    <Text fw={700}>{t('setupTitle')}</Text>
                                </Group>
                                <Text size="sm">{currentAdSet?.adSetName || t('untitled')}</Text>
                                <Text size="sm" c="dimmed">
                                    {t('optimization', {
                                        value: currentAdSet?.optimization_goal ? codes.objective(currentAdSet.optimization_goal) : t('optimizationNone'),
                                    })}
                                </Text>
                                <Text size="sm" c="dimmed">
                                    {t('placements', {
                                        value: currentAdSet?.useAdvantagePlacements ? t('placementsAdvantage') : t('placementsManual'),
                                    })}
                                </Text>
                            </Stack>
                        </Paper>

                        <Paper withBorder radius="lg" p="md">
                            <Stack gap="sm">
                                <Group gap="sm">
                                    <ThemeIcon color="orange" variant="light" radius="xl">
                                        <IconBrush size={18} />
                                    </ThemeIcon>
                                    <Text fw={700}>{t('firstCreative')}</Text>
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
                                <Text fw={700}>{t('budgetContext')}</Text>
                                <Text size="sm">
                                    {t(budgetKey, { amount: budgetAmount })}
                                </Text>
                                <Text size="sm" c="dimmed">
                                    {t('budgetBody')}
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
