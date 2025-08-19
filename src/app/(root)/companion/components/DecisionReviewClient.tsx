'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    Container, Card, Title, Text, Stack, Group, Badge, Button,
    Paper, Divider, Tooltip, ActionIcon, Textarea, Checkbox, ThemeIcon,
    Alert, Slider, NumberInput
} from '@mantine/core';
import { IconArrowLeft, IconCheck, IconX, IconAlertTriangle, IconInfoCircle } from '@tabler/icons-react';
import toast from 'react-hot-toast';

export type OptimizerActionRow = {
    decision_id: string;
    user_id: string;
    job_id: string;
    mode: string;
    review_mode: string;
    decision_status: string;
    decision_created_at: string;

    ad_account_external_id: string;
    ad_account_uuid: string;

    action_json: any;

    level: 'adset' | 'campaign' | 'ad' | string;
    type: 'budget_change' | 'pause_entity' | 'creative_rotate' | string;
    objective?: string | null;
    entity_external_id: string;
    campaign_external_id?: string | null;
    rationale?: string | null;
    score?: number | null;
    requires_human?: boolean | null;
    review_reasons?: any;

    pre_window?: string | null;
    pre_spend?: number | null;
    pre_impressions?: number | null;
    pre_clicks?: number | null;
    pre_messages?: number | null;
    pre_leads?: number | null;
    pre_cpmg?: number | null;
    pre_cpl?: number | null;

    delta_pct?: number | null;

    entity_name?: string | null;
    campaign_name?: string | null;

    action_key: string;
    delta_direction?: 'increase' | 'decrease' | null;

    target_cost_per_message?: number | null;
    target_cost_per_lead?: number | null;
    actual_unit_cost?: number | null;
    unit_cost_diff_pct?: number | null;
};

export type DecisionSSR = {
    id: string;
    user_id: string;
    ad_account_id: string;
    job_id: string;
    mode: 'shadow' | 'review' | 'auto' | 'canary';
    status: 'planned' | 'needs_review' | 'approved' | 'executed' | 'rejected' | 'failed';
    review_mode: 'human_if_high_impact' | 'human_required' | 'auto' | string;
    created_at: string;
    plan_meta: any;              // expects { caps, targets, agent?, ... }
    gatekeeper_result: any | null;
};

function statusColor(s: DecisionSSR['status']) {
    switch (s) {
        case 'needs_review': return 'yellow';
        case 'approved': return 'blue';
        case 'executed': return 'green';
        case 'rejected': return 'gray';
        case 'failed': return 'red';
        default: return 'gray';
    }
}

function pillColor(type: string, delta?: number) {
    if (type === 'pause_entity') return 'yellow';
    if (type === 'creative_rotate') return 'grape';
    if (type === 'budget_change') return (delta ?? 0) >= 0 ? 'green' : 'red';
    return 'gray';
}

function friendlyOutcome(obj?: string | null) {
    if ((obj || '').toUpperCase().includes('CONVERSATIONS')) return 'messages';
    if ((obj || '').toUpperCase().includes('LEAD')) return 'leads';
    return 'outcomes';
}

