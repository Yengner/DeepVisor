'use client';

import {
    Card, Checkbox, Group, Paper, Radio, Select, Stack, Switch, Text,
    TextInput, ThemeIcon, Title, Badge, Alert, Grid, Box, ActionIcon, Tooltip,
    Modal, Button
} from '@mantine/core';

import {
    IconTarget, IconUsersGroup, IconMap, IconInfoCircle, IconChartPie,
    IconMapPin, IconAdjustments, IconUsers, IconDevices, IconChevronRight,
    IconLanguage, IconBrandFacebook, IconPlus, IconEdit
} from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';
import { UseFormReturnType } from '@mantine/form';
import { useState, useEffect } from 'react';
import { CampaignFormValues } from '@/lib/actions/meta/types';
import { getObjectiveLabel, getOptimizationLabel, getValidOptimizationGoals } from '../utils/objectiveMappings';
import { MetaPage } from '@/lib/actions/meta/pages/actions';
import { useMetaPages } from '../hooks/useMetaPages';
import GoogleMapSelector from '../components/GoogleMapSelector';

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

    const { values, insertListItem, removeListItem, setFieldValue, getInputProps } = form;
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
    useEffect(() => {
        if (
            hasLoaded &&
            idx !== null &&
            metaPages.length > 0 &&
            !form.values.adSets[idx].page_id
        ) {
            form.setFieldValue(`adSets.${idx}.page_id`, metaPages[0].page_id);
        }
    }, [hasLoaded, metaPages, idx]);

    // --- Suggestion text for a new ad set name ---
    const adSetSuggestion = `${values.campaign.campaignName ||
        'Campaign'} - Ad Set ${new Date().toLocaleDateString()}`;

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
        label: getOptimizationLabel(goal),
    }));

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
                        <Title order={4}>Ad Sets ({adSets.length})</Title>
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
                            Add New Ad Set
                        </Button>
                    </Group>

                    {adSets.length === 0 ? (
                        <Text c="dimmed" ta="center">
                            No ad sets added yet.
                        </Text>
                    ) : (
                        <Stack gap="sm">
                            {adSets.map((_, i) => (
                                <Paper key={i} p="sm" withBorder radius="md">
                                    <Group justify="apart">
                                        <Text fw={500}>
                                            {adSets[i].adSetName || `Ad Set ${i + 1}`}
                                        </Text>
                                        <Group gap="xs">
                                            <ActionIcon
                                                variant="light"
                                                onClick={() => startAdSet(i)}
                                            >
                                                <IconEdit size={16} />
                                            </ActionIcon>
                                            <ActionIcon
                                                variant="light"
                                                color="red"
                                                onClick={() => removeListItem('adSets', i)}
                                            >
                                                <IconPlus style={{ transform: 'rotate(45deg)' }} />
                                            </ActionIcon>
                                        </Group>
                                    </Group>
                                    <Text size="xs" c="dimmed">
                                        Page:{' '}
                                        {adSets[i].page_id
                                            ? metaPages.find((p) => p.page_id === adSets[i].page_id)
                                                ?.name
                                            : 'Not selected'}
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
                                    <Title order={4}>Ad Set Information</Title>
                                </Group>

                                <Paper p="md" radius="md" withBorder shadow="sm">
                                    <TextInput
                                        label="Ad Set Name"
                                        description="Give your ad set a descriptive name"
                                        placeholder={adSetSuggestion}
                                        size="md"
                                        {...form.getInputProps(`adSets.${idx}.adSetName`)}
                                    />

                                    {/* Facebook Page Selection */}
                                    <Select
                                        label="Facebook Page"
                                        description="Choose the Page you want to promote"
                                        placeholder={loadingPages ? "Loading pages..." : "Select a page"}
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
                                    <Title order={4}>Performance Goal</Title>
                                </Group>

                                <Paper p="md" radius="md" withBorder shadow="sm">
                                    {isSmart ? (
                                        <Paper withBorder p="md" radius="md" bg="blue.0" shadow="xs">
                                            <Group align="flex-start">
                                                <ThemeIcon size="lg" color="violet" variant="light">
                                                    <IconTarget size={20} />
                                                </ThemeIcon>
                                                <Stack gap={0} style={{ flex: 1 }}>
                                                    <Text fw={600}>Automatic Optimization</Text>
                                                    <Text size="sm" c="dimmed">
                                                        Our AI will optimize your ad delivery based on your campaign objective:
                                                        <Badge ml={5} color="violet">{getObjectiveLabel(form.values.campaign.objective)}</Badge>
                                                    </Text>
                                                </Stack>
                                            </Group>
                                        </Paper>
                                    ) : (
                                        <Select
                                            label="Performance Goal"
                                            description="Choose what you want to optimize your ad delivery for"
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
                                    <Title order={4}>Audience Controls</Title>
                                </Group>

                                <Paper p="md" radius="md" withBorder shadow="sm">
                                    {/* Advantage+ audience toggle */}
                                    <Group justify="space-between" wrap="nowrap">
                                        <Stack gap={0} style={{ flex: 1 }}>
                                            <Text fw={600}>Advantage+ Audience</Text>
                                            <Text size="sm" c="dimmed">
                                                Meta will automatically show ads to people most likely to respond, based on your objective
                                            </Text>
                                        </Stack>
                                        <Switch
                                            size="md"
                                            onLabel="ON"
                                            offLabel="OFF"
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
                                            title="Advantage+ Audience Enabled"
                                            variant="light"
                                            radius="md"
                                            mt="md"
                                        >
                                            We'll show ads to people matching your targeting suggestions, and other audiences when it's
                                            likely to improve performance.
                                        </Alert>
                                    )}

                                    {/* Location Targeting */}
                                    <Paper p="md" radius="md" withBorder shadow="xs" mt="xl">
                                        <Group justify="apart">
                                            <Group>
                                                <ThemeIcon size="sm" variant="filled" radius="md" color="green">
                                                    <IconMapPin size={14} />
                                                </ThemeIcon>
                                                <Text fw={600}>Target Location</Text>
                                            </Group>
                                            <Button
                                                variant="light"
                                                size="sm"
                                                color="green"
                                                onClick={openLocationModal}
                                                rightSection={<IconChevronRight size={16} />}
                                            >
                                                Select Location
                                            </Button>
                                        </Group>

                                        <Text size="sm" c="dimmed" mt="xs">
                                            {/* You may want to implement a getLocationDisplay(idx) helper */}
                                            {form.values.adSets[idx].targeting?.location
                                                ? `Lat: ${form.values.adSets[idx].targeting.location.markerPosition?.lat ?? '-'}, Lng: ${form.values.adSets[idx].targeting.location.markerPosition?.lng ?? '-'}, Radius: ${form.values.adSets[idx].targeting.location.radius ?? '-'}`
                                                : 'No location selected'}
                                        </Text>

                                        {form.values.adSets[idx].targeting?.location?.markerPosition && (
                                            <Paper withBorder p="sm" radius="md" bg="green.0" shadow="xs" mt="md">
                                                <Group>
                                                    <ThemeIcon size="sm" variant="light" color="green" radius="xl">
                                                        <IconMapPin size={14} />
                                                    </ThemeIcon>
                                                    <Text size="sm" fw={500}>{form.values.adSets[idx].targeting.location.radius} mile radius</Text>
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
                                                    <Text fw={600}>Demographics</Text>
                                                </Group>

                                                {/* Age Range */}
                                                <Group grow mb="md">
                                                    <Select
                                                        label="Minimum Age"
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
                                                        label="Maximum Age"
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
                                                    label="Gender"
                                                    description="Select gender targeting"
                                                    defaultValue="all"
                                                    size="md"
                                                    {...form.getInputProps(`adSets.${idx}.targeting.genders`)}
                                                >
                                                    <Group mt="xs">
                                                        <Radio value="all" label="All" />
                                                        <Radio value="male" label="Male" />
                                                        <Radio value="female" label="Female" />
                                                    </Group>
                                                </Radio.Group>
                                            </Paper>

                                            {/* Languages */}
                                            <Paper p="md" radius="md" withBorder shadow="xs" mt="xl">
                                                <Group mb="md">
                                                    <ThemeIcon size="sm" variant="filled" radius="md" color="blue">
                                                        <IconLanguage size={14} />
                                                    </ThemeIcon>
                                                    <Text fw={600}>Languages</Text>
                                                </Group>

                                                <Select
                                                    label="Select Languages"
                                                    description="Select languages (leave empty for all languages)"
                                                    placeholder="All Languages"
                                                    searchable
                                                    clearable
                                                    size="md"
                                                    data={[
                                                        { value: 'en', label: 'English' },
                                                        { value: 'es', label: 'Spanish' },
                                                        { value: 'fr', label: 'French' },
                                                        { value: 'de', label: 'German' },
                                                        { value: 'zh', label: 'Chinese' },
                                                        { value: 'hi', label: 'Hindi' },
                                                        { value: 'ar', label: 'Arabic' },
                                                        { value: 'pt', label: 'Portuguese' },
                                                        { value: 'ru', label: 'Russian' },
                                                        { value: 'ja', label: 'Japanese' },
                                                    ]}
                                                    {...form.getInputProps(`adSets.${idx}.targeting.languages`)}
                                                />
                                            </Paper>

                                            {/* Detailed Targeting */}
                                            <Paper p="md" radius="md" withBorder shadow="xs" mt="xl">
                                                <Group mb="md">
                                                    <ThemeIcon size="sm" variant="filled" radius="md" color="cyan">
                                                        <IconTarget size={14} />
                                                    </ThemeIcon>
                                                    <Text fw={600}>Detailed Targeting</Text>
                                                </Group>

                                                <TextInput
                                                    label="Interests"
                                                    description="Comma-separated list of interests"
                                                    placeholder="e.g. fitness, cooking, technology"
                                                    size="md"
                                                    {...form.getInputProps(`adSets.${idx}.targeting.interests`)}
                                                />
                                                <TextInput
                                                    label="Behaviors"
                                                    description="Comma-separated list of behaviors"
                                                    placeholder="e.g. online shoppers, travelers"
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
                                    <Title order={4}>Ad Placements</Title>
                                </Group>

                                <Paper p="md" radius="md" withBorder shadow="sm">
                                    <Group justify="space-between" wrap="nowrap">
                                        <Stack gap={0} style={{ flex: 1 }}>
                                            <Text fw={600}>Advantage+ Placements</Text>
                                            <Text size="sm" c="dimmed">
                                                Your budget will be allocated across multiple placements based on where it's likely to perform best
                                            </Text>
                                        </Stack>
                                        <Switch
                                            size="md"
                                            onLabel="ON"
                                            offLabel="OFF"
                                            color="orange"
                                            disabled={isSmart}
                                            checked={form.values.adSets[idx].useAdvantagePlacements}
                                            {...form.getInputProps(`adSets.${idx}.useAdvantagePlacements`, { type: 'checkbox' })}
                                        />
                                    </Group>

                                    {!form.values.adSets[idx].useAdvantagePlacements && !isSmart && (
                                        <Paper withBorder p="md" radius="md" bg="white" shadow="xs" mt="xl">
                                            <Stack gap="xs">
                                                <Text fw={600} size="sm">Manual Placements</Text>
                                                <Text size="xs" c="dimmed">Select where your ads will appear</Text>

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
                                    <Title order={4}>Audience Insights</Title>
                                    <ThemeIcon size="md" variant="filled" radius="md" color="blue">
                                        <IconChartPie size={18} />
                                    </ThemeIcon>
                                </Group>

                                <Paper withBorder p="md" radius="md" mb="md" shadow="xs" bg="blue.0">
                                    <Stack gap="xs">
                                        <Group justify="apart">
                                            <Text fw={600} size="sm">Estimated Audience Size</Text>
                                            <Tooltip label="Estimated number of people matching your targeting criteria">
                                                <ActionIcon variant="light" color="blue" size="md" radius="xl">
                                                    <IconInfoCircle size={16} />
                                                </ActionIcon>
                                            </Tooltip>
                                        </Group>
                                        <Text size="xl" fw={700} c="blue">
                                            {audienceEstimate.size}
                                        </Text>
                                        <Text size="xs" c="dimmed">
                                            People who match your audience criteria
                                        </Text>
                                    </Stack>
                                </Paper>

                                <Paper withBorder p="md" radius="md" mb="md" shadow="xs">
                                    <Stack gap="xs">
                                        <Group justify="apart">
                                            <Text fw={600} size="sm">Audience Quality</Text>
                                            <Badge
                                                size="lg"
                                                color={audienceEstimate.qualityScore > 80 ? "green" :
                                                    audienceEstimate.qualityScore > 60 ? "yellow" : "red"}
                                            >
                                                {audienceEstimate.qualityScore}/100
                                            </Badge>
                                        </Group>
                                        <Text size="sm">
                                            {audienceEstimate.qualityScore > 80 ?
                                                "Excellent audience quality for your objective" :
                                                audienceEstimate.qualityScore > 60 ?
                                                    "Good audience quality, consider refining targeting" :
                                                    "Poor audience match, please adjust targeting"}
                                        </Text>

                                        {audienceEstimate.qualityScore > 80 ? (
                                            <Paper withBorder p="xs" radius="md" bg="green.0" mt="xs">
                                                <Group>
                                                    <ThemeIcon variant="light" size="sm" color="green" radius="xl">
                                                        <IconTarget size={14} />
                                                    </ThemeIcon>
                                                    <Text size="xs" fw={500}>Well-defined audience</Text>
                                                </Group>
                                            </Paper>
                                        ) : (
                                            <Paper withBorder p="xs" radius="md" bg="yellow.0" mt="xs">
                                                <Group>
                                                    <ThemeIcon variant="light" size="sm" color="yellow" radius="xl">
                                                        <IconAdjustments size={14} />
                                                    </ThemeIcon>
                                                    <Text size="xs" fw={500}>Consider narrowing your targeting</Text>
                                                </Group>
                                            </Paper>
                                        )}
                                    </Stack>
                                </Paper>

                                <Paper withBorder p="md" radius="md" shadow="xs" bg={isSmart ? "blue.0" : "white"}>
                                    <Stack gap="xs">
                                        <Group justify="apart">
                                            <Text fw={600} size="sm">Recommendations</Text>
                                            <ThemeIcon variant="light" size="md" color="blue" radius="xl">
                                                <IconAdjustments size={16} />
                                            </ThemeIcon>
                                        </Group>

                                        {isSmart ? (
                                            <Paper withBorder p="sm" radius="md" bg="white" shadow="xs">
                                                <Group>
                                                    <ThemeIcon variant="light" size="md" color="blue" radius="xl">
                                                        <IconTarget size={18} />
                                                    </ThemeIcon>
                                                    <Text size="sm" fw={500}>AI-Optimized Targeting</Text>
                                                </Group>
                                                <Text size="xs" mt="xs">
                                                    Our AI will optimize your audience targeting to reach people most
                                                    likely to convert based on your objective.
                                                </Text>
                                            </Paper>
                                        ) : (
                                            <>
                                                <Paper withBorder p="sm" radius="md" bg="blue.0" shadow="xs">
                                                    <Group>
                                                        <ThemeIcon variant="light" size="md" color="blue" radius="xl">
                                                            <IconUsers size={18} />
                                                        </ThemeIcon>
                                                        <Text size="sm" fw={500}>Enable Advantage+ Audience</Text>
                                                    </Group>
                                                    <Text size="xs" mt="xs">
                                                        Improve campaign performance by letting Meta find more relevant people.
                                                    </Text>
                                                </Paper>

                                                <Paper withBorder p="sm" radius="md" bg="blue.0" shadow="xs" mt="xs">
                                                    <Group>
                                                        <ThemeIcon variant="light" size="md" color="blue" radius="xl">
                                                            <IconMapPin size={18} />
                                                        </ThemeIcon>
                                                        <Text size="sm" fw={500}>Add Detailed Targeting</Text>
                                                    </Group>
                                                    <Text size="xs" mt="xs">
                                                        Include interests and behaviors to reach people more likely to be interested in your product.
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
                        title="Select Target Location"
                        size="xl"
                        centered
                    >
                        <Stack>
                            <Text size="sm" c="dimmed">
                                Click on the map to set a target location and adjust the radius to define your targeting area.
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
                                    Cancel
                                </Button>
                                <Button onClick={closeLocationModal} color="green">
                                    Apply Location
                                </Button>
                            </Group>
                        </Stack>
                    </Modal>
                </Grid>
            )}
        </Stack>
    );
}