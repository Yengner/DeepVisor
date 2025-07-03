'use client';

import {
    Button, Card, Divider, Group, Paper, Radio, Select, Stack, Text, TextInput,
    ThemeIcon, Title, Switch, Alert, SegmentedControl, Grid, Badge, NumberInput,
    Tooltip, ActionIcon, Box
} from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import {
    IconBuildingStore, IconInfoCircle, IconChartBar, IconCoin,
    IconCheckbox, IconCalendar, IconCurrencyDollar, IconAdjustments,
    IconArrowAutofitUp, IconBuildingBank, IconBulb
} from '@tabler/icons-react';
import { getObjectiveLabel, getValidDestinationTypes } from '@/components/campaigns/create/common/utils/objectiveMappings';
import { UseFormReturnType } from '@mantine/form';
import { CampaignFormValues } from '@/lib/actions/meta/types';

interface CampaignDetailsStepProps {
    form: UseFormReturnType<CampaignFormValues>;
    handleDestinationChange: (value: string) => void;
    getDestinationConfig: (destinationType: string) => { label: string; description: string };
    isSmart?: boolean;
    setPresetModalOpened?: (opened: boolean) => void;
}

export default function CampaignDetailsStep({
    form,
    handleDestinationChange,
    getDestinationConfig,
    isSmart = false,
    setPresetModalOpened
}: CampaignDetailsStepProps) {
    // Determine recommended settings based on objective
    const getRecommendedSettings = () => {
        const objective = form.values.objective;

        // Default recommendations
        let recommended = {
            buyingType: 'AUCTION',
            budgetType: 'daily',
            bidStrategy: 'LOWEST_COST_WITHOUT_CAP',
            campaignBudgetOptimization: true,
            minBudget: 5,
            abTesting: false
        };

        // Customize based on objective
        switch (objective) {
            case 'REACH':
                recommended.buyingType = 'REACH_AND_FREQUENCY';
                recommended.bidStrategy = 'LOWEST_COST_WITH_BID_CAP';
                recommended.minBudget = 50;
                break;
            case 'AWARENESS':
                recommended.bidStrategy = 'LOWEST_COST_WITHOUT_CAP';
                break;
            case 'TRAFFIC':
                recommended.abTesting = true;
                break;
            case 'ENGAGEMENT':
                recommended.budgetType = 'lifetime';
                break;
            case 'APP_INSTALLS':
                recommended.minBudget = 30;
                break;
            case 'VIDEO_VIEWS':
                recommended.budgetType = 'lifetime';
                break;
            case 'LEAD_GENERATION':
                recommended.campaignBudgetOptimization = true;
                recommended.abTesting = true;
                break;
            case 'CONVERSIONS':
                recommended.minBudget = 50;
                recommended.campaignBudgetOptimization = true;
                break;
            case 'PRODUCT_CATALOG_SALES':
                recommended.minBudget = 40;
                break;
            case 'STORE_TRAFFIC':
                recommended.bidStrategy = 'LOWEST_COST_WITH_MIN_ROAS';
                break;
            default:
                break;
        }

        return recommended;
    };

    const recommended = getRecommendedSettings();

    // Check if current settings match recommendations
    const isUsingRecommendedBuying = form.values.buying_type === recommended.buyingType;
    const isUsingRecommendedBudgetType = form.values.budgetType === recommended.budgetType;
    const isUsingRecommendedBudgetAmount = form.values.budget >= recommended.minBudget;
    const isUsingRecommendedCBO = form.values.campaign_budget_optimization === recommended.campaignBudgetOptimization;
    const isUsingRecommendedBidStrategy = form.values.bidStrategy === recommended.bidStrategy;
    const isUsingRecommendedABTesting = form.values.ab_testing === recommended.abTesting;

    return (
        <Grid gutter="md">
            {/* Left column with form inputs */}
            <Grid.Col span={{ base: 12, md: 8 }}>
                {/* Campaign Basic Information Card */}
                <Card p="md" withBorder radius="md" mb="md" shadow="xs">
                    <Stack>
                        <Group justify="left" mb="xs" mt="sm">
                            <ThemeIcon size="md" variant="filled" radius="md" color="blue">
                                <IconBuildingStore size={18} />
                            </ThemeIcon>
                            <Title order={4}>Campaign Information</Title>
                        </Group>

                        <Paper p="md" radius="md" withBorder shadow="sm">
                            {/* Campaign Name */}
                            <TextInput
                                label="Campaign Name"
                                description="Give your campaign a descriptive name"
                                placeholder="Spring Sale 2025"
                                required
                                size="md"
                                {...form.getInputProps('campaignName')}
                            />

                            {/* Objective (display only since it was set in previous step) */}
                            <Paper withBorder p="sm" mt="md" radius="md" bg="white" shadow="xs">
                                <Group justify="apart">
                                    <Stack gap={0}>
                                        <Text size="sm" fw={500}>Campaign Objective</Text>
                                        <Text size="sm" c="dimmed">Set in previous step</Text>
                                    </Stack>
                                    <Badge size="lg" color="blue" variant="filled">
                                        {getObjectiveLabel(form.values.objective)}
                                    </Badge>
                                </Group>
                            </Paper>

                            {/* Buying Type Selection */}
                            <Stack gap="xs" mt="md">
                                <Group justify="apart">
                                    <Text fw={600} size="sm">Buying Type</Text>
                                    {!isUsingRecommendedBuying && (
                                        <Tooltip label="Recommended setting is different">
                                            <Badge color="yellow" variant="light">Custom</Badge>
                                        </Tooltip>
                                    )}
                                </Group>
                                <Text size="xs" c="dimmed">Choose how you want to buy your ads</Text>
                                <SegmentedControl
                                    data={[
                                        { label: 'Auction', value: 'AUCTION' },
                                        { label: 'Reach & Frequency', value: 'REACH_AND_FREQUENCY' }
                                    ]}
                                    {...form.getInputProps('buying_type')}
                                    onChange={(value) => form.setFieldValue('buying_type', value)}
                                    fullWidth
                                    size="md"
                                    color="blue"
                                    radius="md"
                                />

                                {form.values.buying_type === 'REACH_AND_FREQUENCY' && (
                                    <Alert
                                        icon={<IconInfoCircle size={16} />}
                                        color="blue"
                                        title="Reach & Frequency Buying"
                                        variant="light"
                                        radius="md"
                                    >
                                        This buying type lets you plan and buy campaigns in advance with predictable reach,
                                        frequency and cost. Available for campaigns with a minimum budget of $1,000.
                                    </Alert>
                                )}
                            </Stack>

                            {/* A/B Test Toggle */}
                            <Paper withBorder p="md" radius="md" bg="white" shadow="xs" mt="xl">
                                <Group justify="apart">
                                    <div>
                                        <Text fw={600} size="sm">A/B Testing</Text>
                                        <Text size="xs" c="dimmed">
                                            Test multiple ad variations to see which performs best
                                        </Text>
                                    </div>
                                    <Group>
                                        {!isUsingRecommendedABTesting && (
                                            <Tooltip label="A/B Testing is recommended for this objective">
                                                <Badge color="yellow" variant="light" mr="xs">Custom</Badge>
                                            </Tooltip>
                                        )}
                                        <Switch
                                            onLabel="ON"
                                            offLabel="OFF"
                                            size="md"
                                            color="blue"
                                            checked={form.values.ab_testing === true}
                                            onChange={(event) => form.setFieldValue('ab_testing', event.currentTarget.checked)}
                                        />
                                    </Group>
                                </Group>

                                {form.values.ab_testing === true && (
                                    <Paper withBorder p="md" radius="md" bg="blue.0" mt="md">
                                        <Group align="flex-start">
                                            <ThemeIcon variant="light" size="lg" radius="xl" color="blue">
                                                <IconChartBar size={20} />
                                            </ThemeIcon>
                                            <Stack gap={5}>
                                                <Text fw={500} size="sm">A/B Testing Enabled</Text>
                                                <Text size="xs">
                                                    You'll be able to create multiple ad variations in the creative step.
                                                    Meta will automatically optimize delivery to the best-performing version.
                                                </Text>
                                            </Stack>
                                        </Group>
                                    </Paper>
                                )}
                            </Paper>
                        </Paper>
                    </Stack>
                </Card>

                {/* Campaign Budget Card */}
                <Card p="md" withBorder radius="md" mb="md" shadow="xs">
                    <Stack>
                        <Group justify="left" mb="xs" mt="sm">
                            <ThemeIcon size="md" variant="filled" radius="md" color="green">
                                <IconCurrencyDollar size={18} />
                            </ThemeIcon>
                            <Title order={4}>Campaign Budget</Title>
                        </Group>

                        <Paper p="md" radius="md" withBorder shadow="sm">
                            {/* Campaign Budget Optimization Toggle */}
                            <Paper withBorder p="md" radius="md" bg="white" shadow="xs">
                                <Group justify="apart">
                                    <div>
                                        <Text fw={600} size="sm">Campaign Budget Optimization</Text>
                                        <Text size="xs" c="dimmed">
                                            Automatically distribute budget across ad sets
                                        </Text>
                                    </div>
                                    <Group>
                                        {!isUsingRecommendedCBO && (
                                            <Tooltip label="CBO is recommended for this objective">
                                                <Badge color="yellow" variant="light" mr="xs">Custom</Badge>
                                            </Tooltip>
                                        )}
                                        <Switch
                                            onLabel="ON"
                                            offLabel="OFF"
                                            size="md"
                                            color="green"
                                            checked={form.values.campaign_budget_optimization === true}
                                            onChange={(event) => form.setFieldValue('campaign_budget_optimization', event.currentTarget.checked)}
                                        />
                                    </Group>
                                </Group>

                                {form.values.campaign_budget_optimization === true && (
                                    <Alert
                                        icon={<IconInfoCircle size={16} />}
                                        color="green"
                                        title="Budget Optimization Enabled"
                                        variant="light"
                                        radius="md"
                                        mt="md"
                                    >
                                        Meta will automatically distribute your campaign budget across ad sets to get the best results.
                                    </Alert>
                                )}
                            </Paper>

                            {/* Budget Type Selection */}
                            <Stack gap="xs" mt="xl">
                                <Group justify="apart">
                                    <Text fw={600} size="sm">Budget Type</Text>
                                    {!isUsingRecommendedBudgetType && (
                                        <Tooltip label={`${recommended.budgetType.charAt(0).toUpperCase() + recommended.budgetType.slice(1)} budget is recommended`}>
                                            <Badge color="yellow" variant="light">Custom</Badge>
                                        </Tooltip>
                                    )}
                                </Group>
                                <SegmentedControl
                                    data={[
                                        { label: 'Daily Budget', value: 'daily' },
                                        { label: 'Lifetime Budget', value: 'lifetime' }
                                    ]}
                                    {...form.getInputProps('budgetType')}
                                    onChange={(value) => form.setFieldValue('budgetType', value)}
                                    fullWidth
                                    size="md"
                                    color="green"
                                    radius="md"
                                />
                            </Stack>

                            {/* Budget Amount */}
                            <Paper withBorder p="md" radius="md" bg="white" shadow="xs" mt="xl">
                                <NumberInput
                                    label="Budget Amount"
                                    description={`How much do you want to spend ${form.values.budgetType === 'daily' ? 'per day' : 'in total'}`}
                                    placeholder="20"
                                    min={5}
                                    step={5}
                                    required
                                    size="md"
                                    leftSection={<IconCurrencyDollar size={18} color="green" />}
                                    {...form.getInputProps('budget')}
                                    rightSection={
                                        !isUsingRecommendedBudgetAmount && (
                                            <Tooltip label={`Recommended minimum budget: $${recommended.minBudget}`}>
                                                <ActionIcon variant="subtle" color="yellow" size="lg">
                                                    <IconInfoCircle size={20} />
                                                </ActionIcon>
                                            </Tooltip>
                                        )
                                    }
                                />
                            </Paper>

                            {/* Campaign Schedule */}
                            <Paper withBorder p="md" radius="md" bg="white" shadow="xs" mt="xl">
                                <Text fw={600} size="sm" mb="md">Campaign Schedule</Text>
                                <Grid gutter="md">
                                    <Grid.Col span={6}>
                                        <DateTimePicker
                                            label="Start Date"
                                            placeholder="Select date and time"
                                            required
                                            minDate={new Date()}
                                            leftSection={<IconCalendar size={18} color="green" />}
                                            size="md"
                                            {...form.getInputProps('startDate')}
                                        />
                                    </Grid.Col>
                                    <Grid.Col span={6}>
                                        <DateTimePicker
                                            label="End Date"
                                            placeholder="Select date and time"
                                            minDate={form.values.startDate || new Date()}
                                            leftSection={<IconCalendar size={18} color="green" />}
                                            size="md"
                                            {...form.getInputProps('endDate')}
                                        />
                                    </Grid.Col>

                                </Grid>
                            </Paper>
                        </Paper>
                    </Stack>
                </Card>

                {/* Conversion Location Card */}
                <Card p="md" withBorder radius="md" mb="md" shadow="xs">
                    <Stack>
                        <Group justify="left" mb="xs" mt="sm">
                            <ThemeIcon size="md" variant="filled" radius="md" color="indigo">
                                <IconArrowAutofitUp size={18} />
                            </ThemeIcon>
                            <Title order={4}>Conversion Location</Title>
                        </Group>

                        <Paper p="md" radius="md" withBorder shadow="sm">
                            <Text fw={600} size="sm">Choose where you want to generate leads</Text>
                            <Text size="xs" c="dimmed" mb="md">Select the best option for your business</Text>

                            <Radio.Group
                                required
                                {...form.getInputProps('destinationType')}
                                onChange={(value) => handleDestinationChange(value)}
                            >
                                <Stack gap="md">
                                    {/* Dynamically generate destination options based on selected objective */}
                                    {getValidDestinationTypes(form.values.objective).map(destType => {
                                        const config = getDestinationConfig(destType);

                                        return (
                                            <Paper
                                                key={destType}
                                                withBorder
                                                p="md"
                                                radius="md"
                                                shadow={form.values.destinationType === destType ? "sm" : "xs"}
                                                onClick={() => handleDestinationChange(destType)}
                                                style={{
                                                    cursor: 'pointer',
                                                    borderColor: form.values.destinationType === destType ? 'var(--mantine-color-indigo-6)' : undefined,
                                                    backgroundColor: form.values.destinationType === destType ? 'var(--mantine-color-indigo-0)' : undefined,
                                                    transform: form.values.destinationType === destType ? 'translateY(-2px)' : undefined,
                                                    transition: 'all 0.2s ease'
                                                }}
                                            >
                                                <Group align="flex-start">
                                                    <Radio
                                                        value={destType}
                                                        checked={form.values.destinationType === destType}
                                                        color="indigo"
                                                        size="md"
                                                    />
                                                    <Stack gap="xs">
                                                        <Text fw={600}>{config.label}</Text>
                                                        <Text size="sm" c="dimmed">{config.description}</Text>
                                                    </Stack>
                                                </Group>
                                            </Paper>
                                        );
                                    })}
                                </Stack>
                            </Radio.Group>
                        </Paper>
                    </Stack>
                </Card>
            </Grid.Col>

            {/* Right column with recommendations */}
            <Grid.Col span={{ base: 12, md: 4 }}>
                <Box style={{ position: 'sticky', top: '20px' }}>
                    <Card p="md" mb="md">
                        <Group mb="md" justify="apart">
                            <Title order={4}>Recommended Settings</Title>
                            <ThemeIcon size="md" variant="filled" radius="md" color="blue">
                                <IconBulb size={18} />
                            </ThemeIcon>
                        </Group>

                        <Paper withBorder p="md" radius="md" mb="md" shadow="xs">
                            <Group justify="apart" mb="xs">
                                <Text fw={600}>For {getObjectiveLabel(form.values.objective)} Campaigns</Text>
                                <ThemeIcon size="md" variant="light" radius="xl" color="blue">
                                    <IconBulb size={16} />
                                </ThemeIcon>
                            </Group>
                            <Text size="sm" c="dimmed" mb="md">
                                These settings have been shown to perform well for your campaign objective.
                            </Text>

                            <Stack gap="xs">
                                <Paper withBorder p="xs" radius="sm" bg="blue.0">
                                    <Group justify="apart">
                                        <Text size="sm" fw={500}>Buying Type:</Text>
                                        <Badge color="blue" size="lg">
                                            {recommended.buyingType === 'AUCTION' ? 'Auction' : 'Reach & Frequency'}
                                        </Badge>
                                    </Group>
                                </Paper>

                                <Paper withBorder p="xs" radius="sm" bg="blue.0">
                                    <Group justify="apart">
                                        <Text size="sm" fw={500}>Campaign Budget Optimization:</Text>
                                        <Badge color="blue" size="lg">
                                            {recommended.campaignBudgetOptimization ? 'Enabled' : 'Disabled'}
                                        </Badge>
                                    </Group>
                                </Paper>

                                <Paper withBorder p="xs" radius="sm" bg="blue.0">
                                    <Group justify="apart">
                                        <Text size="sm" fw={500}>Budget Type:</Text>
                                        <Badge color="blue" size="lg">
                                            {recommended.budgetType.charAt(0).toUpperCase() + recommended.budgetType.slice(1)}
                                        </Badge>
                                    </Group>
                                </Paper>

                                <Paper withBorder p="xs" radius="sm" bg="blue.0">
                                    <Group justify="apart">
                                        <Text size="sm" fw={500}>Minimum Budget:</Text>
                                        <Badge color="blue" size="lg">${recommended.minBudget}</Badge>
                                    </Group>
                                </Paper>

                                <Paper withBorder p="xs" radius="sm" bg="blue.0">
                                    <Group justify="apart">
                                        <Text size="sm" fw={500}>Bid Strategy:</Text>
                                        <Badge color="blue" size="lg">
                                            {recommended.bidStrategy === 'LOWEST_COST_WITHOUT_CAP' ? 'Lowest Cost (Auto)' :
                                                recommended.bidStrategy === 'LOWEST_COST_WITH_BID_CAP' ? 'Bid Cap' :
                                                    recommended.bidStrategy === 'LOWEST_COST_WITH_MIN_ROAS' ? 'Min ROAS' : 'Cost Cap'}
                                        </Badge>
                                    </Group>
                                </Paper>

                                <Paper withBorder p="xs" radius="sm" bg="blue.0">
                                    <Group justify="apart">
                                        <Text size="sm" fw={500}>A/B Testing:</Text>
                                        <Badge color="blue" size="lg">
                                            {recommended.abTesting ? 'Recommended' : 'Optional'}
                                        </Badge>
                                    </Group>
                                </Paper>
                            </Stack>
                        </Paper>

                        {/* <Paper withBorder p="md" radius="md" mb="md" shadow="xs" bg="blue.0">
                            <Group justify="apart" mb="xs">
                                <Text fw={600}>Your Settings Comparison</Text>
                                <ThemeIcon size="md" variant="light" radius="xl" color="blue">
                                    <IconCheckbox size={16} />
                                </ThemeIcon>
                            </Group>

                            <Stack gap="md">
                                <Paper withBorder p="xs" radius="sm" bg="white">
                                    <Group justify="apart">
                                        <Text size="sm" fw={500}>Buying Type:</Text>
                                        <Badge color={isUsingRecommendedBuying ? "green" : "yellow"} size="lg">
                                            {isUsingRecommendedBuying ? 'Matches Recommendation' : 'Custom'}
                                        </Badge>
                                    </Group>
                                </Paper>

                                <Paper withBorder p="xs" radius="sm" bg="white">
                                    <Group justify="apart">
                                        <Text size="sm" fw={500}>CBO:</Text>
                                        <Badge color={isUsingRecommendedCBO ? "green" : "yellow"} size="lg">
                                            {isUsingRecommendedCBO ? 'Matches Recommendation' : 'Custom'}
                                        </Badge>
                                    </Group>
                                </Paper>

                                <Paper withBorder p="xs" radius="sm" bg="white">
                                    <Group justify="apart">
                                        <Text size="sm" fw={500}>Budget Type:</Text>
                                        <Badge color={isUsingRecommendedBudgetType ? "green" : "yellow"} size="lg">
                                            {isUsingRecommendedBudgetType ? 'Matches Recommendation' : 'Custom'}
                                        </Badge>
                                    </Group>
                                </Paper>

                                <Paper withBorder p="xs" radius="sm" bg="white">
                                    <Group justify="apart">
                                        <Text size="sm" fw={500}>Budget Amount:</Text>
                                        <Badge color={isUsingRecommendedBudgetAmount ? "green" : "yellow"} size="lg">
                                            {isUsingRecommendedBudgetAmount ? 'Meets Minimum' : 'Below Recommended'}
                                        </Badge>
                                    </Group>
                                </Paper>

                                <Paper withBorder p="xs" radius="sm" bg="white">
                                    <Group justify="apart">
                                        <Text size="sm" fw={500}>Bid Strategy:</Text>
                                        <Badge color={isUsingRecommendedBidStrategy ? "green" : "yellow"} size="lg">
                                            {isUsingRecommendedBidStrategy ? 'Matches Recommendation' : 'Custom'}
                                        </Badge>
                                    </Group>
                                </Paper>

                                {recommended.abTesting && (
                                    <Paper withBorder p="xs" radius="sm" bg="white">
                                        <Group justify="apart">
                                            <Text size="sm" fw={500}>A/B Testing:</Text>
                                            <Badge color={isUsingRecommendedABTesting ? "green" : "yellow"} size="lg">
                                                {isUsingRecommendedABTesting ? 'Enabled as Recommended' : 'Not Enabled'}
                                            </Badge>
                                        </Group>
                                    </Paper>
                                )}
                            </Stack>
                        </Paper>

                        <Paper withBorder p="md" radius="md" shadow="xs">
                            <Group justify="apart" mb="xs">
                                <Text fw={600}>Campaign Tips</Text>
                                <ThemeIcon size="md" variant="filled" radius="md" color="green">
                                    <IconBuildingBank size={16} />
                                </ThemeIcon>
                            </Group>

                            <Stack gap="md" mt="md">
                                <Paper withBorder p="md" radius="md" bg="green.0">
                                    <Text size="sm">
                                        {form.values.objective === 'LEAD_GENERATION' ?
                                            "For lead generation campaigns, consider enabling A/B testing and Campaign Budget Optimization for better results." :
                                            form.values.objective === 'CONVERSIONS' ?
                                                "Conversion campaigns perform better with higher initial budgets to gather conversion data quickly." :
                                                form.values.objective === 'REACH' ?
                                                    "For reach campaigns, the Reach & Frequency buying type gives you more predictable results." :
                                                    "Set a budget that allows your ads enough time to gather data before making optimizations."}
                                    </Text>
                                </Paper>

                                {form.values.budget < 10 && (
                                    <Alert color="yellow" title="Low Budget Warning" icon={<IconInfoCircle size={16} />} variant="outline">
                                        Your budget is relatively low. Meta campaigns typically perform better with budgets of at least $10-20 per day.
                                    </Alert>
                                )}
                            </Stack>
                        </Paper> */}
                    </Card>
                </Box>
            </Grid.Col>
        </Grid>
    );
}