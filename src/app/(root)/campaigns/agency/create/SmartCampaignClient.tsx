'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    Container, Card, Title, Text, Button, Group, Loader, Select, TextInput, NumberInput, Stack, Divider, Box, Grid, Paper
} from '@mantine/core';
import { IconBulb } from '@tabler/icons-react';
import { useForm } from '@mantine/form';

const TIMEFRAMES = [
    { value: '7', label: '1 Week' },
    { value: '30', label: '1 Month' },
    { value: '90', label: '3 Months' },
];

const OBJECTIVES = [
    { value: 'OUTCOME_LEADS', label: 'Leads' },
];

const BUDGET_TYPES = [
    { value: 'daily', label: 'Daily Budget' },
    { value: 'lifetime', label: 'Lifetime Budget' },
];

const DestinationTypes = [
    { value: 'ON_AD', label: 'Lead Form' },
    { value: 'MESSENGER', label: 'Messenger' },
    { value: 'LEAD_FROM_IG_DIRECT', label: 'Instagram Direct' },
    { value: 'PHONE_CALL', label: 'Phone Call' },
];

export default function SmartCampaignClient({
    userId,
    platformName,
    platformId,
    adAccountId,
}: { userId: string, platformName: string; platformId: string; adAccountId: string }) {
    const router = useRouter();
    const form = useForm({
        initialValues: {
            budgetType: 'daily',
            budget: 32,
            objective: 'OUTCOME_LEADS',
            destinationType: 'ON_AD',
            timeframe: '30',
            creatives: '',
            // Optional user-editables:
            link: 'https://fb.me/',
            message: '',
            imageHash: '',
            formId: ''
        },
        validate: {
            budget: v => (v && Number(v) > 0 ? null : 'Budget must be greater than 0'),
            objective: v => (v ? null : 'Objective is required'),
            destinationType: v => (v ? null : 'Destination type is required'),
            timeframe: v => (v ? null : 'Timeframe is required'),
        },
    });

    const [loading, setLoading] = useState(false);

    // Calculate total campaign cost
    const days = Number(form.values.timeframe);
    const totalCost = form.values.budgetType === 'daily'
        ? days * Number(form.values.budget)
        : Number(form.values.budget || 0);

    async function handleSubmit(values: typeof form.values) {
        setLoading(true);
        try {
            const res = await fetch('/api/n8n/campaign/create-draft', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    platformId,
                    adAccountId,
                    budget: Number(values.budget),
                    budgetType: values.budgetType,
                    objective: values.objective,
                    destinationType: values.destinationType,
                    timeframe: Number(values.timeframe),
                    creatives: values.creatives,
                    link: values.link,
                    message: values.message,
                    imageHash: values.imageHash,
                    formId: values.formId,
                }),
            });
            // router.push('/campaigns/agency/status');
            const data = await res.json();
            if (!res.ok || !data?.draftId) throw new Error(data?.error || 'Draft init failed');
            router.push(`/campaigns/drafts/${data.draftId}`);

        } catch (error) {
            setLoading(false);
            console.error('Error creating campaign:', error);
        }
    }

    return (
        <Container size="sm" py="xl">
            <Card withBorder p="xl" radius="md">
                <Group align="center" mb="md">
                    <IconBulb size={32} color="#fab005" />
                    <Title order={2}>Create Smart Campaign</Title>
                </Group>
                <Text mb="xs">
                    <b>Platform:</b> <span style={{ color: '#228be6' }}>{platformName}</span>
                </Text>
                <Divider my="md" />
                <form onSubmit={form.onSubmit(handleSubmit)}>
                    <Stack gap="md">
                        <Grid gutter="md">
                            <Grid.Col span={6}>
                                <Paper withBorder p="md" radius="md">
                                    <Select
                                        label="Objective"
                                        placeholder="Select campaign objective"
                                        data={OBJECTIVES}
                                        {...form.getInputProps('objective')}
                                        required
                                    />
                                    <Select
                                        label="Destination"
                                        placeholder="Select where to send leads"
                                        data={DestinationTypes}
                                        {...form.getInputProps('destinationType')}
                                        required
                                    />
                                </Paper>
                            </Grid.Col>
                            <Grid.Col span={6}>
                                <Paper withBorder p="md" radius="md">
                                    <Select
                                        label="Timeframe"
                                        placeholder="Select campaign duration"
                                        data={TIMEFRAMES}
                                        {...form.getInputProps('timeframe')}
                                        required
                                    />
                                    <Select
                                        label="Budget Type"
                                        placeholder="Choose budget type"
                                        data={BUDGET_TYPES}
                                        {...form.getInputProps('budgetType')}
                                        required
                                    />
                                    <NumberInput
                                        label={form.values.budgetType === 'daily' ? "Daily Budget ($)" : "Lifetime Budget ($)"}
                                        placeholder="Enter budget"
                                        {...form.getInputProps('budget')}
                                        min={1}
                                        required
                                    />
                                    <Box mt="sm">
                                        <Text size="sm" c="dimmed">
                                            {form.values.budgetType === 'daily'
                                                ? `Total campaign cost for ${days} days: `
                                                : 'Total campaign cost:'}
                                            <b>${totalCost.toLocaleString()}</b>
                                        </Text>
                                    </Box>
                                </Paper>
                            </Grid.Col>
                        </Grid>
                        <Paper withBorder p="md" radius="md">
                            <TextInput
                                label="Creatives (optional)"
                                placeholder="Comma separated asset IDs or URLs"
                                {...form.getInputProps('creatives')}
                            />
                        </Paper>
                        <Button
                            leftSection={loading ? <Loader size={18} color="yellow" /> : <IconBulb size={18} />}
                            variant="gradient"
                            gradient={{ from: 'yellow', to: 'teal', deg: 60 }}
                            size="md"
                            radius="md"
                            type="submit"
                            disabled={loading}
                        >
                            {loading ? 'Creating...' : 'Create Smart Campaign'}
                        </Button>
                    </Stack>
                </form>
            </Card>
        </Container>
    );
}