// app/agency/queues/AdAccountQueuesClient.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/utils/supabase/clients/browser';
import {
    Card, Group, Title, Badge, SegmentedControl, Button, Table, Stack, Text,
    Tooltip, ActionIcon, Modal, Timeline, Progress, Paper, Grid
} from '@mantine/core';
import {
    IconRefresh, IconPlayerPlay, IconClock, IconEye, IconAlertTriangle, IconCheck, IconX
} from '@tabler/icons-react';
import toast from 'react-hot-toast';

// -------------------- Types (mirror your SQL) --------------------
type TaskStatus = 'scheduled' | 'queued' | 'awaiting_approval' | 'running' | 'done' | 'failed' | 'dead_letter' | 'blocked';
type ScheduleWindow = '12h' | '18h' | '22h' | 'adhoc';

type TaskRow = {
    id: string;
    tenant_id: string;
    ad_account_id: string;
    vendor: 'meta' | 'google' | 'tiktok' | string;
    type: string;
    approval_policy: 'auto' | 'review_required' | 'canary' | 'review_optional' | string;
    schedule_window: ScheduleWindow;
    status: TaskStatus;
    scheduled_at: string;
    scheduled_on: string;
    payload: any;
    result: any;
    error: any;
    attempt_count: number;
    max_attempts: number;
    created_at: string;
    updated_at: string;
};

type TaskEvent = {
    id: number;
    task_id: string;
    actor: string | null;
    event: string;
    detail: any;
    created_at: string;
};

// -------------------- Helpers --------------------
const statusColor = (s: TaskStatus) =>
    s === 'running' ? 'yellow' :
        s === 'queued' ? 'gray' :
            s === 'scheduled' ? 'gray' :
                s === 'awaiting_approval' ? 'blue' :
                    s === 'done' ? 'green' :
                        s === 'failed' ? 'red' :
                            s === 'dead_letter' ? 'red' : 'gray';

const formatDT = (iso?: string) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleString();
};

// -------------------- Timeline Modal --------------------
function TaskTimelineModal({
    task, opened, onClose
}: { task: TaskRow | null; opened: boolean; onClose: () => void }) {
    const supabase = createClient();
    const [events, setEvents] = useState<TaskEvent[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!opened || !task) return;
        setLoading(true);
        (async () => {
            const { data, error } = await supabase
                .from('task_events')
                .select('*')
                .eq('task_id', task.id)
                .order('created_at', { ascending: true });
            if (!error && data) setEvents(data as TaskEvent[]);
            setLoading(false);
        })();
    }, [opened, task, supabase]);

    return (
        <Modal opened={opened} onClose={onClose} title="Task timeline" size="lg" centered>
            {!task ? (
                <Text c="dimmed" size="sm">No task selected.</Text>
            ) : (
                <Stack gap="md">
                    <Paper withBorder p="sm" radius="md">
                        <Grid>
                            <Grid.Col span={{ base: 12, md: 6 }}>
                                <Text size="sm" c="dimmed">Task</Text>
                                <Group gap="xs" mt={4}>
                                    <Badge variant="light">{task.type}</Badge>
                                    <Badge variant="light">{task.schedule_window}</Badge>
                                    <Badge color={statusColor(task.status)}>{task.status}</Badge>
                                </Group>
                            </Grid.Col>
                            <Grid.Col span={{ base: 12, md: 6 }}>
                                <Text size="sm" c="dimmed">Scheduled</Text>
                                <Group gap="xs" mt={4}>
                                    <Badge leftSection={<IconClock size={12} />}>{formatDT(task.scheduled_at)}</Badge>
                                </Group>
                            </Grid.Col>
                        </Grid>
                    </Paper>

                    {loading ? (
                        <Group><Progress value={100} animated /></Group>
                    ) : events.length === 0 ? (
                        <Text c="dimmed" size="sm">No events yet.</Text>
                    ) : (
                        <Timeline bulletSize={18} lineWidth={2}>
                            {events.map(e => {
                                const icon =
                                    e.event === 'done' ? <IconCheck size={12} /> :
                                        e.event === 'failed' || e.event === 'dead_letter' ? <IconAlertTriangle size={12} /> :
                                            e.event === 'queued' || e.event === 'running' || e.event === 'created' ? <IconClock size={12} /> :
                                                <IconEye size={12} />;
                                const color =
                                    e.event === 'done' ? 'green' :
                                        (e.event === 'failed' || e.event === 'dead_letter') ? 'red' :
                                            e.event === 'running' ? 'yellow' : 'blue';

                                return (
                                    <Timeline.Item key={e.id} bullet={icon} color={color} title={`${e.event} · ${formatDT(e.created_at)}`}>
                                        <Text size="xs" c="dimmed">{e.actor || 'system'}</Text>
                                        {e.detail && (
                                            <Text size="xs" mt={4} style={{ whiteSpace: 'pre-wrap' }}>
                                                {JSON.stringify(e.detail, null, 2)}
                                            </Text>
                                        )}
                                    </Timeline.Item>
                                );
                            })}
                        </Timeline>
                    )}
                </Stack>
            )}
        </Modal>
    );
}

