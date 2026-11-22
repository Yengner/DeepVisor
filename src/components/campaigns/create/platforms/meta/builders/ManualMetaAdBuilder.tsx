'use client';

import '@mantine/dates/styles.css';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
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
    const t = useTranslations('createManual.adBuilder');
    const tc = useTranslations('createManual.common');
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
                <Group justify="apart" align="flex-start" className="dv-create-hero">
                    <Stack gap="xs">
                        <Badge w="fit-content" size="lg" variant="light" color="violet">
                            {t('badge')}
                        </Badge>
                        <Title order={2}>{t('title', { adSet: existingAdSet.name })}</Title>
                        <Text c="dimmed" maw={760}>
                            {t('intro')}
                        </Text>
                    </Stack>
                    <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={handleBackToStarter}>
                        {t('chooseDifferent')}
                    </Button>
                </Group>

                <Paper withBorder radius="xl" p="lg">
                    <Group gap="md" wrap="wrap">
                        <Group gap="sm">
                            <ThemeIcon color="blue" variant="light" radius="xl">
                                <IconLayersIntersect size={18} />
                            </ThemeIcon>
                            <Stack gap={0}>
                                <Text size="sm" fw={700}>{tc('parentCampaign')}</Text>
                                <Text size="sm" c="dimmed">{existingCampaign.name}</Text>
                            </Stack>
                        </Group>
                        <Group gap="sm">
                            <ThemeIcon color="violet" variant="light" radius="xl">
                                <IconAd size={18} />
                            </ThemeIcon>
                            <Stack gap={0}>
                                <Text size="sm" fw={700}>{t('targetAdSet')}</Text>
                                <Text size="sm" c="dimmed">{existingAdSet.name}</Text>
                            </Stack>
                        </Group>
                        <Badge variant="light" color="gray">
                            {t('existingAds', { count: existingAdSet.ads_metrics.length })}
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
                            label={tc('creative')}
                            description={t('stepCreativeHint')}
                            icon={<IconBrush size={18} />}
                        >
                            <Paper withBorder radius="lg" p="md" mb="md">
                                <Stack gap="sm">
                                    <Group gap="sm">
                                        <ThemeIcon color="indigo" variant="light" radius="xl">
                                            <IconCalendar size={18} />
                                        </ThemeIcon>
                                        <Stack gap={2}>
                                            <Text fw={700}>{tc('adSchedule')}</Text>
                                            <Text size="sm" c="dimmed">
                                                {t('scheduleHint')}
                                            </Text>
                                        </Stack>
                                    </Group>

                                    <Grid gutter="md">
                                        <Grid.Col span={{ base: 12, md: 6 }}>
                                            <DateTimePicker
                                                label={t('startDate')}
                                                placeholder={t('selectDateTime')}
                                                required
                                                minDate={new Date()}
                                                size="md"
                                                {...form.getInputProps('schedule.startDate')}
                                            />
                                        </Grid.Col>
                                        <Grid.Col span={{ base: 12, md: 6 }}>
                                            <DateTimePicker
                                                label={t('endDate')}
                                                placeholder={tc('optional')}
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
                                        {t('scheduleAlert')}
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
                                    {tc('back')}
                                </Button>
                                <Button rightSection={<IconArrowRight size={16} />} onClick={() => setActive(1)}>
                                    {t('continueToReview')}
                                </Button>
                            </Group>
                        </Stepper.Step>

                        <Stepper.Step
                            label={tc('stepReview')}
                            description={tc('stepReviewHint')}
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
