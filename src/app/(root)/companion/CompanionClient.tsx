'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/utils/supabase/clients/browser';
import {
    Container, Card, Title, Text, Stack, Button, Group, Divider, Badge, Select,
    NumberInput, Grid, Paper, Progress, Modal, Table, Tooltip, ActionIcon, ThemeIcon
} from '@mantine/core';
import { IconRobot, IconBolt, IconCheck, IconX, IconAlertTriangle, IconClock, IconPlayerPlay, IconSettings } from '@tabler/icons-react';
import toast from 'react-hot-toast';

type JobRow = {
    id: string;
    user_id: string;
    type: string; // 'daily_optimizer'
    status: 'queued' | 'running' | 'done' | 'error' | 'canceled';
    step: string | null;
    percent: number | null;
    error: string | null;
    meta: any | null; // eslint-disable-line @typescript-eslint/no-explicit-any
    created_at: string;
    updated_at: string;
};

type JobProgress = {
    id: string;
    job_id: string;
    step: string;
    status: 'loading' | 'success' | 'error';
    percent: number | null;
    message: string | null;
    meta: any | null; // eslint-disable-line @typescript-eslint/no-explicit-any
    created_at: string;
};

type DecisionRow = {
    id: string;
    user_id: string;
    ad_account_id: string;
    job_id: string;
    mode: 'shadow' | 'review' | 'auto' | 'canary';
    status: 'planned' | 'needs_review' | 'executed' | 'rejected' | 'failed';
    plan_json: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    gatekeeper_result: any | null; // eslint-disable-line @typescript-eslint/no-explicit-any
    execution_result: any | null; // eslint-disable-line @typescript-eslint/no-explicit-any
    created_at: string;
    executed_at: string | null;
};


// Status helpers
function jobStatusColor(s: JobRow['status']) {
    if (s === 'running') return 'yellow';
    if (s === 'done') return 'green';
    if (s === 'error') return 'red';
    if (s === 'queued') return 'gray';
    return 'gray';
}

function decisionStatusColor(s: DecisionRow['status']) {
    if (s === 'planned') return 'yellow';
    if (s === 'executed') return 'green';
    if (s === 'failed') return 'red';
    if (s === 'rejected') return 'gray';
    return 'gray';
}

function modeBadgeColor(m: string) {
    if (m === 'auto') return 'green';
    if (m === 'review') return 'blue';
    if (m === 'shadow') return 'gray';
    if (m === 'canary') return 'yellow';
    return 'gray';
}