// -------------------- Main: AdAccountQueuesClient --------------------
export default function AdAccountQueuesClient({
    tenantId,
    adAccountRowId,
}: {
    tenantId: string;
    adAccountRowId: string;
}) {
    const supabase = createClient();

    const [windowFilter, setWindowFilter] = useState<'all' | ScheduleWindow>('all');
    const [statusFilter, setStatusFilter] = useState<'upcoming' | 'history'>('upcoming');

    const [upcoming, setUpcoming] = useState<TaskRow[]>([]);
    const [history, setHistory] = useState<TaskRow[]>([]);
    const [loading, setLoading] = useState(true);

    const [viewTask, setViewTask] = useState<TaskRow | null>(null);
    const [timelineOpen, setTimelineOpen] = useState(false);

    console.log('AdAccountQueuesClient', { tenantId, adAccountRowId });
    // initial load
    useEffect(() => {
        (async () => {
            setLoading(true);

            // Upcoming: scheduled | queued | running
            let q1 = supabase
                .from('tasks')
                .select('*')
                .eq('tenant_id', tenantId)
                .eq('ad_account_id', adAccountRowId)
                .in('status', ['scheduled', 'queued', 'running' as TaskStatus])
                .order('scheduled_at', { ascending: true })
                .limit(200);
            
            // History: done | failed | dead_letter
            let q2 = supabase
                .from('tasks')
                .select('*')
                .eq('tenant_id', tenantId)
                .eq('ad_account_id', adAccountRowId)
                .in('status', ['done', 'failed', 'dead_letter' as TaskStatus])
                .order('updated_at', { ascending: false })
                .limit(200);

            const [{ data: u }, { data: h }] = await Promise.all([q1, q2]);
            if (u) setUpcoming(u as TaskRow[]);
            if (h) setHistory(h as TaskRow[]);
            console.log('loaded tasks', { upcoming: u?.length, history: h?.length });
            setLoading(false);
        })();
    }, [tenantId, adAccountRowId, supabase]);

    // realtime updates
    useEffect(() => {
        const channel = supabase
            .channel(`tasks-${tenantId}-${adAccountRowId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'tasks',
                filter: `tenant_id=eq.${tenantId}`
            }, (payload) => {
                const row = payload.new as TaskRow;
                if (!row || row.ad_account_id !== adAccountRowId) return;

                const isUpcoming = ['scheduled', 'queued', 'running'].includes(row.status);
                const isHistory = ['done', 'failed', 'dead_letter'].includes(row.status);

                // remove from both lists then add to appropriate target
                setUpcoming(prev => prev.filter(t => t.id !== row.id));
                setHistory(prev => prev.filter(t => t.id !== row.id));

                if (isUpcoming) setUpcoming(prev => {
                    const next = [...prev, row].sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
                    return next.slice(0, 200);
                });
                if (isHistory) setHistory(prev => {
                    const next = [row, ...prev].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
                    return next.slice(0, 200);
                });
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [supabase, tenantId, adAccountRowId]);

    // filters
    const filteredUpcoming = useMemo(() => {
        const rows = windowFilter === 'all'
            ? upcoming
            : upcoming.filter(t => t.schedule_window === windowFilter);
        return rows;
    }, [upcoming, windowFilter]);

    const filteredHistory = useMemo(() => {
        const rows = windowFilter === 'all'
            ? history
            : history.filter(t => t.schedule_window === windowFilter);
        return rows;
    }, [history, windowFilter]);

    async function runNow(task: TaskRow) {
        try {
            const res = await fetch('/api/agency/tasks/run-now', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ taskId: task.id })
            });
            if (!res.ok) throw new Error(await res.text());
            toast.success('Task enqueued');
        } catch (e: any) {
            toast.error(`Run failed: ${e.message || e}`);
        }
    }

    async function refresh() {
        setLoading(true);
        const [{ data: u }, { data: h }] = await Promise.all([
            supabase.from('tasks').select('*')
                .eq('tenant_id', tenantId).eq('ad_account_id', adAccountRowId)
                .in('status', ['scheduled', 'queued', 'running' as TaskStatus])
                .order('scheduled_at', { ascending: true }).limit(200),
            supabase.from('tasks').select('*')
                .eq('tenant_id', tenantId).eq('ad_account_id', adAccountRowId)
                .in('status', ['done', 'failed', 'dead_letter' as TaskStatus])
                .order('updated_at', { ascending: false }).limit(200),
        ]);
        if (u) setUpcoming(u as TaskRow[]);
        if (h) setHistory(h as TaskRow[]);
        setLoading(false);
    }

    return (
        <>
            <Card withBorder p="lg" radius="md">
                <Group justify="space-between" mb="xs">
                    <Group gap="xs">
                        <Title order={4}>Queues</Title>
                        <Badge variant="light">ad_account: {adAccountRowId.slice(0, 6)}…</Badge>
                    </Group>
                    <Group gap="xs">
                        <SegmentedControl
                            value={windowFilter}
                            onChange={(v) => setWindowFilter(v as any)}
                            data={[
                                { label: 'All', value: 'all' },
                                { label: '12h', value: '12h' },
                                { label: '18h', value: '18h' },
                                { label: '22h', value: '22h' },
                                { label: 'Adhoc', value: 'adhoc' },
                            ]}
                        />
                        <SegmentedControl
                            value={statusFilter}
                            onChange={(v) => setStatusFilter(v as any)}
                            data={[
                                { label: 'Upcoming', value: 'upcoming' },
                                { label: 'History', value: 'history' },
                            ]}
                        />
                        <Tooltip label="Refresh">
                            <ActionIcon variant="subtle" onClick={refresh}><IconRefresh size={18} /></ActionIcon>
                        </Tooltip>
                    </Group>
                </Group>

                {statusFilter === 'upcoming' ? (
                    <Table striped highlightOnHover withRowBorders={false} stickyHeader>
                        <Table.Thead>
                            <Table.Tr>
                                <Table.Th>When</Table.Th>
                                <Table.Th>Window</Table.Th>
                                <Table.Th>Type</Table.Th>
                                <Table.Th>Status</Table.Th>
                                <Table.Th>Attempts</Table.Th>
                                <Table.Th>Actions</Table.Th>
                            </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                            {loading && filteredUpcoming.length === 0 && (
                                <Table.Tr><Table.Td colSpan={6}><Text c="dimmed" size="sm">Loading…</Text></Table.Td></Table.Tr>
                            )}
                            {!loading && filteredUpcoming.length === 0 && (
                                <Table.Tr><Table.Td colSpan={6}><Text c="dimmed" size="sm">No upcoming tasks.</Text></Table.Td></Table.Tr>
                            )}
                            {filteredUpcoming.map((t) => (
                                <Table.Tr key={t.id}>
                                    <Table.Td>
                                        <Group gap="xs">
                                            <Badge leftSection={<IconClock size={12} />}>{formatDT(t.scheduled_at)}</Badge>
                                        </Group>
                                    </Table.Td>
                                    <Table.Td><Badge variant="light">{t.schedule_window}</Badge></Table.Td>
                                    <Table.Td><Badge variant="light">{t.type}</Badge></Table.Td>
                                    <Table.Td><Badge color={statusColor(t.status)}>{t.status}</Badge></Table.Td>
                                    <Table.Td>{t.attempt_count}/{t.max_attempts}</Table.Td>
                                    <Table.Td>
                                        <Group gap="xs">
                                            <Button size="xs" variant="light" onClick={() => { setViewTask(t); setTimelineOpen(true); }}>
                                                View
                                            </Button>
                                            <Button size="xs" leftSection={<IconPlayerPlay size={14} />} onClick={() => runNow(t)}>
                                                Run now
                                            </Button>
                                        </Group>
                                    </Table.Td>
                                </Table.Tr>
                            ))}
                        </Table.Tbody>
                    </Table>
                ) : (
                    <Table striped highlightOnHover withRowBorders={false} stickyHeader>
                        <Table.Thead>
                            <Table.Tr>
                                <Table.Th>Updated</Table.Th>
                                <Table.Th>Window</Table.Th>
                                <Table.Th>Type</Table.Th>
                                <Table.Th>Status</Table.Th>
                                <Table.Th>Result / Error</Table.Th>
                                <Table.Th>Actions</Table.Th>
                            </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                            {loading && filteredHistory.length === 0 && (
                                <Table.Tr><Table.Td colSpan={6}><Text c="dimmed" size="sm">Loading…</Text></Table.Td></Table.Tr>
                            )}
                            {!loading && filteredHistory.length === 0 && (
                                <Table.Tr><Table.Td colSpan={6}><Text c="dimmed" size="sm">No history yet.</Text></Table.Td></Table.Tr>
                            )}
                            {filteredHistory.map((t) => {
                                const err = t.error ? (t.error.code || t.error.http || JSON.stringify(t.error)) : null;
                                const ok = t.status === 'done';
                                return (
                                    <Table.Tr key={t.id}>
                                        <Table.Td>{formatDT(t.updated_at)}</Table.Td>
                                        <Table.Td><Badge variant="light">{t.schedule_window}</Badge></Table.Td>
                                        <Table.Td><Badge variant="light">{t.type}</Badge></Table.Td>
                                        <Table.Td>
                                            <Badge color={statusColor(t.status)} leftSection={ok ? <IconCheck size={12} /> : (t.status === 'failed' || t.status === 'dead_letter') ? <IconAlertTriangle size={12} /> : <IconClock size={12} />}>
                                                {t.status}
                                            </Badge>
                                        </Table.Td>
                                        <Table.Td>
                                            <Text size="xs" c={ok ? undefined : 'red'}>
                                                {ok ? (t.result ? JSON.stringify(t.result) : '—') : (err || 'error')}
                                            </Text>
                                        </Table.Td>
                                        <Table.Td>
                                            <Button size="xs" variant="light" onClick={() => { setViewTask(t); setTimelineOpen(true); }}>
                                                View
                                            </Button>
                                        </Table.Td>
                                    </Table.Tr>
                                );
                            })}
                        </Table.Tbody>
                    </Table>
                )}
            </Card>

            <TaskTimelineModal task={viewTask} opened={timelineOpen} onClose={() => setTimelineOpen(false)} />
        </>
    );
}
