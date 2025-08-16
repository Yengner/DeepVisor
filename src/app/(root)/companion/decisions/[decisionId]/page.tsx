'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/utils/supabase/clients/browser';
import {
    Container, Card, Title, Text, Stack, Group, Badge, Table, NumberInput, Button,
    Paper, Divider, Tooltip, ActionIcon, Textarea, Checkbox, ThemeIcon, Alert
} from '@mantine/core';
import { IconArrowLeft, IconCheck, IconX, IconAlertTriangle, IconInfoCircle } from '@tabler/icons-react';
import toast from 'react-hot-toast';

type PlanAction = {
    level: 'adset' | 'campaign' | string;
    type: 'budget_change' | 'pause_entity' | 'creative_rotate' | string;
    entity_external_id: string;
    campaign_external_id?: string;
    value: { delta_pct?: number;[k: string]: any };
    pre_metrics?: any;
    rationale?: string;
    score?: number;
    objective?: 'CONVERSATIONS' | 'LEAD_GENERATION' | 'OTHER' | string;
    requires_human?: boolean;
    review_reasons?: string[];
};

type DecisionRow = {
    id: string;
    user_id: string;
    ad_account_id: string;
    job_id: string;
    mode: 'shadow' | 'review' | 'auto' | 'canary';
    status: 'planned' | 'needs_review' | 'approved' | 'executed' | 'rejected' | 'failed';
    plan_json: { actions: PlanAction[]; meta?: any } | null;
    gatekeeper_result: any | null;
    execution_result: any | null;
    created_at: string;
    executed_at: string | null;
};

function statusColor(s: DecisionRow['status']) {
    switch (s) {
        case 'needs_review': return 'yellow';
        case 'approved': return 'blue';
        case 'executed': return 'green';
        case 'rejected': return 'gray';
        case 'failed': return 'red';
        default: return 'gray';
    }
}