function JobRunModal({
    opened,
    onClose,
    jobId,
    onDone,
}: {
    opened: boolean;
    onClose: () => void;
    jobId: string | null;
    onDone?: () => void;
}) {
    const supabase = createClient();
    const [progress, setProgress] = useState<JobProgress[]>([]);
    const [job, setJob] = useState<JobRow | null>(null);
    const percent = job?.percent ?? (progress.at(-1)?.percent ?? 0);

    useEffect(() => {
        if (!opened || !jobId) return;

        // seed current
        (async () => {
            const [{ data: p }, { data: j }] = await Promise.all([
                supabase.from('job_progress').select('*').eq('job_id', jobId).order('created_at', { ascending: true }),
                supabase.from('jobs').select('*').eq('id', jobId).single(),
            ]);
            if (p) setProgress(p);
            if (j) setJob(j);
        })();

        // subscribe progress
        const ch1 = supabase
            .channel(`job-progress-${jobId}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'job_progress', filter: `job_id=eq.${jobId}` },
                (payload) => setProgress((prev) => [...prev, payload.new as JobProgress]))
            .subscribe();

        // subscribe job status/percent
        const ch2 = supabase
            .channel(`jobs-${jobId}`)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'jobs', filter: `id=eq.${jobId}` },
                (payload) => setJob(payload.new as JobRow))
            .subscribe();

        return () => {
            supabase.removeChannel(ch1);
            supabase.removeChannel(ch2);
        };
    }, [opened, jobId]);

    useEffect(() => {
        if (!job) return;
        if (job.status === 'done' || job.status === 'error' || job.status === 'canceled') {
            // slight delay so the last event renders
            const t = setTimeout(() => onDone?.(), 600);
            return () => clearTimeout(t);
        }
    }, [job, onDone]);

    return (
        <Modal opened={opened} onClose={onClose} title="Daily Optimizer" centered size="lg">
            <Stack gap="md">
                <Group justify="space-between" align="center">
                    <Group>
                        <ThemeIcon color={jobStatusColor(job?.status || 'queued')} variant="light">
                            <IconBolt size={16} />
                        </ThemeIcon>
                        <Text fw={600}>{job?.status?.toUpperCase() ?? 'QUEUED'}</Text>
                    </Group>
                    <Badge color={jobStatusColor(job?.status || 'queued')}>{job?.step ?? 'starting'}</Badge>
                </Group>
                <Progress value={percent} striped animated />
                <Paper withBorder p="sm" radius="md">
                    <Stack gap={8}>
                        {progress.length === 0 && <Text c="dimmed" size="sm">Waiting for updates…</Text>}
                        {progress.map((p) => (
                            <Group key={p.id} justify="space-between">
                                <Text size="sm">{p.created_at.replace('T', ' ').slice(0, 19)} · {p.step}</Text>
                                <Group gap="xs">
                                    {p.percent != null && <Badge variant="light">{p.percent}%</Badge>}
                                    <Badge color={p.status === 'success' ? 'green' : p.status === 'error' ? 'red' : 'yellow'}>{p.status}</Badge>
                                </Group>
                            </Group>
                        ))}
                    </Stack>
                </Paper>
                <Group justify="end">
                    <Button variant="light" onClick={onClose}>Close</Button>
                </Group>
            </Stack>
        </Modal>
    );
}

// Main page
export default function CompanionClient({
    userId,
    adAccountId,
}: {
    userId: string;
    adAccountId: string;
}) {
    const supabase = createClient();
    const [mode, setMode] = useState<'shadow' | 'review' | 'auto' | 'canary'>('review');
    const [capPct, setCapPct] = useState<number>(25);
    const [jobs, setJobs] = useState<JobRow[]>([]);
    const [decisions, setDecisions] = useState<DecisionRow[]>([]);
    const [runningJobId, setRunningJobId] = useState<string | null>(null);
    const [showModal, setShowModal] = useState(false);

    // load overview
    useEffect(() => {
        (async () => {
            // pull last jobs & decisions for this user/account
            const [{ data: j }, { data: d }] = await Promise.all([
                supabase.from('jobs')
                    .select('*')
                    .eq('user_id', userId)
                    .eq('type', 'daily_optimizer')
                    .order('created_at', { ascending: false })
                    .limit(5),
                supabase.from('decisions')
                    .select('*')
                    .eq('user_id', userId)
                    .eq('ad_account_id', adAccountId)
                    .order('created_at', { ascending: false })
                    .limit(10),
            ]);
            if (j) setJobs(j);
            if (d) setDecisions(d);

            // (optional) load current optimizer settings for this account
            // const { data: acct } = await supabase.from('accounts').select('optimizer_mode, caps').eq('id', adAccountId).single();
            // if (acct?.optimizer_mode) setMode(acct.optimizer_mode);
            // if (acct?.caps?.max_account_budget_change_pct) setCapPct(acct.caps.max_account_budget_change_pct);
        })();
    }, [userId, adAccountId]);

    // run optimizer now
    async function runNow() {
        const res = await fetch('/api/n8n/optimizer/run', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, adAccountId, mode, caps: { max_account_budget_change_pct: capPct } }),
        });
        const data = await res.json();
        if (!res.ok || !data?.jobId) {
            toast.error('Failed to start optimizer: ' + (data?.error || 'Unknown error'));
            console.error('Failed to start optimizer', data?.error);
            return;
        }
        toast.success('Optimizer started');
        setRunningJobId(data.jobId);
        setShowModal(true);
    }

    async function saveSettings() {
        await fetch(`/api/accounts/${adAccountId}/optimizer-mode`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ optimizer_mode: mode, caps: { max_account_budget_change_pct: capPct } }),
        });
        toast.success('Settings saved successfully');
    }

    const lastJob = jobs[0];

    return (
        <>
            <JobRunModal
                opened={showModal}
                onClose={() => setShowModal(false)}
                jobId={runningJobId}
                onDone={() => {
                    setShowModal(false);
                    (async () => {
                        const [{ data: j }, { data: d }] = await Promise.all([
                            supabase.from('jobs').select('*').eq('user_id', userId).eq('type', 'daily_optimizer').order('created_at', { ascending: false }).limit(5),
                            supabase.from('decisions').select('*').eq('user_id', userId).eq('ad_account_id', adAccountId).order('created_at', { ascending: false }).limit(10),
                        ]);
                        if (j) setJobs(j);
                        if (d) setDecisions(d);
                    })();
                }}
            />

            <Container size="lg" py="md">
                <Stack gap="xl">
                    {/* Hero / Controls */}
                    <Card withBorder p="xl" radius="md">
                        <Group justify="space-between" align="center" mb="md">
                            <Group>
                                <IconRobot size={32} color="#228be6" />
                                <Title order={2}>Agency Companion</Title>
                            </Group>
                            <Group>
                                <Badge color={modeBadgeColor(mode)} size="lg" variant="light">{mode.toUpperCase()}</Badge>
                            </Group>
                        </Group>
                        <Text c="dimmed" mb="md">
                            Planner + Guardrails + Executors for Meta accounts. Review decisions, run optimizations, and track outcomes.
                        </Text>
                        <Divider my="md" />

                        <Grid>
                            <Grid.Col span={{ base: 12, md: 6 }}>
                                <Paper withBorder p="md" radius="md">
                                    <Group mb="sm" justify="space-between">
                                        <Text fw={600}>Optimizer Settings</Text>
                                        <Tooltip label="Hard cap on total budget change per run">
                                            <ActionIcon variant="subtle"><IconSettings size={16} /></ActionIcon>
                                        </Tooltip>
                                    </Group>
                                    <Stack gap="sm">
                                        <Select
                                            label="Mode"
                                            data={[
                                                { value: 'shadow', label: 'Shadow (Plan only)' },
                                                { value: 'review', label: 'Review (Human approval)' },
                                                { value: 'auto', label: 'Auto (Execute with guardrails)' },
                                                { value: 'canary', label: 'Canary (Partial auto)' },
                                            ]}
                                            value={mode}
                                            onChange={(v) => setMode((v as any) || 'review')}
                                        />
                                        <NumberInput
                                            label="Max account budget change per run (%)"
                                            min={1}
                                            max={50}
                                            value={capPct}
                                            onChange={(v) => setCapPct(Number(v || 0))}
                                        />
                                        <Group>
                                            <Button variant="light" onClick={saveSettings}>Save Settings</Button>
                                            <Button leftSection={<IconPlayerPlay size={16} />} onClick={runNow}>
                                                Run Daily Optimizer
                                            </Button>
                                        </Group>
                                    </Stack>
                                </Paper>
                            </Grid.Col>

                            <Grid.Col span={{ base: 12, md: 6 }}>
                                <Paper withBorder p="md" radius="md">
                                    <Text fw={600} mb="sm">Last Run</Text>
                                    {lastJob ? (
                                        <Stack gap={6}>
                                            <Group gap="xs">
                                                <Badge color={jobStatusColor(lastJob.status)}>{lastJob.status.toUpperCase()}</Badge>
                                                <Badge variant="light">{lastJob.step || '—'}</Badge>
                                                <Badge variant="light" leftSection={<IconClock size={14} />}>
                                                    {new Date(lastJob.created_at).toLocaleString()}
                                                </Badge>
                                            </Group>
                                            <Progress value={lastJob.percent ?? 0} />
                                            {lastJob.error && (
                                                <Group gap="xs">
                                                    <IconAlertTriangle size={16} color="var(--mantine-color-red-6)" />
                                                    <Text c="red" size="sm">{lastJob.error}</Text>
                                                </Group>
                                            )}
                                        </Stack>
                                    ) : (
                                        <Text c="dimmed" size="sm">No runs yet.</Text>
                                    )}
                                </Paper>
                            </Grid.Col>
                        </Grid>
                    </Card>

                    {/* Recent Decisions */}
                    <Card withBorder p="lg" radius="md">
                        <Group justify="space-between" mb="sm">
                            <Title order={4}>Recent Decisions</Title>
                            <Badge variant="light">{decisions.length} items</Badge>
                        </Group>
                        {decisions.length === 0 ? (
                            <Text c="dimmed" size="sm">No decisions yet. Run the optimizer to generate plans.</Text>
                        ) : (
                            <Table striped highlightOnHover withRowBorders={false} stickyHeader>
                                <Table.Thead>
                                    <Table.Tr>
                                        <Table.Th>Created</Table.Th>
                                        <Table.Th>Mode</Table.Th>
                                        <Table.Th>Status</Table.Th>
                                        <Table.Th>Actions Proposed</Table.Th>
                                        <Table.Th>Gatekeeper</Table.Th>
                                    </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                    {decisions.map((d) => {
                                        const actionsCount = Array.isArray(d.plan_json?.actions) ? d.plan_json.actions.length : 0;
                                        const gkOk = d.gatekeeper_result?.ok;
                                        return (
                                            <Table.Tr key={d.id}>
                                                <Table.Td>{new Date(d.created_at).toLocaleString()}</Table.Td>
                                                <Table.Td><Badge color={modeBadgeColor(d.mode)}>{d.mode}</Badge></Table.Td>
                                                <Table.Td><Badge color={decisionStatusColor(d.status)}>{d.status}</Badge></Table.Td>
                                                <Table.Td>
                                                    <Group gap="xs">
                                                        <Badge variant="light">{actionsCount}</Badge>
                                                        {d.status === 'needs_review' ? (
                                                            <Button size="xs" variant="light" component="a" href={`/companion/decisions/${d.id}`}>
                                                                Review
                                                            </Button>
                                                        ) : (
                                                            <Button size="xs" variant="subtle" component="a" href={`/companion/decisions/${d.id}`}>
                                                                View
                                                            </Button>
                                                        )}
                                                    </Group>
                                                </Table.Td>
                                                <Table.Td>
                                                    {gkOk === true && <Badge color="green" leftSection={<IconCheck size={12} />}>ok</Badge>}
                                                    {gkOk === false && <Badge color="red" leftSection={<IconX size={12} />}>blocked</Badge>}
                                                    {gkOk == null && <Badge variant="light">—</Badge>}
                                                </Table.Td>
                                            </Table.Tr>
                                        );
                                    })}
                                </Table.Tbody>
                            </Table>
                        )}
                    </Card>

                    {/* Recent Jobs */}
                    <Card withBorder p="lg" radius="md">
                        <Group justify="space-between" mb="sm">
                            <Title order={4}>Recent Runs</Title>
                            <Badge variant="light">{jobs.length} jobs</Badge>
                        </Group>
                        {jobs.length === 0 ? (
                            <Text c="dimmed" size="sm">No runs yet.</Text>
                        ) : (
                            <Table striped withRowBorders={false} highlightOnHover>
                                <Table.Thead>
                                    <Table.Tr>
                                        <Table.Th>Created</Table.Th>
                                        <Table.Th>Status</Table.Th>
                                        <Table.Th>Step</Table.Th>
                                        <Table.Th>Progress</Table.Th>
                                    </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                    {jobs.map((j) => (
                                        <Table.Tr key={j.id}>
                                            <Table.Td>{new Date(j.created_at).toLocaleString()}</Table.Td>
                                            <Table.Td><Badge color={jobStatusColor(j.status)}>{j.status}</Badge></Table.Td>
                                            <Table.Td>{j.step || '—'}</Table.Td>
                                            <Table.Td><Progress value={j.percent ?? 0} /></Table.Td>
                                        </Table.Tr>
                                    ))}
                                </Table.Tbody>
                            </Table>
                        )}
                    </Card>
                </Stack>
            </Container>
        </>
    );
}
