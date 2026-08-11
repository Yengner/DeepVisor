'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SmartCampaignDraftForm } from '@/lib/shared/types/campaignDrafts';
import {
    Badge, Container, Title, Text, Button, Group, Loader, Select, TextInput, NumberInput, Stack, Box, Grid, Paper
} from '@mantine/core';
import { IconBulb } from '@tabler/icons-react';
import { useForm } from '@mantine/form';
import JobLoadingModal from '@/components/ui/states/JobLoadingModal';
import { showError } from '@/lib/client';
import { formatCurrencyAmount } from '@/lib/shared';

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
    currencyCode,
    draft,
}: { userId: string, platformName: string; platformId: string; adAccountId: string; currencyCode: string | null; draft?: SmartCampaignDraftForm | null }) {
    const router = useRouter();
    const form = useForm({
        initialValues: {
            budgetType: draft?.budgetType ?? 'daily',
            budget: draft?.budget ?? 32,
            objective: draft?.objective ?? 'OUTCOME_LEADS',
            destinationType: draft?.destinationType ?? 'ON_AD',
            timeframe: draft?.timeframe ?? '30',
            creatives: draft?.creatives ?? '',
            // Optional user-editables:
            link: draft?.link ?? 'https://fb.me/',
            message: draft?.message ?? '',
            imageHash: draft?.imageHash ?? '',
            formId: draft?.formId ?? ''
        },
        validate: {
            budget: v => (v && Number(v) > 0 ? null : 'Budget must be greater than 0'),
            objective: v => (v ? null : 'Objective is required'),
            destinationType: v => (v ? null : 'Destination type is required'),
            timeframe: v => (v ? null : 'Timeframe is required'),
        },
    });

    const [loading, setLoading] = useState(false);
    const [jobId, setJobId] = useState<string | null>(null);
    const [showLoadingModal, setShowLoadingModal] = useState(false);

    // Calculate total campaign cost
    const days = Number(form.values.timeframe);
    const totalCost = form.values.budgetType === 'daily'
        ? days * Number(form.values.budget)
        : Number(form.values.budget || 0);
    const currencyLabel = currencyCode?.trim().toUpperCase() || 'USD';

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
            // router.push('/campaigns/intelligence/status');
            const data = await res.json();
            if (!res.ok || !data?.jobId) throw new Error(data?.error || 'Draft init failed');
            setJobId(data.jobId);
            setShowLoadingModal(true);

        } catch (error) {
            setLoading(false);
            console.error('Error creating campaign:', error);
            showError(
                error instanceof Error ? error.message : 'The campaign draft could not be created.',
                'Campaign could not be created'
            );
        }
    }

    return (

        <>
            {jobId && (
                <JobLoadingModal
                    jobId={jobId}
                    opened={showLoadingModal}
                    onClose={() => {
                        setShowLoadingModal(false);
                        setLoading(false);
                    }}
                    onDone={async () => {
                        setShowLoadingModal(false);
                        router.push('/calendar');
                    }}
                />
            )}

            <Container size="md" py="lg" className="dv-app-page">
                <Stack gap="lg">
                    <div className="dv-app-page-header">
                        <div>
                            <Group gap="xs" mb={6}>
                                <Badge variant="light" color="signal">Campaign builder</Badge>
                                <Badge variant="outline" color="gray">{platformName}</Badge>
                            </Group>
                            <Title order={2}>Create an intelligent campaign</Title>
                            <Text c="dimmed" mt={4}>Set the outcome, lead destination, schedule, and budget.</Text>
                        </div>
                        <IconBulb size={26} color="#0b7a4b" />
                    </div>
                    <form onSubmit={form.onSubmit(handleSubmit)}>
                        <Stack gap="md">
                            <Grid gutter="md">
                                <Grid.Col span={{ base: 12, sm: 6 }}>
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


                                <Grid.Col span={{ base: 12, sm: 6 }}>
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
                                            label={form.values.budgetType === 'daily' ? `Daily Budget (${currencyLabel})` : `Lifetime Budget (${currencyLabel})`}
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
                                                <b>{formatCurrencyAmount(totalCost, currencyCode, {
                                                    minimumFractionDigits: 0,
                                                    maximumFractionDigits: 2,
                                                })}</b>
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
                                leftSection={loading ? <Loader size={18} color="white" /> : <IconBulb size={18} />}
                                size="md"
                                type="submit"
                                disabled={loading}
                                style={{ alignSelf: 'flex-end' }}
                            >
                                {loading ? 'Creating...' : 'Create Campaign'}
                            </Button>
                        </Stack>
                    </form>
                </Stack>
            </Container>
        </>
    );
}