export default function DecisionReviewPage() {
    const { decisionId } = useParams<{ decisionId: string }>();
    const router = useRouter();
    const supabase = createClient();

    const [decision, setDecision] = useState<DecisionRow | null>(null);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<Record<string, boolean>>({});
    const [edits, setEdits] = useState<Record<string, number | undefined>>({});
    const [comment, setComment] = useState('');

    // load decision
    useEffect(() => {
        let mounted = true;
        (async () => {
            setLoading(true);
            const { data, error } = await supabase.from('decisions').select('*').eq('id', decisionId).single();
            if (!mounted) return;
            if (error || !data) {
                toast.error('Failed to load decision');
                setLoading(false);
                return;
            }
            setDecision(data as DecisionRow);

            // seed selection/edits
            const actions = (data.plan_json?.actions ?? []) as PlanAction[];
            const initialSelect: Record<string, boolean> = {};
            const initialEdits: Record<string, number | undefined> = {};
            for (const a of actions) {
                initialSelect[a.entity_external_id + '|' + a.type] = true;
                if (a.type === 'budget_change') {
                    initialEdits[a.entity_external_id + '|' + a.type] = a.value?.delta_pct;
                }
            }
            setSelected(initialSelect);
            setEdits(initialEdits);
            setLoading(false);
        })();
        return () => { mounted = false; };
    }, [decisionId, supabase]);

    const actions: PlanAction[] = useMemo(
        () => decision?.plan_json?.actions ?? [],
        [decision]
    );

    const meta = decision?.plan_json?.meta ?? {};
    const isActionable = decision?.status === 'needs_review' || decision?.mode === 'review';

    function updateEdit(key: string, v: number | '' | undefined) {
        setEdits((prev) => ({ ...prev, [key]: typeof v === 'number' ? v : undefined }));
    }

    async function postToCallback(payload: any) {
        const res = await fetch('/api/n8n/optimizer/decision-callback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || 'callback failed');
        return json;
    }

    function makeSelectionList() {
        return Object.entries(selected)
            .filter(([, v]) => v)
            .map(([k]) => k);
    }

    function buildEdits() {
        // Convert our key map back to action array (only for edited/selected budget changes)
        const editedActions: PlanAction[] = [];
        for (const a of actions) {
            const key = a.entity_external_id + '|' + a.type;
            if (!selected[key]) continue;
            if (a.type !== 'budget_change') {
                // pass-through non-budget actions as-is if selected
                editedActions.push({ ...a });
                continue;
            }
            const delta = edits[key];
            editedActions.push({
                ...a,
                value: { ...a.value, ...(typeof delta === 'number' ? { delta_pct: delta } : {}) },
            });
        }
        return editedActions;
    }

    async function approveSelected() {
        if (!decision) return;
        try {
            const payload = {
                decisionId: decision.id,
                userId: decision.user_id,
                adAccountId: decision.ad_account_id,
                action: 'approve',
                selection: makeSelectionList(),
                edits: { actions: buildEdits() },
                comment,
                idempotencyKey: crypto.randomUUID(),
            };
            await postToCallback(payload);
            toast.success('Approved. Executing…');
            router.push('/companion'); // back to list; your realtime listener will refresh row
        } catch (e: any) {
            toast.error(e.message);
        }
    }

    async function editSelected() {
        if (!decision) return;
        try {
            const payload = {
                decisionId: decision.id,
                userId: decision.user_id,
                adAccountId: decision.ad_account_id,
                action: 'edit',
                selection: makeSelectionList(),
                edits: { actions: buildEdits() },
                comment,
                idempotencyKey: crypto.randomUUID(),
            };
            await postToCallback(payload);
            toast.success('Edits submitted for execution');
            router.push('/companion');
        } catch (e: any) {
            toast.error(e.message);
        }
    }

    async function denyAll() {
        if (!decision) return;
        try {
            const payload = {
                decisionId: decision.id,
                userId: decision.user_id,
                adAccountId: decision.ad_account_id,
                action: 'deny',
                selection: [], // deny whole plan
                edits: { actions: [] },
                comment,
                idempotencyKey: crypto.randomUUID(),
            };
            await postToCallback(payload);
            toast.success('Decision rejected');
            router.push('/companion');
        } catch (e: any) {
            toast.error(e.message);
        }
    }

    if (loading) {
        return (
            <Container size="lg" py="lg">
                <Text c="dimmed">Loading…</Text>
            </Container>
        );
    }

    if (!decision) {
        return (
            <Container size="lg" py="lg">
                <Alert icon={<IconAlertTriangle />} color="red">Decision not found</Alert>
            </Container>
        );
    }

    return (
        <Container size="lg" py="xl">
            <Stack gap="xl">
                <Group justify="space-between" align="center">
                    <Group gap="sm">
                        <ActionIcon variant="subtle" onClick={() => router.push('/companion')} aria-label="Back">
                            <IconArrowLeft />
                        </ActionIcon>
                        <Title order={2}>Review Decision</Title>
                    </Group>
                    <Group>
                        <Badge variant="light">{new Date(decision.created_at).toLocaleString()}</Badge>
                        <Badge color={statusColor(decision.status)}>{decision.status}</Badge>
                        <Badge variant="light">{decision.mode.toUpperCase()}</Badge>
                    </Group>
                </Group>

                {meta?.agent?.tuner_notes && (
                    <Alert icon={<IconInfoCircle />} color="blue" variant="light">
                        <Text fw={600}>Agent Notes</Text>
                        <Text size="sm">{meta.agent.tuner_notes}</Text>
                    </Alert>
                )}

                {Array.isArray(meta?.agent?.flags) && meta.agent.flags.length > 0 && (
                    <Alert icon={<IconAlertTriangle />} color="yellow" variant="light">
                        <Text fw={600}>Flags</Text>
                        <Stack gap={4}>
                            {meta.agent.flags.map((f: any, i: number) => (
                                <Text size="sm" key={i}>• {f.entity_external_id}: {f.reason}</Text>
                            ))}
                        </Stack>
                    </Alert>
                )}

                <Card withBorder radius="md" p="lg">
                    <Group justify="space-between" mb="md">
                        <Title order={4}>Proposed Actions</Title>
                        <Badge variant="light">{actions.length} total</Badge>
                    </Group>

                    {actions.length === 0 ? (
                        <Text c="dimmed" size="sm">No actions in this plan.</Text>
                    ) : (
                        <Table striped highlightOnHover withRowBorders={false} stickyHeader>
                            <Table.Thead>
                                <Table.Tr>
                                    <Table.Th>Select</Table.Th>
                                    <Table.Th>Type</Table.Th>
                                    <Table.Th>Entity</Table.Th>
                                    <Table.Th>Objective</Table.Th>
                                    <Table.Th>Delta % (editable)</Table.Th>
                                    <Table.Th>Rationale</Table.Th>
                                    <Table.Th>Requires Human</Table.Th>
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                                {actions.map((a) => {
                                    const key = a.entity_external_id + '|' + a.type;
                                    const sel = !!selected[key];
                                    const isBudget = a.type === 'budget_change';
                                    const delta = edits[key];

                                    return (
                                        <Table.Tr key={key}>
                                            <Table.Td>
                                                <Checkbox
                                                    checked={sel}
                                                    onChange={(e) => setSelected((prev) => ({ ...prev, [key]: e.currentTarget.checked }))}
                                                    disabled={!isActionable}
                                                />
                                            </Table.Td>
                                            <Table.Td>
                                                <Badge color={a.type === 'pause_entity' ? 'yellow' : a.type === 'budget_change' ? 'blue' : 'grape'}>
                                                    {a.type}
                                                </Badge>
                                            </Table.Td>
                                            <Table.Td>
                                                <Stack gap={0}>
                                                    <Text fw={600}>{a.entity_external_id}</Text>
                                                    {a.campaign_external_id && <Text size="xs" c="dimmed">Campaign: {a.campaign_external_id}</Text>}
                                                </Stack>
                                            </Table.Td>
                                            <Table.Td>{a.objective || '—'}</Table.Td>
                                            <Table.Td>
                                                {isBudget ? (
                                                    <NumberInput
                                                        value={typeof delta === 'number' ? delta : a.value?.delta_pct}
                                                        onChange={(v) => updateEdit(key, v as number)}
                                                        min={-25} max={25} step={1} disabled={!isActionable}
                                                        suffix="%"
                                                    />
                                                ) : (
                                                    <Text c="dimmed" size="sm">n/a</Text>
                                                )}
                                            </Table.Td>
                                            <Table.Td>
                                                <Tooltip label={JSON.stringify(a.pre_metrics || {}, null, 2)} withArrow>
                                                    <Text size="sm">{a.rationale || '—'}</Text>
                                                </Tooltip>
                                            </Table.Td>
                                            <Table.Td>
                                                {a.requires_human ? (
                                                    <Group gap={6}>
                                                        <ThemeIcon color="yellow" size="sm" variant="light"><IconAlertTriangle size={14} /></ThemeIcon>
                                                        <Text size="sm">Yes</Text>
                                                    </Group>
                                                ) : (
                                                    <Group gap={6}>
                                                        <ThemeIcon color="green" size="sm" variant="light"><IconCheck size={14} /></ThemeIcon>
                                                        <Text size="sm">No</Text>
                                                    </Group>
                                                )}
                                            </Table.Td>
                                        </Table.Tr>
                                    );
                                })}
                            </Table.Tbody>
                        </Table>
                    )}
                </Card>

                <Card withBorder radius="md" p="lg">
                    <Title order={5} mb="sm">Reviewer Comment (optional)</Title>
                    <Textarea
                        placeholder="Add context for this decision…"
                        minRows={3}
                        value={comment}
                        onChange={(e) => setComment(e.currentTarget.value)}
                    />
                    <Divider my="md" />
                    <Group justify="space-between">
                        <Button variant="default" leftSection={<IconX size={16} />} onClick={denyAll} disabled={!isActionable}>
                            Deny All
                        </Button>
                        <Group>
                            <Button variant="light" onClick={editSelected} disabled={!isActionable}>
                                Save Edits
                            </Button>
                            <Button leftSection={<IconCheck size={16} />} onClick={approveSelected} disabled={!isActionable}>
                                Approve & Execute
                            </Button>
                        </Group>
                    </Group>
                </Card>
            </Stack>
        </Container>
    );
}