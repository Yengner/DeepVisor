'use client';

import {
    Card, Group, Paper, Radio, Stack, Text, ThemeIcon, Title, Divider, Box
} from '@mantine/core';
import {
    IconCheckbox
} from '@tabler/icons-react';
import { CAMPAIGN_OBJECTIVES } from '../utils/objectiveMappings';
import { getObjectiveIcon } from '../utils/iconHelpers';


interface ObjectiveStepProps {
    form: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    isFast?: boolean;
}

export default function ObjectiveStep({
    form,
    isFast = false
}: ObjectiveStepProps) {

    return (
        <Card p="md" withBorder radius="md" mb="md" mt="lg">
            <Stack>
                <Title order={3}>Choose a campaign objective</Title>
                <Text c="dimmed" size="sm">
                    {isFast
                        ? "Our AI will optimize your campaign based on the objective you select"
                        : "What's the main result you want from this campaign?"}
                </Text>

                <Divider my="md" />
                <Stack style={{ flex: 1 }} />

                <Group align="flex-start" grow>
                    {/* Left side: objective options */}
                    <Stack style={{ flex: 1 }}>
                        <Radio.Group
                            value={form.values.campaign.objective}
                            name="objective"
                            withAsterisk
                        >
                            <Stack gap="md">
                                {Object.entries(CAMPAIGN_OBJECTIVES).map(([key, value]) => (
                                    <Paper
                                        key={key}
                                        withBorder
                                        p="md"
                                        radius="md"
                                        bg={form.values.campaign.objective === value ? 'blue.0' : undefined}
                                        style={{
                                            borderColor: form.values.campaign.objective === value ? 'var(--mantine-color-blue-6)' : undefined,
                                            borderWidth: form.values.campaign.objective === value ? 2 : 1,
                                            cursor: 'pointer'
                                        }}
                                        onClick={() => form.setFieldValue('campaign.objective', value)}
                                    >
                                        <Group align="center">
                                            <Radio
                                                value={value}
                                                checked={form.values.campaign.objective === value}
                                                styles={{ body: { width: '100%' } }}
                                            />
                                            <Group gap="md" style={{ flex: 1 }}>
                                                <ThemeIcon size="lg" radius="md" color="blue" variant={form.values.campaign.objective === value ? "filled" : "light"}>
                                                    {getObjectiveIcon(value)}
                                                </ThemeIcon>
                                                <Text fw={500}>{key.charAt(0) + key.slice(1).toLowerCase()}</Text>
                                            </Group>
                                        </Group>
                                    </Paper>
                                ))}
                            </Stack>
                        </Radio.Group>
                    </Stack>

                    {/* Right side: objective details */}
                    <Card withBorder radius="md" p="md" style={{ flex: 1, height: '100%' }}>
                        {/* Leads objective details */}
                        {form.values.campaign.objective === CAMPAIGN_OBJECTIVES.LEADS && (
                            <ObjectiveDetails
                                title="Leads"
                                description="Collect leads for your business or brand."
                                icon={getObjectiveIcon(CAMPAIGN_OBJECTIVES.LEADS)}
                                features={[
                                    "Website and instant forms",
                                    "Instant forms",
                                    "Messenger, Instagram and WhatsApp",
                                    "Conversions",
                                    "Calls"
                                ]}
                            />
                        )}

                        {/* Traffic objective details */}
                        {form.values.campaign.objective === CAMPAIGN_OBJECTIVES.TRAFFIC && (
                            <ObjectiveDetails
                                title="Traffic"
                                description="Send people to a destination, like your website, app, Instagram profile or Facebook event."
                                icon={getObjectiveIcon(CAMPAIGN_OBJECTIVES.TRAFFIC)}
                                features={[
                                    "Link clicks",
                                    "Landing page views",
                                    "Instagram profile visits",
                                    "Messenger, Instagram and WhatsApp",
                                    "Calls"
                                ]}
                            />
                        )}

                        {/* Engagement objective details */}
                        {form.values.campaign.objective === CAMPAIGN_OBJECTIVES.ENGAGEMENT && (
                            <ObjectiveDetails
                                title="Engagement"
                                description="Get more messages, purchases through messaging, video views, post engagement, Page likes or event responses."
                                icon={getObjectiveIcon(CAMPAIGN_OBJECTIVES.ENGAGEMENT)}
                                features={[
                                    "Messenger, Instagram and WhatsApp",
                                    "Video views",
                                    "Post engagement",
                                    "Conversions",
                                    "Calls"
                                ]}
                            />
                        )}

                        {/* Awareness objective details */}
                        {form.values.campaign.objective === CAMPAIGN_OBJECTIVES.AWARENESS && (
                            <ObjectiveDetails
                                title="Awareness"
                                description="Show your ads to people who are most likely to remember them."
                                icon={getObjectiveIcon(CAMPAIGN_OBJECTIVES.AWARENESS)}
                                features={[
                                    "Reach",
                                    "Brand awareness",
                                    "Video views",
                                    "Store location awareness"
                                ]}
                            />
                        )}

                        {/* App promotion objective details */}
                        {form.values.campaign.objective === CAMPAIGN_OBJECTIVES.APP_PROMOTION && (
                            <ObjectiveDetails
                                title="App promotion"
                                description="Find new people to install your app and continue using it."
                                icon={getObjectiveIcon(CAMPAIGN_OBJECTIVES.APP_PROMOTION)}
                                features={[
                                    "App installs",
                                    "App events"
                                ]}
                            />
                        )}

                        {/* Sales objective details */}
                        {form.values.campaign.objective === CAMPAIGN_OBJECTIVES.SALES && (
                            <ObjectiveDetails
                                title="Sales"
                                description="Find people likely to purchase your product or service."
                                icon={getObjectiveIcon(CAMPAIGN_OBJECTIVES.SALES)}
                                features={[
                                    "Conversions",
                                    "Catalog sales",
                                    "Messenger, Instagram and WhatsApp",
                                    "Calls"
                                ]}
                            />
                        )}
                    </Card>
                </Group>

                {/* Additional info for smart campaigns */}
                {isFast && (
                    <Paper withBorder p="md" radius="md" bg="green.0" mt="md">
                        <Group>
                            <ThemeIcon color="green" variant="light" size="lg" radius="xl">
                                <IconCheckbox size={20} />
                            </ThemeIcon>
                            <Text size="sm">
                                Our AI will automatically optimize your campaign based on the selected objective.
                                We&apos;ll continuously learn and adjust your targeting and creative delivery for best results.
                            </Text>
                        </Group>
                    </Paper>
                )}
            </Stack>

        </Card >
    );
}