export default function DecisionReviewClient({
    decision,
    actions,
}: {
    decision: DecisionSSR;
    actions: OptimizerActionRow[];
}) {
    const router = useRouter();

    const [selected, setSelected] = useState<Record<string, boolean>>({});
    const [edits, setEdits] = useState<Record<string, number | undefined>>({});
    const [comment, setComment] = useState('');

    // Seed selection/edits from server-provided rows
    useEffect(() => {
        const sel: Record<string, boolean> = {};
        const ed: Record<string, number | undefined> = {};
        for (const r of actions) {
            sel[r.action_key] = true;
            if (r.type === 'budget_change' && typeof r.delta_pct === 'number') {
                ed[r.action_key] = r.delta_pct;
            }
        }
        setSelected(sel);
        setEdits(ed);
    }, [actions]);

    const approvedLimit = useMemo(
        () => Number(decision?.plan_meta?.caps?.max_account_budget_change_pct ?? 25),
        [decision?.plan_meta?.caps]
    );

    const isActionable = decision.status === 'needs_review' || decision.mode === 'review';

    function updateEdit(key: string, v: number | '' | undefined) {
        setEdits((prev) => ({ ...prev, [key]: typeof v === 'number' ? v : undefined }));
    }

    function netDeltaPctSelected() {
        return Object.entries(selected).reduce((sum, [k, v]) => {
            if (!v) return sum;
            const row = actions.find(r => r.action_key === k);
            const current = (typeof edits[k] === 'number') ? edits[k]! : (row?.delta_pct ?? 0);
            if ((row?.type) !== 'budget_change') return sum;
            return sum + (current || 0);
        }, 0);
    }

    function explain(r: OptimizerActionRow) {
        const fmt = (n?: number | null) => (n == null || !isFinite(Number(n)) ? '—' : `$${Number(n).toFixed(2)}`);
        if (r.type === 'budget_change') {
            const out = friendlyOutcome(r.objective);
            const target = (r.objective || '').toUpperCase().includes('CONVERSATIONS')
                ? r.target_cost_per_message
                : (r.objective || '').toUpperCase().includes('LEAD')
                    ? r.target_cost_per_lead
                    : null;
            if (r.actual_unit_cost != null && target != null && r.unit_cost_diff_pct != null) {
                const sign = r.unit_cost_diff_pct >= 0 ? '+' : '−';
                return `Because ${out} cost is ${fmt(r.actual_unit_cost)} vs target ${fmt(target)} (${sign}${Math.abs(r.unit_cost_diff_pct).toFixed(0)}%).`;
            }
        }
        return r.rationale || 'Suggested based on recent performance and guardrails.';
    }

    function selectionKeys() {
        return Object.entries(selected).filter(([, v]) => v).map(([k]) => k);
    }

    function buildEditsFromRows(): any[] {
        const edited: any[] = [];
        for (const r of actions) {
            const k = r.action_key;
            if (!selected[k]) continue;
            const base = structuredClone(r.action_json || {});
            if (r.type === 'budget_change') {
                const chosen = typeof edits[k] === 'number' ? edits[k]! : (r.delta_pct ?? 0);
                base.value = { ...(base.value || {}), delta_pct: chosen };
            }
            edited.push(base);
        }
        return edited;
    }

    async function postToCallback(payload: any) {
        const res = await fetch('/api/n8n/optimizer/decision-callback', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || 'callback failed');
        return json;
    }

    async function approveSelected() {
        try {
            const payload = {
                decisionId: decision.id,
                userId: decision.user_id,
                adAccountId: decision.ad_account_id,
                action: 'approve',
                selection: selectionKeys(),
                edits: { actions: buildEditsFromRows() },
                comment,
                idempotencyKey: crypto.randomUUID(),
            };
            await postToCallback(payload);
            toast.success('Approved. Executing…');
            router.push('/companion');
        } catch (e: any) { toast.error(e.message); }
    }

    async function editSelected() {
        try {
            const payload = {
                decisionId: decision.id,
                userId: decision.user_id,
                adAccountId: decision.ad_account_id,
                action: 'edit',
                selection: selectionKeys(),
                edits: { actions: buildEditsFromRows() },
                comment,
                idempotencyKey: crypto.randomUUID(),
            };
            await postToCallback(payload);
            toast.success('Edits submitted for execution');
            router.push('/companion');
        } catch (e: any) { toast.error(e.message); }
    }

    async function denyAll() {
        try {
            const payload = {
                decisionId: decision.id,
                userId: decision.user_id,
                adAccountId: decision.ad_account_id,
                action: 'deny',
                selection: [],
                edits: { actions: [] },
                comment,
                idempotencyKey: crypto.randomUUID(),
            };
            await postToCallback(payload);
            toast.success('Decision rejected');
            router.push('/companion');
        } catch (e: any) { toast.error(e.message); }
    }

    const net = netDeltaPctSelected();

    return (
        <Container size="lg" py="xl">
            <Stack gap="xl">
                {/* Header */}
                <Group justify="space-between" align="center">
                    <Group gap="sm">
                        <ActionIcon variant="subtle" onClick={() => router.push('/companion')} aria-label="Back">
                            <IconArrowLeft />
                        </ActionIcon>
                        <Title order={2}>Review Optimizer Plan</Title>
                    </Group>
                    <Group>
                        <Badge variant="light">{new Date(decision.created_at).toLocaleString()}</Badge>
                        <Badge color={statusColor(decision.status)}>{decision.status}</Badge>
                        <Badge variant="light">{decision.mode.toUpperCase()}</Badge>
                    </Group>
                </Group>

                {/* Summary */}
                <Card withBorder radius="md" p="lg">
                    <Group justify="space-between" align="center" mb="sm">
                        <Text fw={600}>Summary</Text>
                        <Badge variant="light">Max per-run cap ±{approvedLimit}%</Badge>
                    </Group>
                    <Group gap="lg">
                        <Badge color={net >= 0 ? 'green' : 'red'} size="lg">
                            Net selected budget change: {net >= 0 ? '+' : ''}{net}%
                        </Badge>
                        <Tooltip label="Sum of selected percentage changes across items. Actual $ impact varies by each ad set’s base budget.">
                            <ThemeIcon variant="light" color="gray"><IconInfoCircle size={16} /></ThemeIcon>
                        </Tooltip>
                    </Group>
                </Card>

                {/* Notes / Flags */}
                {decision?.plan_meta?.agent?.tuner_notes && (
                    <Alert icon={<IconInfoCircle />} color="blue" variant="light">
                        <Text fw={600}>Notes</Text>
                        <Text size="sm">{decision.plan_meta.agent.tuner_notes}</Text>
                    </Alert>
                )}
                {Array.isArray(decision?.plan_meta?.agent?.flags) && decision.plan_meta.agent.flags.length > 0 && (
                    <Alert icon={<IconAlertTriangle />} color="yellow" variant="light">
                        <Text fw={600}>Flags</Text>
                        <Stack gap={4}>
                            {decision.plan_meta.agent.flags.map((f: any, i: number) => (
                                <Text size="sm" key={i}>• {f.entity_external_id}: {f.reason}</Text>
                            ))}
                        </Stack>
                    </Alert>
                )}

                {/* Bulk controls */}
                <Group>
                    <Button
                        variant="subtle"
                        onClick={() => setSelected(Object.fromEntries(actions.map(a => [a.action_key, true])))}
                        disabled={!isActionable}
                    >
                        Select all
                    </Button>
                    <Button
                        variant="subtle"
                        onClick={() => setSelected(Object.fromEntries(actions.map(a => [a.action_key, false])))}
                        disabled={!isActionable}
                    >
                        Deselect all
                    </Button>
                </Group>

                {/* Actions list */}
                {actions.length === 0 ? (
                    <Text c="dimmed" size="sm">No actions in this plan.</Text>
                ) : (
                    <Stack gap="md">
                        {actions.map((r) => {
                            const k = r.action_key;
                            const sel = !!selected[k];
                            const recommended = typeof r.delta_pct === 'number' ? r.delta_pct : 0;
                            const current = typeof edits[k] === 'number' ? edits[k]! : recommended;

                            const title = r.entity_name
                                ? `${r.entity_name} (${r.entity_external_id})`
                                : r.entity_external_id;

                            return (
                                <Paper key={k} withBorder p="md" radius="md">
                                    <Group justify="space-between" align="center" mb={4}>
                                        <Group gap="xs" align="center">
                                            <Checkbox
                                                checked={sel}
                                                onChange={(e) => setSelected((prev) => ({ ...prev, [k]: e.currentTarget.checked }))}
                                                disabled={!isActionable}
                                            />
                                            <Badge color={pillColor(r.type, current)}>
                                                {r.type === 'budget_change' ? (current >= 0 ? 'Increase' : 'Reduce') : r.type}
                                            </Badge>
                                            <Text fw={700}>
                                                {r.type === 'budget_change'
                                                    ? `${current >= 0 ? 'Increase' : 'Reduce'} budget ${Math.abs(current)}%`
                                                    : r.type === 'pause_entity'
                                                        ? 'Pause this ad set'
                                                        : r.type === 'creative_rotate'
                                                            ? 'Rotate creatives'
                                                            : r.type}
                                            </Text>
                                        </Group>
                                        <Text c="dimmed" size="sm">{r.objective || '—'}</Text>
                                    </Group>

                                    <Text size="sm" c="dimmed" mb="xs">
                                        {title}{r.campaign_name ? ` · Campaign ${r.campaign_name}` :
                                            r.campaign_external_id ? ` · Campaign ${r.campaign_external_id}` : ''}
                                    </Text>

                                    {r.type === 'budget_change' && (
                                        <Stack gap={8} mb="xs">
                                            <Group align="flex-end" grow>
                                                <div>
                                                    <Text size="xs" c="dimmed">Recommendation</Text>
                                                    <Badge variant="light" color={recommended >= 0 ? 'green' : 'red'}>
                                                        {recommended >= 0 ? '+' : ''}{recommended}%
                                                    </Badge>
                                                </div>
                                                <div>
                                                    <Text size="xs" c="dimmed">Your selection</Text>
                                                    <Badge variant="filled" color={current >= 0 ? 'green' : 'red'}>
                                                        {current >= 0 ? '+' : ''}{current}%
                                                    </Badge>
                                                </div>
                                                <div>
                                                    <Text size="xs" c="dimmed">Cap</Text>
                                                    <Badge variant="light">±{approvedLimit}%</Badge>
                                                </div>
                                            </Group>

                                            <Slider
                                                min={-approvedLimit}
                                                max={approvedLimit}
                                                step={1}
                                                value={current}
                                                onChange={(v) => updateEdit(k, v as number)}
                                                disabled={!isActionable}
                                                marks={[{ value: -15, label: '-15%' }, { value: 0, label: '0%' }, { value: 15, label: '+15%' }]}
                                            />
                                            <Group gap="xs">
                                                <Button size="xs" variant="light" onClick={() => updateEdit(k, recommended)} disabled={!isActionable}>
                                                    Use recommendation
                                                </Button>
                                                <NumberInput
                                                    size="xs"
                                                    value={current}
                                                    onChange={(v) => updateEdit(k, v as number)}
                                                    min={-approvedLimit} max={approvedLimit} step={1} suffix="%"
                                                    disabled={!isActionable}
                                                />
                                            </Group>
                                        </Stack>
                                    )}

                                    <Text size="sm">{explain(r)}</Text>

                                    {r.requires_human && (
                                        <Group gap={6} mt="xs">
                                            <ThemeIcon color="yellow" size="sm" variant="light"><IconAlertTriangle size={14} /></ThemeIcon>
                                            <Text size="sm">This was flagged for human review.</Text>
                                        </Group>
                                    )}
                                </Paper>
                            );
                        })}
                    </Stack>
                )}

                {/* Reviewer comment + final actions */}
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
