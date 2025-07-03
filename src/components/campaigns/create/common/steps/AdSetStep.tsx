'use client';

import {
    Card, Checkbox, Divider, Group, Paper, Radio, Select, Stack, Switch, Text,
    TextInput, ThemeIcon, Title, Badge, Alert, Grid, Box, ActionIcon, Tooltip,
    Modal, Button
} from '@mantine/core';
import {
    IconTarget, IconUsersGroup, IconMap, IconInfoCircle, IconChartPie,
    IconMapPin, IconAdjustments, IconUsers, IconDevices, IconChevronRight
} from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';
import { UseFormReturnType } from '@mantine/form';
import { getObjectiveLabel, getOptimizationLabel, getValidOptimizationGoals } from '@/components/campaigns/create/common/utils/objectiveMappings';
import GoogleMapSelector from '../GoogleMapSelector';
import { useState } from 'react';
import { CampaignFormValues } from '@/lib/actions/meta/types';

interface AdSetStepProps {
    form: UseFormReturnType<CampaignFormValues>;
    loadingPages: boolean;
    pagesError: string | null;
    facebookPages: Array<{ page_id: string; name: string }>;
    isSmart?: boolean;
}

/**
 * Ad Set configuration step for campaign creation
 * Handles audience targeting, performance goals, and ad placements
 */
