'use client';

import {
    Card, Checkbox, Group, Paper, Radio, Select, Stack, Switch, Text,
    TextInput, ThemeIcon, Title, Badge, Alert, Grid, Box, ActionIcon, Tooltip,
    Modal, Button
} from '@mantine/core';

import {
    IconTarget, IconUsersGroup, IconInfoCircle, IconChartPie,
    IconMapPin, IconAdjustments, IconUsers, IconDevices, IconChevronRight,
    IconLanguage, IconPlus, IconEdit
} from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';
import { UseFormReturnType } from '@mantine/form';
import { useState, useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { CampaignFormValues } from '@/lib/server/actions/meta/types';
import { getValidOptimizationGoals } from '../utils/objectiveMappings';
import { useMetaPages } from '../hooks/useMetaPages';
import GoogleMapSelector from '../components/GoogleMapSelector';
import { useCodeLabels } from '../hooks/useCodeLabels';

interface AdSetStepProps {
    form: UseFormReturnType<CampaignFormValues>;
    isSmart?: boolean;
}

/**
 * Ad Set configuration step for campaign creation
 * Handles audience targeting, performance goals, and ad placements
 */
export default function AdSetStep({
    form,
    isSmart = false
}: AdSetStepProps) {

    const t = useTranslations('createManual.adSetStep');
    const codes = useCodeLabels();
    const locale = useLocale();
    const intl = locale === 'es' ? 'es-US' : 'en-US';
    const { values, insertListItem, removeListItem, setFieldValue } = form;
    const [locationModalOpened, { open: openLocationModal, close: closeLocationModal }] = useDisclosure(false);
    const [audienceEstimate, setAudienceEstimate] = useState({
        size: '8.9M - 10.5M',
        qualityScore: 87,
        relevanceScore: 92
    });
    const step = form.values.step;
    const idx = form.values.activeAdSetIdx;
    const adSets = form.values.adSets;

    // --- Page list hook to fetch Facebook Pages ---
    const { metaPages, loadingPages, pagesError, hasLoaded } = useMetaPages(
        values.platformIntegrationId
    );

    // Set default page_id when pages are loaded and adSet doesn't have one
    // This effect runs when metaPages or idx changes

    /* eslint-disable react-hooks/exhaustive-deps */
    const currentAdSetPageId = idx !== null ? form.values.adSets[idx]?.page_id : null;

    useEffect(() => {
        if (
            !hasLoaded ||
            idx === null ||
            metaPages.length === 0 ||
            currentAdSetPageId
        ) {
            return;
        }

        form.setFieldValue(`adSets.${idx}.page_id`, metaPages[0].page_id);
    }, [currentAdSetPageId, hasLoaded, idx, metaPages]);

    // --- Suggestion text for a new ad set name ---
    const adSetSuggestion = t('nameSuggestion', {
        campaign: values.campaign.campaignName || t('campaignFallback'),
        date: new Date().toLocaleDateString(intl),
    });

    // --- Helpers to navigate steps in the form ---
    const goTo = (newStep: typeof values.step) =>
        setFieldValue('step', newStep);

    const startAdSet = (index: number) => {
        setFieldValue('activeAdSetIdx', index);
        goTo('adset');
    };


    // --- Optimization options based on campaign objective & destination ---
    const validGoals = getValidOptimizationGoals(
        values.campaign.objective,
        values.campaign.destinationType
    );
    const optimizationOptions = validGoals.map((goal) => ({
        value: goal,
        label: t.has(`goals.${goal}` as never) ? t(`goals.${goal}` as never) : codes.objective(goal),
    }));

    // Language names come from the browser's own language list, in the interface language.
    const languageNames = new Intl.DisplayNames([intl], { type: 'language' });
    const languageOptions = ['en', 'es', 'fr', 'de', 'zh', 'hi', 'ar', 'pt', 'ru', 'ja'].map((code) => {
        const name = languageNames.of(code) ?? code;
        return { value: code, label: name.charAt(0).toLocaleUpperCase(intl) + name.slice(1) };
    });

    // --- Location modal state ---
    // Handle location selection from map
    const handleLocationSelect = (loc: { markerPosition: { lat: number; lng: number } | null; radius: number }) => {
        if (idx !== null) {
            form.setFieldValue(`adSets.${idx}.targeting.location`, loc);
        }
        // Mock audience estimate update
        setAudienceEstimate({
            size: loc.radius > 20 ? '15.2M - 18.4M' : '8.9M - 10.5M',
            qualityScore: loc.radius > 20 ? 75 : 87,
            relevanceScore: loc.radius > 20 ? 82 : 92
        });
    }

    // --- Default creative object for new ad sets ---
    const defaultCreative = {
        contentSource: isSmart ? 'auto' : 'upload',
        existingCreativeIds: [],
        uploadedFiles: [],
        imageHash: '',
        adHeadline: '',
        adPrimaryText: '',
        adDescription: '',
        adCallToAction: 'LEARN_MORE',
    };

    return (
        <Stack>
            {/* LIST VIEW */}
            {step === 'list' && (
                <Paper p="md" withBorder radius="md" mb="md">
                    <Group justify="apart" mb="md">
                        <Title order={4}>{t('listTitle', { count: adSets.length })}</Title>
                        <Button
                            leftSection={<IconPlus size={18} />}
                            onClick={() => {
                                insertListItem('adSets', {
                                    adSetName: '',
                                    page_id: '',
                                    useAdvantageAudience: true,
                                    useAdvantagePlacements: true,
                                    billingEvent: 'IMPRESSIONS',
                                    optimization_goal: validGoals[0],
                                    targeting: {
                                        location: { markerPosition: null, radius: 10 },
                                        age: { min: 18, max: 65 },
                                        genders: [],
                                        interests: [],
                                    },
                                    creatives: [defaultCreative], // <-- Ensure creatives array is initialized
                                });
                                startAdSet(adSets.length);
                            }}
                        >
                            {t('addNew')}
                        </Button>
                    </Group>

                    {adSets.length === 0 ? (
                        <Text c="dimmed" ta="center">
                            {t('empty')}
                        </Text>
                    ) : (
                        <Stack gap="sm">
                            {adSets.map((_, i) => (
                                <Paper key={i} p="sm" withBorder radius="md">
                                    <Group justify="apart">
                                        <Text fw={500}>
                                            {adSets[i].adSetName || t('defaultName', { n: i + 1 })}
                                        </Text>
                                        <Group gap="xs">
                                            <ActionIcon
                                                variant="light"
                                                aria-label={t('editAria')}
                                                onClick={() => startAdSet(i)}
                                            >
                                                <IconEdit size={16} />
                                            </ActionIcon>
                                            <ActionIcon
                                                variant="light"
                                                color="red"
                                                aria-label={t('removeAria')}
                                                onClick={() => removeListItem('adSets', i)}
                                            >
                                                <IconPlus style={{ transform: 'rotate(45deg)' }} />
                                            </ActionIcon>
                                        </Group>
                                    </Group>
                                    <Text size="xs" c="dimmed">
                                        {t('page', {
                                            name: adSets[i].page_id
                                                ? metaPages.find((p) => p.page_id === adSets[i].page_id)?.name ?? ''
                                                : t('pageNotSelected'),
                                        })}
                                    </Text>
                                </Paper>
                            ))}
                        </Stack>
                    )}
                </Paper>
            )}

            {/* AD SET EDIT FORM */}
            {step === 'adset' && idx !== null && (
                <Grid gutter="md" mt="xl" mb="xl">
                    {/* Main form column */}
                    <Grid.Col span={{ base: 12, md: 8 }}>
                        {/* Ad Set Information Card */}
                        <Card p="md" withBorder radius="md" mb="md" shadow="xs">
                            <Stack>
                                <Group justify="left" mb="xs" mt="sm">
                                    <ThemeIcon size="md" variant="filled" radius="md" color="blue">
                                        <IconUsersGroup size={18} />
                                    </ThemeIcon>
                                    <Title order={4}>{t('infoTitle')}</Title>
                                </Group>

                                <Paper p="md" radius="md" withBorder shadow="sm">
                                    <TextInput
                                        label={t('nameLabel')}
                                        description={t('nameHint')}
                                        placeholder={adSetSuggestion}
                                        size="md"
                                        {...form.getInputProps(`adSets.${idx}.adSetName`)}
                                    />

                                    {/* Facebook Page Selection */}
                                    <Select
                                        label={t('pageLabel')}
                                        description={t('pageHint')}
                                        placeholder={loadingPages ? t('loadingPages') : t('selectPage')}
                                        data={metaPages.map(page => ({ value: page.page_id, label: page.name }))}
                                        disabled={loadingPages}
                                        required
                                        clearable={false}
                                        mt="md"
                                        size="md"
                                        {...form.getInputProps(`adSets.${idx}.page_id`)}
                                        error={pagesError}
                                        onChange={(value) => {
                                            if (value) {
                                                form.setFieldValue(`adSets.${idx}.page_id`, value);
                                            }
                                        }}
                                    />
                                </Paper>
                            </Stack>
                        </Card>

                        {/* Performance Goal Card */}
                        <Card p="md" withBorder radius="md" mb="md" shadow="xs">
                            <Stack>
                                <Group justify="left" mb="xs" mt="sm">
                                    <ThemeIcon size="md" variant="filled" radius="md" color="violet">
                                        <IconChartPie size={18} />
                                    </ThemeIcon>
                                    <Title order={4}>{t('goalTitle')}</Title>
                                </Group>

                                <Paper p="md" radius="md" withBorder shadow="sm">
                                    {isSmart ? (
                                        <Paper withBorder p="md" radius="md" bg="var(--dv-primary-soft)" shadow="xs">
                                            <Group align="flex-start">
                                                <ThemeIcon size="lg" color="violet" variant="light">
                                                    <IconTarget size={20} />
                                                </ThemeIcon>
                                                <Stack gap={0} style={{ flex: 1 }}>
                                                    <Text fw={600}>{t('autoOptTitle')}</Text>
                                                    <Text size="sm" c="dimmed">
                                                        {t('autoOptBody')}
                                                        <Badge ml={5} color="violet">{codes.objective(form.values.campaign.objective)}</Badge>
                                                    </Text>
                                                </Stack>
                                            </Group>
                                        </Paper>
                                    ) : (
                                        <Select
                                            label={t('goalLabel')}
                                            description={t('goalHint')}
                                            data={optimizationOptions}
                                            size="md"
                                            {...form.getInputProps(`adSets.${idx}.optimization_goal`)}
                                            required
                                        />
                                    )}
                                </Paper>
                            </Stack>
                        </Card>

                        {/* Audience Controls Card */}
                        <Card p="md" withBorder radius="md" mb="md" shadow="xs">
                            <Stack>
                                <Group justify="left" mb="xs" mt="sm">
                                    <ThemeIcon size="md" variant="filled" radius="md" color="blue">
                                        <IconUsers size={18} />
                                    </ThemeIcon>
                                    <Title order={4}>{t('audienceTitle')}</Title>
                                </Group>

                                <Paper p="md" radius="md" withBorder shadow="sm">
                                    {/* Advantage+ audience toggle */}
                                    <Group justify="space-between" wrap="nowrap">
                                        <Stack gap={0} style={{ flex: 1 }}>
                                            <Text fw={600}>{t('advAudience')}</Text>
                                            <Text size="sm" c="dimmed">
                                                {t('advAudienceHint')}
                                            </Text>
                                        </Stack>
                                        <Switch
                                            size="md"
                                            onLabel={t('switchOn')}
                                            offLabel={t('switchOff')}
                                            color="blue"
                                            checked={form.values.adSets[idx].useAdvantageAudience}
                                            disabled={isSmart}
                                            {...form.getInputProps(`adSets.${idx}.useAdvantageAudience`, { type: 'checkbox' })}
                                        />
                                    </Group>

                                    {form.values.adSets[idx].useAdvantageAudience && (
                                        <Alert
                                            icon={<IconInfoCircle size={18} />}
                                            color="blue"
                                            title={t('advEnabledTitle')}
                                            variant="light"
                                            radius="md"
                                            mt="md"
                                        >
                                            {t('advEnabledBody')}
                                        </Alert>
                                    )}

                                    {/* Location Targeting */}
                                    <Paper p="md" radius="md" withBorder shadow="xs" mt="xl">
                                        <Group justify="apart">
                                            <Group>
                                                <ThemeIcon size="sm" variant="filled" radius="md" color="green">
                                                    <IconMapPin size={14} />
                                                </ThemeIcon>
                                                <Text fw={600}>{t('targetLocation')}</Text>
                                            </Group>
                                            <Button
                                                variant="light"
                                                size="sm"
                                                color="green"
                                                onClick={openLocationModal}
                                                rightSection={<IconChevronRight size={16} />}
                                            >
                                                {t('selectLocation')}
                                            </Button>
                                        </Group>

                                        <Text size="sm" c="dimmed" mt="xs">
                                            {/* You may want to implement a getLocationDisplay(idx) helper */}
                                            {form.values.adSets[idx].targeting?.location
                                                ? t('locationValue', {
                                                    lat: form.values.adSets[idx].targeting.location.markerPosition?.lat ?? '-',
                                                    lng: form.values.adSets[idx].targeting.location.markerPosition?.lng ?? '-',
                                                    radius: form.values.adSets[idx].targeting.location.radius ?? '-',
                                                })
                                                : t('noLocation')}
                                        </Text>

                                        {form.values.adSets[idx].targeting?.location?.markerPosition && (
                                            <Paper withBorder p="sm" radius="md" bg="var(--dv-success-soft)" shadow="xs" mt="md">
                                                <Group>
                                                    <ThemeIcon size="sm" variant="light" color="green" radius="xl">
                                                        <IconMapPin size={14} />
                                                    </ThemeIcon>
                                                    <Text size="sm" fw={500}>{t('radiusMiles', { radius: Number(form.values.adSets[idx].targeting.location.radius) })}</Text>
                                                </Group>
                                            </Paper>
                                        )}
                                    </Paper>

                                    {/* Only show demographics, languages, and detailed targeting when Advantage+ is OFF */}
                                    {!form.values.adSets[idx].useAdvantageAudience && !isSmart && (
                                        <>
                                            {/* Demographics */}
                                            <Paper p="md" radius="md" withBorder shadow="xs" mt="xl">
                                                <Group mb="md">
                                                    <ThemeIcon size="sm" variant="filled" radius="md" color="indigo">
                                                        <IconUsers size={14} />
                                                    </ThemeIcon>
                                                    <Text fw={600}>{t('demographics')}</Text>
                                                </Group>

                                                {/* Age Range */}
                                                <Group grow mb="md">
                                                    <Select
                                                        label={t('minAge')}
                                                        data={[
                                                            { value: '13', label: '13' },
                                                            { value: '18', label: '18' },
                                                            { value: '21', label: '21' },
                                                            { value: '25', label: '25' },
                                                            { value: '35', label: '35' },
                                                            { value: '45', label: '45' },
                                                            { value: '55', label: '55' },
                                                        ]}
                                                        defaultValue="18"
                                                        size="md"
                                                        {...form.getInputProps(`adSets.${idx}.targeting.age.min`)}
                                                    />

                                                    <Select
                                                        label={t('maxAge')}
                                                        data={[
                                                            { value: '65', label: '65' },
                                                            { value: '70', label: '70' },
                                                            { value: '75', label: '75' },
                                                            { value: '80', label: '80' },
                                                            { value: '95', label: '95' },
                                                            { value: '100', label: '100' },
                                                        ]}
                                                        defaultValue="65"
                                                        size="md"
                                                        {...form.getInputProps(`adSets.${idx}.targeting.age.max`)}
                                                    />
                                                </Group>

                                                {/* Gender Selection */}
                                                <Radio.Group
                                                    label={t('gender')}
                                                    description={t('genderHint')}
                                                    defaultValue="all"
                                                    size="md"
                                                    {...form.getInputProps(`adSets.${idx}.targeting.genders`)}
                                                >
                                                    <Group mt="xs">
                                                        <Radio value="all" label={t('genderAll')} />
                                                        <Radio value="male" label={t('genderMale')} />
                                                        <Radio value="female" label={t('genderFemale')} />
                                                    </Group>
                                                </Radio.Group>
                                            </Paper>

                                            {/* Languages */}
                                            <Paper p="md" radius="md" withBorder shadow="xs" mt="xl">
                                                <Group mb="md">
                                                    <ThemeIcon size="sm" variant="filled" radius="md" color="blue">
                                                        <IconLanguage size={14} />
                                                    </ThemeIcon>
                                                    <Text fw={600}>{t('languages')}</Text>
                                                </Group>

                                                <Select
                                                    label={t('selectLanguages')}
                                                    description={t('languagesHint')}
                                                    placeholder={t('allLanguages')}
                                                    searchable
                                                    clearable
                                                    size="md"
                                                    data={languageOptions}
                                                    {...form.getInputProps(`adSets.${idx}.targeting.languages`)}
                                                />
                                            </Paper>

                                            {/* Detailed Targeting */}
                                            <Paper p="md" radius="md" withBorder shadow="xs" mt="xl">
                                                <Group mb="md">
                                                    <ThemeIcon size="sm" variant="filled" radius="md" color="cyan">
                                                        <IconTarget size={14} />
                                                    </ThemeIcon>
                                                    <Text fw={600}>{t('detailedTitle')}</Text>
                                                </Group>

                                                <TextInput
                                                    label={t('interests')}
                                                    description={t('interestsHint')}
                                                    placeholder={t('interestsPlaceholder')}
                                                    size="md"
                                                    {...form.getInputProps(`adSets.${idx}.targeting.interests`)}
                                                />
                                                <TextInput
                                                    label={t('behaviors')}
                                                    description={t('behaviorsHint')}
                                                    placeholder={t('behaviorsPlaceholder')}
                                                    mt="md"
                                                    size="md"
                                                    {...form.getInputProps(`adSets.${idx}.targeting.behaviors`)}
                                                />
                                            </Paper>
                                        </>
                                    )}
                                </Paper>
                            </Stack>
                        </Card>

                        {/* Placements Card */}
                        <Card p="md" withBorder radius="md" mb="md" shadow="xs">
                            <Stack>
                                <Group justify="left" mb="xs" mt="sm">
                                    <ThemeIcon size="md" variant="filled" radius="md" color="orange">
                                        <IconDevices size={18} />
                                    </ThemeIcon>
                                    <Title order={4}>{t('placementsTitle')}</Title>
                                </Group>

                                <Paper p="md" radius="md" withBorder shadow="sm">
                                    <Group justify="space-between" wrap="nowrap">
                                        <Stack gap={0} style={{ flex: 1 }}>
                                            <Text fw={600}>{t('advPlacements')}</Text>
                                            <Text size="sm" c="dimmed">
                                                {t('advPlacementsHint')}
                                            </Text>
                                        </Stack>
                                        <Switch
                                            size="md"
                                            onLabel={t('switchOn')}
                                            offLabel={t('switchOff')}
                                            color="orange"
                                            disabled={isSmart}
                                            checked={form.values.adSets[idx].useAdvantagePlacements}
                                            {...form.getInputProps(`adSets.${idx}.useAdvantagePlacements`, { type: 'checkbox' })}
                                        />
                                    </Group>

                                    {!form.values.adSets[idx].useAdvantagePlacements && !isSmart && (
                                        <Paper withBorder p="md" radius="md" bg="var(--dv-card-panel)" shadow="xs" mt="xl">
                                            <Stack gap="xs">
                                                <Text fw={600} size="sm">{t('manualPlacements')}</Text>
                                                <Text size="xs" c="dimmed">{t('manualPlacementsHint')}</Text>

                                                <Checkbox.Group
                                                    defaultValue={['facebook', 'instagram']}
                                                    {...form.getInputProps(`adSets.${idx}.placementTypes`)}
                                                    size="md"
                                                >
                                                    <Group mt="xs">
                                                        <Checkbox value="facebook" label="Facebook" />
                                                        <Checkbox value="instagram" label="Instagram" />
                                                        <Checkbox value="audience_network" label="Audience Network" />
                                                        <Checkbox value="messenger" label="Messenger" />
                                                    </Group>
                                                </Checkbox.Group>
                                            </Stack>
                                        </Paper>
                                    )}
                                </Paper>
                            </Stack>
                        </Card>
                    </Grid.Col>

                    {/* Right sidebar with audience predictions */}
                    <Grid.Col span={{ base: 12, md: 4 }}>
                        <Box style={{ position: 'sticky', top: '20px' }}>
                            <Card p="md" withBorder radius="md" mb="md" mt="lg" shadow="xs">
                                <Group justify="apart" mb="md">
                                    <Title order={4}>{t('insightsTitle')}</Title>
                                    <ThemeIcon size="md" variant="filled" radius="md" color="blue">
                                        <IconChartPie size={18} />
                                    </ThemeIcon>
                                </Group>

                                <Paper withBorder p="md" radius="md" mb="md" shadow="xs" bg="var(--dv-primary-soft)">
                                    <Stack gap="xs">
                                        <Group justify="apart">
                                            <Text fw={600} size="sm">{t('estSize')}</Text>
                                            <Tooltip label={t('estSizeTip')}>
                                                <ActionIcon variant="light" color="blue" size="md" radius="xl" aria-label={t('estSizeTip')}>
                                                    <IconInfoCircle size={16} />
                                                </ActionIcon>
                                            </Tooltip>
                                        </Group>
                                        <Text size="xl" fw={700} c="blue">
                                            {audienceEstimate.size}
                                        </Text>
                                        <Text size="xs" c="dimmed">
                                            {t('estSizeHint')}
                                        </Text>
                                    </Stack>
                                </Paper>

                                <Paper withBorder p="md" radius="md" mb="md" shadow="xs">
                                    <Stack gap="xs">
                                        <Group justify="apart">
                                            <Text fw={600} size="sm">{t('quality')}</Text>
                                            <Badge
                                                size="lg"
                                                color={audienceEstimate.qualityScore > 80 ? "green" :
                                                    audienceEstimate.qualityScore > 60 ? "yellow" : "red"}
                                            >
                                                {audienceEstimate.qualityScore}/100
                                            </Badge>
                                        </Group>
                                        <Text size="sm">
                                            {audienceEstimate.qualityScore > 80
                                                ? t('qualityExcellent')
                                                : audienceEstimate.qualityScore > 60
                                                    ? t('qualityGood')
                                                    : t('qualityPoor')}
                                        </Text>

                                        {audienceEstimate.qualityScore > 80 ? (
                                            <Paper withBorder p="xs" radius="md" bg="var(--dv-success-soft)" mt="xs">
                                                <Group>
                                                    <ThemeIcon variant="light" size="sm" color="green" radius="xl">
                                                        <IconTarget size={14} />
                                                    </ThemeIcon>
                                                    <Text size="xs" fw={500}>{t('wellDefined')}</Text>
                                                </Group>
                                            </Paper>
                                        ) : (
                                            <Paper withBorder p="xs" radius="md" bg="var(--dv-gap-bg)" mt="xs">
                                                <Group>
                                                    <ThemeIcon variant="light" size="sm" color="yellow" radius="xl">
                                                        <IconAdjustments size={14} />
                                                    </ThemeIcon>
                                                    <Text size="xs" fw={500}>{t('narrow')}</Text>
                                                </Group>
                                            </Paper>
                                        )}
                                    </Stack>
                                </Paper>

                                <Paper withBorder p="md" radius="md" shadow="xs" bg={isSmart ? "var(--dv-primary-soft)" : "var(--dv-card-panel)"}>
                                    <Stack gap="xs">
                                        <Group justify="apart">
                                            <Text fw={600} size="sm">{t('recommendations')}</Text>
                                            <ThemeIcon variant="light" size="md" color="blue" radius="xl">
                                                <IconAdjustments size={16} />
                                            </ThemeIcon>
                                        </Group>

                                        {isSmart ? (
                                            <Paper withBorder p="sm" radius="md" bg="var(--dv-card-panel)" shadow="xs">
                                                <Group>
                                                    <ThemeIcon variant="light" size="md" color="blue" radius="xl">
                                                        <IconTarget size={18} />
                                                    </ThemeIcon>
                                                    <Text size="sm" fw={500}>{t('aiTargetingTitle')}</Text>
                                                </Group>
                                                <Text size="xs" mt="xs">
                                                    {t('aiTargetingBody')}
                                                </Text>
                                            </Paper>
                                        ) : (
                                            <>
                                                <Paper withBorder p="sm" radius="md" bg="var(--dv-primary-soft)" shadow="xs">
                                                    <Group>
                                                        <ThemeIcon variant="light" size="md" color="blue" radius="xl">
                                                            <IconUsers size={18} />
                                                        </ThemeIcon>
                                                        <Text size="sm" fw={500}>{t('enableAdv')}</Text>
                                                    </Group>
                                                    <Text size="xs" mt="xs">
                                                        {t('enableAdvBody')}
                                                    </Text>
                                                </Paper>

                                                <Paper withBorder p="sm" radius="md" bg="var(--dv-primary-soft)" shadow="xs" mt="xs">
                                                    <Group>
                                                        <ThemeIcon variant="light" size="md" color="blue" radius="xl">
                                                            <IconMapPin size={18} />
                                                        </ThemeIcon>
                                                        <Text size="sm" fw={500}>{t('addDetailed')}</Text>
                                                    </Group>
                                                    <Text size="xs" mt="xs">
                                                        {t('addDetailedBody')}
                                                    </Text>
                                                </Paper>
                                            </>
                                        )}
                                    </Stack>
                                </Paper>
                            </Card>
                        </Box>
                    </Grid.Col>

                    {/* Location selection modal */}
                    <Modal
                        opened={locationModalOpened}
                        onClose={closeLocationModal}
                        title={t('modalTitle')}
                        size="xl"
                        centered
                    >
                        <Stack>
                            <Text size="sm" c="dimmed">
                                {t('modalHint')}
                            </Text>
                            <Box style={{ height: 450 }}>
                                <GoogleMapSelector
                                    onLocationSelect={(loc) => {
                                        handleLocationSelect(loc);
                                        // Don't close automatically so user can adjust
                                    }}
                                />
                            </Box>
                            <Group justify="flex-end">
                                <Button variant="outline" onClick={closeLocationModal} mr="md">
                                    {t('cancel')}
                                </Button>
                                <Button onClick={closeLocationModal} color="green">
                                    {t('apply')}
                                </Button>
                            </Group>
                        </Stack>
                    </Modal>
                </Grid>
            )}
        </Stack>
    );
}