interface ObjectiveDetailsProps {
    title: string;
    description: string;
    icon: React.ReactNode;
    features: string[];
}

function ObjectiveDetails({
    title,
    description,
    icon,
    features
}: ObjectiveDetailsProps) {
    return (
        <Stack>
            <Box style={{ position: 'relative', paddingRight: 50 }}>
                <Stack gap={0} pr="xl">
                    <Title order={3}>{title}</Title>
                    <Text size="sm" mt="xs">{description}</Text>
                </Stack>
                <Box
                    style={{
                        position: 'absolute',
                        top: 0,
                        right: 0,
                        backgroundColor: 'var(--mantine-color-blue-0)',
                        borderRadius: '50%',
                        padding: '10px',
                        width: 80,
                        height: 80,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <ThemeIcon color="blue" variant="light" radius="xl" size={60}>
                        {icon}
                    </ThemeIcon>
                </Box>
            </Box>

            <Divider my="md" />

            <Text fw={500} size="sm">Good for:</Text>
            <Stack gap="xs">
                {features.map((feature, index) => (
                    <Paper key={index} withBorder p="xs" radius="md">
                        <Group>
                            <ThemeIcon color="blue" variant="light" size="sm" radius="xl">
                                <IconCheckbox size={14} />
                            </ThemeIcon>
                            <Text size="sm">{feature}</Text>
                        </Group>
                    </Paper>
                ))}
            </Stack>
        </Stack>
    );
}