export default function AdSetStep({
    form,
    loadingPages,
    pagesError,
    facebookPages,
    isSmart = false
}: AdSetStepProps) {
    const adSetSuggestion = `${form.values.campaignName || 'Campaign'} - Ad Set ${new Date().getMonth() + 1}/${new Date().getDate()}/${new Date().getFullYear()}`;
    const [locationModalOpened, { open: openLocationModal, close: closeLocationModal }] = useDisclosure(false);
    const [audienceEstimate, setAudienceEstimate] = useState({
        size: '8.9M - 10.5M',
        qualityScore: 87,
        relevanceScore: 92
    });

    // Handle location selection from map
    const handleLocationSelect = (loc: { markerPosition: { lat: number; lng: number } | null; radius: number }) => {
        form.setFieldValue('location', loc);
        // Mock audience estimate update
        setAudienceEstimate({
            size: loc.radius > 20 ? '15.2M - 18.4M' : '8.9M - 10.5M',
            qualityScore: loc.radius > 20 ? 75 : 87,
            relevanceScore: loc.radius > 20 ? 82 : 92
        });
    };

    const validOptimizationGoals = getValidOptimizationGoals(
        form.values.objective,
        form.values.adDestinationType
    );

    const optimizationOptions = validOptimizationGoals.map(goal => ({
        value: goal,
        label: getOptimizationLabel(goal)
    }));

    // Get location display text
    const getLocationDisplay = () => {
        if (!form.values.location?.markerPosition) return 'Not set';
        return `Selected area (${form.values.location.radius} mile radius)`;
    };

    return (
        <Grid gutter="md">
            {/* Main form column */}
            <Grid.Col span={{ base: 12, md: 8 }}>
                <Card p="md" withBorder radius="md" mb="md" mt="lg">
                    <Stack>
                        {/* Header section with info based on campaign mode */}
                        {isSmart ? (
                            <Paper withBorder p="md" radius="md" bg="blue.0" shadow="sm">
                                <Stack>
                                    <Group justify="left">
                                        <ThemeIcon size="lg" radius="md" color="blue" variant="filled">
                                            <IconTarget size={20} />
                                        </ThemeIcon>
                                        <Title order={3}>Smart Audience Targeting</Title>
                                    </Group>

                                    <Text size="sm">
                                        Our AI will optimize your audience targeting based on your
                                        <b> {getObjectiveLabel(form.values.objective)}</b> objective.
                                        You can provide basic targeting parameters, and we'll refine them automatically.
                                    </Text>
                                </Stack>
                            </Paper>
                        ) : (
                            <Paper p="md" >
                                <Stack>
                                    <Group justify="left">
                                        <ThemeIcon size="lg" radius="md" color="blue" variant="filled">
                                            <IconUsersGroup size={20} />
                                        </ThemeIcon>
                                        <Title order={3}>Ad Set Configuration</Title>
                                    </Group>

                                    <Text size="sm">
                                        Define who you want to target with your ads and how you want the delivery to be optimized.
                                    </Text>
                                </Stack>
                            </Paper>
                        )}

                        {/* Ad Set Information Card */}
                        <Paper withBorder p="md" radius="md" shadow="sm">
                            <Group justify="left" mb="xs">
                                <ThemeIcon size="md" variant="filled" radius="md" color="blue">
                                    <IconUsersGroup size={18} />
                                </ThemeIcon>
                                <Title order={4}>Ad Set Information</Title>
                            </Group>

                            <Paper p="md" radius="md" withBorder shadow="xs">
                                <TextInput
                                    label="Ad Set Name"
                                    description="Give your ad set a descriptive name"
                                    placeholder={adSetSuggestion}
                                    required
                                    size="md"
                                    {...form.getInputProps('adSetName')}
                                />

                                {/* Facebook Page Selection */}
                                <Select
                                    label="Facebook Page"
                                    description="Choose the Page you want to promote"
                                    placeholder={loadingPages ? "Loading pages..." : "Select a page"}
                                    data={facebookPages.map(page => ({ value: page.page_id, label: page.name }))}
                                    disabled={loadingPages}
                                    error={pagesError}
                                    required
                                    clearable={false}
                                    mt="md"
                                    size="md"
                                    {...form.getInputProps('page_id')}
                                    onChange={(value) => {
                                        if (value) {
                                            form.setFieldValue('page_id', value);
                                        }
                                    }}
                                />
                            </Paper>
                        </Paper>

                        {/* Performance Goal Card */}
                        <Paper withBorder p="md" radius="md" shadow="sm">
                            <Group justify="left" mb="md">
                                <ThemeIcon size="md" variant="filled" radius="md" color="violet">
                                    <IconChartPie size={18} />
                                </ThemeIcon>
                                <Title order={4}>Performance Goal</Title>
                            </Group>

                            <Paper p="md" radius="md" withBorder shadow="xs">
                                {isSmart ? (
                                    <Paper withBorder p="md" radius="md" bg="white">
                                        <Group align="flex-start">
                                            <ThemeIcon size="lg" color="violet" variant="light">
                                                <IconTarget size={20} />
                                            </ThemeIcon>
                                            <Stack gap={0} style={{ flex: 1 }}>
                                                <Text fw={600}>Automatic Optimization</Text>
                                                <Text size="sm" c="dimmed">
                                                    Our AI will optimize your ad delivery based on your campaign objective:
                                                    <Badge ml={5} color="violet">{getObjectiveLabel(form.values.objective)}</Badge>
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
                                        {...form.getInputProps('optimization')}
                                        required
                                    />
                                )}
                            </Paper>
                        </Paper>

                        {/* Location Targeting Card */}
                        <Paper withBorder p="md" radius="md" shadow="sm">
                            <Group justify="left" mb="md">
                                <ThemeIcon size="md" variant="filled" radius="md" color="green">
                                    <IconMapPin size={18} />
                                </ThemeIcon>
                                <Title order={4}>Location</Title>
                            </Group>

                            <Paper p="md" radius="md" withBorder shadow="xs">
                                <Group justify="apart" mb="md">
                                    <Stack gap={0}>
                                        <Text fw={600}>Target Location</Text>
                                        <Text size="sm" c="dimmed">
                                            {getLocationDisplay()}
                                        </Text>
                                    </Stack>
                                    <Button
                                        variant="light"
                                        size="md"
                                        color="green"
                                        onClick={openLocationModal}
                                        rightSection={<IconChevronRight size={16} />}
                                    >
                                        Select Location
                                    </Button>
                                </Group>

                                {form.values.location?.markerPosition && (
                                    <Paper withBorder p="sm" radius="md" bg="green.0" shadow="xs">
                                        <Group>
                                            <ThemeIcon size="sm" variant="light" color="green" radius="xl">
                                                <IconMapPin size={14} />
                                            </ThemeIcon>
                                            <Text size="sm" fw={500}>{form.values.location.radius} mile radius</Text>
                                        </Group>
                                    </Paper>
                                )}
                            </Paper>
                        </Paper>

                        {/* Audience Controls Card */}
                        <Paper withBorder p="md" radius="md" shadow="sm">
                            <Group justify="left" mb="md">
                                <ThemeIcon size="md" variant="filled" radius="md" color="blue">
                                    <IconUsers size={18} />
                                </ThemeIcon>
                                <Title order={4}>Audience Controls</Title>
                            </Group>

                            <Stack gap="md">
                                {/* Advantage+ audience toggle */}
                                <Paper p="md" radius="md" withBorder shadow="xs">
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
                                            disabled={isSmart} // Disabled for smart campaigns as it's always ON
                                            {...form.getInputProps('useAdvantageAudience')}
                                        />
                                    </Group>

                                    {form.values.useAdvantageAudience && (
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
                                </Paper>

                                {/* Use saved audience option (only for manual campaigns) */}
                                {!isSmart && (
                                    <Paper p="md" radius="md" withBorder shadow="xs">
                                        <Group justify="space-between" wrap="nowrap">
                                            <Stack gap={0} style={{ flex: 1 }}>
                                                <Text fw={600}>Use Saved Audience</Text>
                                                <Text size="sm" c="dimmed">
                                                    Select a previously saved audience for this campaign
                                                </Text>
                                            </Stack>
                                            <Switch
                                                size="md"
                                                disabled={true} // Disabled for now
                                                onLabel="ON"
                                                offLabel="OFF"
                                                color="blue"
                                                {...form.getInputProps('useSavedAudience')}
                                            />
                                        </Group>

                                        {form.values.useSavedAudience && (
                                            <Select
                                                label="Saved Audience"
                                                placeholder="Select a saved audience"
                                                data={[
                                                    { value: 'audience_1', label: 'US Mobile Users' },
                                                    { value: 'audience_2', label: 'Local Customers' },
                                                    { value: 'audience_3', label: 'Website Visitors' },
                                                ]}
                                                size="md"
                                                {...form.getInputProps('savedAudienceId')}
                                                mt="md"
                                            />
                                        )}
                                    </Paper>
                                )}

                                {/* Demographics Card */}
                                <Paper p="md" radius="md" withBorder shadow="xs">
                                    <Group justify="left" mb="md">
                                        <ThemeIcon size="sm" variant="filled" radius="md" color="indigo">
                                            <IconUsers size={14} />
                                        </ThemeIcon>
                                        <Text fw={600} size="md">Demographics</Text>
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
                                            {...form.getInputProps('ageMin')}
                                        />

                                        <Select
                                            label="Maximum Age"
                                            data={[
                                                { value: '24', label: '24' },
                                                { value: '34', label: '34' },
                                                { value: '44', label: '44' },
                                                { value: '54', label: '54' },
                                                { value: '65', label: '65' },
                                                { value: '100', label: '65+' },
                                            ]}
                                            defaultValue="65"
                                            size="md"
                                            {...form.getInputProps('ageMax')}
                                        />
                                    </Group>

                                    {/* Gender Selection */}
                                    <Radio.Group
                                        label="Gender"
                                        description="Select gender targeting"
                                        defaultValue="all"
                                        size="md"
                                        {...form.getInputProps('genders')}
                                    >
                                        <Group mt="xs">
                                            <Radio value="all" label="All" />
                                            <Radio value="male" label="Male" />
                                            <Radio value="female" label="Female" />
                                        </Group>
                                    </Radio.Group>
                                </Paper>

                                {/* Languages */}
                                <Paper p="md" radius="md" withBorder shadow="xs">
                                    <Select
                                        label="Languages"
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
                                        {...form.getInputProps('languages')}
                                    />
                                </Paper>

                                {/* Detailed Targeting (only for manual campaigns) */}
                                {!isSmart && (
                                    <Paper p="md" radius="md" withBorder shadow="xs">
                                        <Group justify="left" mb="md">
                                            <ThemeIcon size="sm" variant="filled" radius="md" color="cyan">
                                                <IconTarget size={14} />
                                            </ThemeIcon>
                                            <Text fw={600} size="md">Detailed Targeting</Text>
                                        </Group>

                                        <TextInput
                                            label="Interests"
                                            description="Comma-separated list of interests"
                                            placeholder="e.g. fitness, cooking, technology"
                                            size="md"
                                            {...form.getInputProps('interests')}
                                        />
                                        <TextInput
                                            label="Behaviors"
                                            description="Comma-separated list of behaviors"
                                            placeholder="e.g. online shoppers, travelers"
                                            mt="md"
                                            size="md"
                                            {...form.getInputProps('behaviors')}
                                        />
                                    </Paper>
                                )}
                            </Stack>
                        </Paper>

                        {/* Placements Card */}
                        <Paper withBorder p="md" radius="md" shadow="sm">
                            <Group justify="left" mb="md">
                                <ThemeIcon size="md" variant="filled" radius="md" color="orange">
                                    <IconDevices size={18} />
                                </ThemeIcon>
                                <Title order={4}>Ad Placements</Title>
                            </Group>

                            <Paper p="md" radius="md" withBorder shadow="xs">
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
                                        disabled={isSmart} // Disabled for smart campaigns
                                        {...form.getInputProps('useAdvantagePlacements')}
                                    />
                                </Group>

                                {!form.values.useAdvantagePlacements && !isSmart && (
                                    <Paper withBorder p="md" radius="md" bg="white" shadow="xs" mt="xl">
                                        <Stack gap="xs">
                                            <Text fw={600} size="sm">Manual Placements</Text>
                                            <Text size="xs" c="dimmed">Select where your ads will appear</Text>

                                            <Checkbox.Group
                                                defaultValue={['facebook', 'instagram']}
                                                {...form.getInputProps('placementTypes')}
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
    );
}