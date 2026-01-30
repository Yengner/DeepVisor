'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/client/supabase/browser';
import {
  Container, Card, Title, Text, Stack, Button, Group, Badge, NumberInput,
  Paper, Progress, ThemeIcon, Drawer, JsonInput, Switch, Table, Box, Grid,
  SegmentedControl, SimpleGrid, Timeline
} from '@mantine/core';
import {
  IconRobot, IconBolt, IconCheck, IconX, IconAlertTriangle, IconClock,
  IconPlayerPlay, IconSettings, IconCalendarTime, IconListCheck, IconWand
} from '@tabler/icons-react';
import toast from 'react-hot-toast';
import JobLoadingModal from '@/components/ui/states/JobLoadingModal';
import AdAccountQueuesClient from './components/AdAccountQueuesClient';

// -------------------- Types --------------------
type JobRow = {
  id: string;
  user_id: string;
  type: string;
  status: 'queued' | 'running' | 'done' | 'error' | 'canceled';
  step: string | null;
  percent: number | null;
  error: string | null;
  meta: any | null;
  created_at: string;
  updated_at: string;
};

type DecisionRow = {
  id: string;
  user_id: string;
  ad_account_id: string;
  job_id: string;
  mode: 'shadow' | 'review' | 'auto' | 'canary';
  status: 'planned' | 'needs_review' | 'executed' | 'rejected' | 'failed';
  plan_json: any;
  gatekeeper_result: any | null;
  execution_result: any | null;
  created_at: string;
  executed_at: string | null;
};

type NextStep = {
  id: string;
  at: string;              // ISO time when it will run
  label: string;           // Short title
  details: string;         // One-liner
  playbook: 'daily_optimizer' | 'creative_rotate' | 'budget_pacer' | string;
  requiresApproval: boolean;
  estImpact?: string;      // e.g., "~ +10% leads"
  status: 'scheduled' | 'queued' | 'running';
};

// -------------------- Helpers --------------------
function jobStatusColor(s: JobRow['status']) {
  if (s === 'running') return 'yellow';
  if (s === 'done') return 'green';
  if (s === 'error') return 'red';
  if (s === 'queued') return 'gray';
  return 'gray';
}
function decisionStatusColor(s: DecisionRow['status']) {
  if (s === 'planned') return 'yellow';
  if (s === 'needs_review') return 'blue';
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
function formatTime(iso?: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

const modeDescriptions: Record<'shadow' | 'review' | 'auto' | 'canary', string> = {
  shadow: 'Dry run only — simulate changes with zero risk.',
  review: 'Guardrailed changes that need your approval.',
  auto: 'Hands-off automation with enforced caps.',
  canary: 'Test changes on a small slice before rollout.',
};

function truncateId(id?: string) {
  if (!id) return 'Unknown';
  if (id.length <= 12) return id;
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}

// -------------------- Add-on UI: Pipeline Stepper --------------------
// -------------------- Add-on UI: Approvals Drawer --------------------
function ApprovalsDrawer({
  opened, onClose, decision
}: { opened: boolean; onClose: () => void; decision: DecisionRow | null }) {
  if (!decision) return null;
  const actions = Array.isArray(decision.plan_json?.actions) ? decision.plan_json.actions : [];
  return (
    <Drawer opened={opened} onClose={onClose} title="Review plan" position="right" size="lg" padding="md">
      <Stack gap="md">
        <Text c="dimmed" size="sm">Proposed actions</Text>
        <Table striped withRowBorders={false}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Type</Table.Th>
              <Table.Th>Target</Table.Th>
              <Table.Th>Change</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {actions.map((a: any, i: number) => (
              <Table.Tr key={i}>
                <Table.Td><Badge variant="light">{a.type}</Badge></Table.Td>
                <Table.Td>{a.target}</Table.Td>
                <Table.Td>
                  {a.before != null && <Text size="xs" c="dimmed">from: {String(a.before)}</Text>}
                  {a.after  != null && <Text size="xs">to: {String(a.after)}</Text>}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>

        <JsonInput
          label="Raw plan JSON"
          value={JSON.stringify(decision.plan_json ?? {}, null, 2)}
          autosize minRows={8}
          readOnly
        />

        <Group justify="end">
          <Button variant="default" onClick={onClose}>Close</Button>
          <Button color="red" onClick={async () => {
            const res = await fetch(`/api/decisions/${decision.id}/reject`, { method: 'POST' });
            res.ok ? toast.success('Rejected') : toast.error('Failed to reject');
            onClose();
          }}>Reject All</Button>
          <Button onClick={async () => {
            const res = await fetch(`/api/decisions/${decision.id}/approve`, { method: 'POST' });
            res.ok ? toast.success('Approved & executing') : toast.error('Failed to approve');
            onClose();
          }}>Approve & Execute</Button>
        </Group>
      </Stack>
    </Drawer>
  );
}

// -------------------- Add-on UI: Playbooks Grid --------------------
const PLAYBOOKS = [
  { id: 'daily_optimizer', name: 'Daily Optimizer', desc: 'Scale winners, pause losers with caps', icon: IconBolt },
  { id: 'creative_rotate',  name: 'Rotate Creatives', desc: 'Swap in top posts weekly', icon: IconWand },
  { id: 'budget_pacer',     name: 'Budget Pacer',    desc: 'Stay on track vs monthly target', icon: IconClock },
];

function PlaybooksGrid({ adAccountId }: { adAccountId: string }) {
  return (
    <Card
      withBorder
      p="lg"
      radius="lg"
      style={{
        background: 'linear-gradient(135deg, rgba(14,165,233,0.12), rgba(14,165,233,0.04))',
        borderColor: 'var(--mantine-color-gray-3)',
      }}
    >
      <Group justify="space-between" mb="md">
        <div>
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Playbooks</Text>
          <Text fw={700}>Preset automations</Text>
        </div>
        <Badge variant="light" color="blue">Ready</Badge>
      </Group>
      <Text size="sm" c="dimmed" mb="md">
        Launch curated automations with the same guardrails from your dashboard.
      </Text>
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
        {PLAYBOOKS.map((p) => (
          <Paper
            key={p.id}
            withBorder
            p="md"
            radius="md"
            shadow="sm"
            style={{ borderColor: 'var(--mantine-color-gray-3)' }}
          >
            <Group mb="xs">
              <ThemeIcon variant="light" color="blue"><p.icon size={18} /></ThemeIcon>
              <Text fw={700}>{p.name}</Text>
            </Group>
            <Text c="dimmed" size="sm" mb="md">{p.desc}</Text>
            <Group>
              <Button size="xs" onClick={async () => {
                const res = await fetch('/api/playbooks/run', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ adAccountId, playbook: p.id })
                });
                res.ok ? toast.success(`${p.name} started`) : toast.error('Failed to start');
              }}>
                Run now
              </Button>
              <Button size="xs" variant="light" onClick={async () => {
                const res = await fetch('/api/playbooks/schedule', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ adAccountId, playbook: p.id, cron: '0 9 * * *' })
                });
                res.ok ? toast.success(`${p.name} scheduled`) : toast.error('Failed to schedule');
              }}>
                Schedule
              </Button>
            </Group>
          </Paper>
        ))}
      </SimpleGrid>
    </Card>
  );
}

// -------------------- Add-on UI: Performance Overview --------------------
const demoPerf = [
  { day: 'Mon', spend: 120, leads: 9,  cpl: 13.3 },
  { day: 'Tue', spend: 140, leads: 12, cpl: 11.7 },
  { day: 'Wed', spend: 90,  leads: 8,  cpl: 11.3 },
  { day: 'Thu', spend: 160, leads: 13, cpl: 12.3 },
  { day: 'Fri', spend: 180, leads: 16, cpl: 11.2 },
  { day: 'Sat', spend: 130, leads: 10, cpl: 13.0 },
  { day: 'Sun', spend: 150, leads: 12, cpl: 12.5 },
];

// -------------------- Add-on UI: Next Steps Queue --------------------
function NextStepsQueue({
  items,
  onRunNow,
  onSkip
}: {
  items: NextStep[];
  onRunNow: (s: NextStep) => void;
  onSkip: (s: NextStep) => void;
}) {
  const activeIndex = items.findIndex((s) => s.status === 'running');
  const active = activeIndex === -1 ? 0 : activeIndex;

  const statusTone = (status: NextStep['status']) => {
    if (status === 'running') return 'blue';
    if (status === 'queued') return 'yellow';
    return 'gray';
  };

  return (
    <Card
      withBorder
      p="lg"
      radius="lg"
      style={{
        background: 'linear-gradient(135deg, rgba(59,130,246,0.06), rgba(14,165,233,0.03))',
        borderColor: 'var(--mantine-color-gray-3)',
      }}
    >
      <Group justify="space-between" mb="sm">
        <Group gap="xs">
          <ThemeIcon variant="light" color="blue" radius="xl">
            <IconListCheck size={16} />
          </ThemeIcon>
          <div>
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Next steps</Text>
            <Text fw={700}>Planned with guardrails</Text>
          </div>
        </Group>
        <Badge variant="light" color="blue">{items.length} queued</Badge>
      </Group>
      <Text c="dimmed" size="sm" mb="md">
        The queue mirrors your dashboard cadence. Run instantly or let the schedule handle it.
      </Text>

      <Timeline bulletSize={22} lineWidth={2} active={active}>
        {items.map((s) => (
          <Timeline.Item
            key={s.id}
            bullet={
              <ThemeIcon variant="light" color={statusTone(s.status)} radius="xl">
                <IconClock size={14} />
              </ThemeIcon>
            }
            title={
              <Group justify="space-between" align="center">
                <Group gap="xs">
                  <Text fw={700}>{s.label}</Text>
                  <Badge variant="light" color={statusTone(s.status)}>{s.status}</Badge>
                </Group>
                <Badge variant="light" color={s.requiresApproval ? 'blue' : 'green'}>
                  {s.requiresApproval ? 'Needs review' : 'Auto'}
                </Badge>
              </Group>
            }
          >
            <Group gap="xs" mb={6}>
              <Badge variant="light" leftSection={<IconCalendarTime size={12} />}>
                {formatTime(s.at)}
              </Badge>
              {s.estImpact && <Badge variant="outline" color="teal">{s.estImpact}</Badge>}
            </Group>
            <Text size="sm" c="dimmed" mb="xs">{s.details}</Text>
            <Group gap="xs">
              <Button size="xs" variant="light" color="gray" onClick={() => onSkip(s)}>Skip</Button>
              <Button
                size="xs"
                variant="filled"
                color="blue"
                leftSection={<IconPlayerPlay size={14} />}
                onClick={() => onRunNow(s)}
              >
                Run now
              </Button>
            </Group>
          </Timeline.Item>
        ))}
      </Timeline>
    </Card>
  );
}

// -------------------- Main Client --------------------
export default function AgencyClient({
  userId,
  adAccountId,
  tenantId
}: {
  userId: string;
  adAccountId: string; 
  tenantId: string; 
}) {
  const supabase = createClient();

  const [mode, setMode] = useState<'shadow' | 'review' | 'auto' | 'canary'>('review');
  const [capPct, setCapPct] = useState<number>(25);
  const [autoEnabled, setAutoEnabled] = useState<boolean>(false);

  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [decisions, setDecisions] = useState<DecisionRow[]>([]);

  const [runningJobId, setRunningJobId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  const [reviewOpen, setReviewOpen] = useState(false);
  const [activeDecision, setActiveDecision] = useState<DecisionRow | null>(null);

  const [queue, setQueue] = useState<NextStep[]>([
    {
      id: 'q1',
      at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      label: 'Check performance',
      details: 'Evaluate last 24h CPA vs target; flag anomalies',
      playbook: 'daily_optimizer',
      requiresApproval: false,
      estImpact: '~ keep CPL stable',
      status: 'scheduled'
    },
    {
      id: 'q2',
      at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      label: 'Adjust budgets',
      details: 'Scale top ad sets +10%, pause underperformers',
      playbook: 'daily_optimizer',
      requiresApproval: mode !== 'auto',
      estImpact: '~ +5–10% leads',
      status: 'scheduled'
    },
    {
      id: 'q3',
      at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      label: 'Rotate creatives',
      details: 'Replace fatigued ads with top post (7d)',
      playbook: 'creative_rotate',
      requiresApproval: mode === 'review',
      estImpact: '~ +2% CTR',
      status: 'scheduled'
    },
  ]);

  const lastJob = jobs[0];

  // Load overview + schedule flag
  useEffect(() => {
    (async () => {
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
      if (j) setJobs(j as JobRow[]);
      if (d) setDecisions(d as DecisionRow[]);

      try {
        const schedRes = await fetch(`/api/schedules/${adAccountId}?playbook=daily_optimizer`);
        if (schedRes.ok) {
          const sched = await schedRes.json(); // { enabled:boolean }
          if (typeof sched?.enabled === 'boolean') setAutoEnabled(sched.enabled);
        }
      } catch {}
    })();
  }, [userId, adAccountId, supabase]);

  // Realtime updates
  useEffect(() => {
    const chDec = supabase
      .channel(`decisions-${userId}-${adAccountId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'decisions', filter: `user_id=eq.${userId}`
      }, payload => {
        const d = payload.new as DecisionRow;
        if (d.ad_account_id === adAccountId) setDecisions(prev => [d, ...prev].slice(0, 10));
      })
      .subscribe();

    const chJobs = supabase
      .channel(`jobs-${userId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'jobs', filter: `user_id=eq.${userId}`
      }, payload => {
        const j = payload.new as JobRow;
        if (j.type === 'daily_optimizer') setJobs(prev => [j, ...prev].slice(0, 5));
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'jobs', filter: `user_id=eq.${userId}`
      }, payload => {
        const j = payload.new as JobRow;
        setJobs(prev => prev.map(x => x.id === j.id ? j : x));
      })
      .subscribe();

    return () => { supabase.removeChannel(chDec); supabase.removeChannel(chJobs); };
  }, [supabase, userId, adAccountId]);

  async function runNow() {
    const res = await fetch('/api/n8n/optimizer/run', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, adAccountId, mode, caps: { max_account_budget_change_pct: capPct } }),
    });
    const data = await res.json();
    if (!res.ok || !data?.jobId) {
      toast.error('Failed to start optimizer: ' + (data?.error || 'Unknown error'));
      return;
    }
    toast.success('Optimizer started');
    setRunningJobId(data.jobId);
    setShowModal(true);
  }

  async function runPlaybook(playbook: string) {
    const res = await fetch('/api/playbooks/run', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adAccountId, playbook }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error('Failed to start playbook');
      return;
    }
    toast.success('Playbook started');
    if (data?.jobId) {
      setRunningJobId(data.jobId);
      setShowModal(true);
    }
  }

  async function saveSettings() {
    const res = await fetch(`/api/accounts/${adAccountId}/optimizer-mode`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ optimizer_mode: mode, caps: { max_account_budget_change_pct: capPct } }),
    });
    res.ok ? toast.success('Settings saved') : toast.error('Failed to save settings');
  }

  async function toggleSchedule(enabled: boolean) {
    setAutoEnabled(enabled);
    const res = await fetch(`/api/schedules/${adAccountId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playbook: 'daily_optimizer', enabled, cron: '0 9 * * *' })
    });
    res.ok ? toast.success(enabled ? 'Daily run enabled' : 'Daily run disabled')
           : toast.error('Failed to update schedule');
  }

  async function refreshAfterJob() {
    setShowModal(false);
    const [{ data: j }, { data: d }] = await Promise.all([
      supabase.from('jobs').select('*')
        .eq('user_id', userId).eq('type', 'daily_optimizer')
        .order('created_at', { ascending: false }).limit(5),
      supabase.from('decisions').select('*')
        .eq('user_id', userId).eq('ad_account_id', adAccountId)
        .order('created_at', { ascending: false }).limit(10),
  ]);
  if (j) setJobs(j as JobRow[]);
  if (d) setDecisions(d as DecisionRow[]);
}

  const filteredDecisions = useMemo(() => decisions, [decisions]);
  const perfTotals = useMemo(() => {
    const totals = demoPerf.reduce(
      (acc, r) => ({ spend: acc.spend + r.spend, leads: acc.leads + r.leads }),
      { spend: 0, leads: 0 }
    );
    const cpl = totals.leads ? totals.spend / totals.leads : 0;
    return { ...totals, cpl };
  }, []);
  const nextScheduled = queue[0];
  const nextPreview = queue.slice(0, 3);
  const scheduleBadgeColor = autoEnabled ? 'teal' : 'gray';
  const modeLabel = mode.toUpperCase();
  const lastRunLabel = lastJob ? formatTime(lastJob.created_at) : 'Not run yet';
  const pendingReviews = filteredDecisions.filter((d) => d.status === 'needs_review').length;
  const nextStepLabel = nextScheduled ? nextScheduled.label : 'No steps queued';
  const nextStepTime = nextScheduled ? formatTime(nextScheduled.at) : 'No schedule';
  const summaryCards = [
    { label: 'Mode', value: modeLabel, helper: modeDescriptions[mode], color: modeBadgeColor(mode), icon: IconRobot },
    { label: 'Guardrails', value: `${capPct}% cap`, helper: 'Max budget change per run', color: 'teal', icon: IconAlertTriangle },
    { label: 'Next action', value: nextStepLabel, helper: nextStepTime, color: 'blue', icon: IconClock },
    { label: 'Automation', value: autoEnabled ? 'Daily @ 9:00 AM' : 'Manual', helper: autoEnabled ? 'Schedule active' : 'Run on demand', color: autoEnabled ? 'green' : 'gray', icon: IconPlayerPlay },
  ];

  const handleRunStep = (step: NextStep) => runPlaybook(step.playbook);
  const handleSkipStep = (step: NextStep) => setQueue((prev) => prev.filter((q) => q.id !== step.id));

  return (
    <>
      {runningJobId && (
        <JobLoadingModal
          jobId={runningJobId}
          opened={showModal}
          onClose={() => setShowModal(false)}
          onDone={refreshAfterJob}
        />
      )}

      <Container size="xl" py="md">
        <Stack gap="lg">
          <Card
            radius="lg"
            p="xl"
            withBorder
            style={{
              position: 'relative',
              overflow: 'hidden',
              background: 'linear-gradient(120deg, #0f172a 0%, #111827 50%, #0ea5e9 130%)',
              borderColor: 'rgba(255,255,255,0.08)',
            }}
          >
            <Box
              style={{
                position: 'absolute',
                inset: 0,
                background:
                  'radial-gradient(circle at 20% 20%, rgba(14,165,233,0.2), transparent 34%), radial-gradient(circle at 80% 0%, rgba(14,165,233,0.18), transparent 28%)',
              }}
            />
            <Group justify="space-between" align="flex-start" pos="relative">
              <Stack gap="sm" maw={760}>
                <Group gap="xs">
                  <Badge variant="light" color="cyan" size="md">
                    Account {truncateId(adAccountId)}
                  </Badge>
                  <Badge variant="outline" color="gray" size="md">
                    Tenant {truncateId(tenantId)}
                  </Badge>
                  <Badge color={modeBadgeColor(mode)} variant="light" size="md">
                    Mode {modeLabel}
                  </Badge>
                </Group>
                <Title order={2} c="white">Automation control</Title>
                <Text c="gray.3" size="sm">
                  Keep automation in the same visual language as the dashboard—approvals, guardrails, and schedules all live here.
                </Text>
                <Group gap="sm">
                  <Button
                    onClick={runNow}
                    leftSection={<IconPlayerPlay size={16} />}
                    variant="white"
                    color="dark"
                  >
                    Run optimizer
                  </Button>
                  <Button
                    variant="outline"
                    color="gray"
                    leftSection={<IconSettings size={14} />}
                    onClick={saveSettings}
                  >
                    Save guardrails
                  </Button>
                </Group>
                <Group gap="xs">
                  <Badge variant="light" color={scheduleBadgeColor}>
                    {autoEnabled ? 'Daily schedule on' : 'Schedule off'}
                  </Badge>
                  {nextScheduled && (
                    <Badge variant="outline" color="blue">
                      Next: {formatTime(nextScheduled.at)}
                    </Badge>
                  )}
                  <Badge variant="light" color="gray">
                    Last run {lastRunLabel}
                  </Badge>
                </Group>
              </Stack>
              <Stack gap={8} align="flex-end">
                <ThemeIcon size={56} radius="xl" variant="white" color="blue">
                  <IconRobot size={28} />
                </ThemeIcon>
                <Badge variant="light" color="green">
                  Automation live
                </Badge>
              </Stack>
            </Group>

            <Group mt="lg" gap="md" align="stretch" wrap="wrap" pos="relative">
              <Box
                p="md"
                style={{
                  minWidth: 200,
                  flex: '1 1 0',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 12,
                  backdropFilter: 'blur(4px)',
                }}
              >
                <Text size="xs" c="gray.3" tt="uppercase" fw={700}>
                  Guardrail cap
                </Text>
                <Text fw={800} size="xl" c="white">
                  {capPct}%
                </Text>
                <Badge mt={8} size="sm" color="teal" variant="light">
                  Budget change limit
                </Badge>
              </Box>
              <Box
                p="md"
                style={{
                  minWidth: 200,
                  flex: '1 1 0',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 12,
                  backdropFilter: 'blur(4px)',
                }}
              >
                <Text size="xs" c="gray.3" tt="uppercase" fw={700}>
                  Queue
                </Text>
                <Text fw={800} size="xl" c="white">
                  {queue.length} steps
                </Text>
                <Badge mt={8} size="sm" color="blue" variant="light">
                  {nextStepLabel}
                </Badge>
              </Box>
              <Box
                p="md"
                style={{
                  minWidth: 200,
                  flex: '1 1 0',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 12,
                  backdropFilter: 'blur(4px)',
                }}
              >
                <Text size="xs" c="gray.3" tt="uppercase" fw={700}>
                  Approvals
                </Text>
                <Text fw={800} size="xl" c="white">
                  {pendingReviews} waiting
                </Text>
                <Badge mt={8} size="sm" color={pendingReviews ? 'yellow' : 'green'} variant="light">
                  {pendingReviews ? 'Needs review' : 'All clear'}
                </Badge>
              </Box>
            </Group>
          </Card>

          <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="lg">
            {summaryCards.map((card) => (
              <Card
                key={card.label}
                withBorder
                radius="lg"
                p="lg"
                style={{
                  background: 'linear-gradient(135deg, rgba(14,165,233,0.08), rgba(14,165,233,0.02))',
                  borderColor: 'var(--mantine-color-gray-3)',
                }}
              >
                <Group justify="space-between" mb="sm">
                  <Badge size="sm" variant="light" color={card.color}>
                    {card.label}
                  </Badge>
                  <ThemeIcon variant="light" color={card.color} size="sm">
                    <card.icon size={16} />
                  </ThemeIcon>
                </Group>
                <Text fw={800} size="xl">
                  {card.value}
                </Text>
                <Text size="sm" c="dimmed">
                  {card.helper}
                </Text>
              </Card>
            ))}
          </SimpleGrid>

          <Grid columns={12} gutter="xl">
            <Grid.Col span={{ base: 12, lg: 8 }}>
              <Stack gap="lg">
                <Card withBorder radius="lg" p="lg">
                  <Group justify="space-between" mb="lg">
                    <div>
                      <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Control center</Text>
                      <Text fw={700}>Automation with guardrails</Text>
                    </div>
                    <Badge color={modeBadgeColor(mode)} variant="light">
                      {modeLabel}
                    </Badge>
                  </Group>

                  <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
                    <Stack gap="xs">
                      <Text size="sm" c="dimmed">Mode</Text>
                      <SegmentedControl
                        value={mode}
                        onChange={(v) => setMode(v as any)}
                        data={[
                          { label: 'Shadow', value: 'shadow' },
                          { label: 'Review', value: 'review' },
                          { label: 'Auto', value: 'auto' },
                          { label: 'Canary', value: 'canary' },
                        ]}
                      />
                      <Text size="sm" c="dimmed">{modeDescriptions[mode]}</Text>
                    </Stack>

                    <Stack gap="xs">
                      <NumberInput
                        label="Guardrails"
                        description="Max budget change per run"
                        min={1}
                        max={50}
                        value={capPct}
                        onChange={(v) => setCapPct(Number(v || 0))}
                      />
                      <Badge variant="light" color="teal">{capPct}% cap enforced</Badge>
                      <Text size="sm" c="dimmed">Keeps adjustments contained every cycle.</Text>
                    </Stack>

                    <Stack gap="xs">
                      <Switch
                        checked={autoEnabled}
                        onChange={(e) => toggleSchedule(e.currentTarget.checked)}
                        label="Daily run at 9:00 AM"
                      />
                      <Group gap="xs">
                        <Button
                          onClick={runNow}
                          leftSection={<IconPlayerPlay size={16} />}
                          variant="filled"
                          color="blue"
                        >
                          Run now
                        </Button>
                        <Button
                          variant="default"
                          onClick={saveSettings}
                          leftSection={<IconSettings size={14} />}
                        >
                          Save
                        </Button>
                      </Group>
                      <Text size="sm" c="dimmed">
                        {autoEnabled ? 'Schedule active' : 'Schedule paused'} · Last sync {lastRunLabel}
                      </Text>
                    </Stack>
                  </SimpleGrid>
                </Card>

                <NextStepsQueue items={queue} onRunNow={handleRunStep} onSkip={handleSkipStep} />

                <Card withBorder radius="lg" p="lg">
                  <Group justify="space-between" mb="md">
                    <div>
                      <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Recent decisions</Text>
                      <Text fw={700}>Automation transparency</Text>
                    </div>
                    <Badge variant="light" color={pendingReviews ? 'yellow' : 'blue'}>
                      {pendingReviews ? `${pendingReviews} need review` : `${filteredDecisions.length} items`}
                    </Badge>
                  </Group>
                  {filteredDecisions.length === 0 ? (
                    <Text c="dimmed" size="sm">No decisions yet. Run the optimizer to generate plans.</Text>
                  ) : (
                    <Stack gap="sm">
                      {filteredDecisions.map((d) => {
                        const actionsCount = Array.isArray(d.plan_json?.actions) ? d.plan_json.actions.length : 0;
                        const gkOk = d.gatekeeper_result?.ok;
                        const btnLabel = d.status === 'needs_review' ? 'Review' : 'View';
                        const btnVariant = d.status === 'needs_review' ? 'light' : 'subtle';

                        return (
                          <Paper
                            key={d.id}
                            withBorder
                            radius="md"
                            p="md"
                            style={{ borderColor: 'var(--mantine-color-gray-3)' }}
                          >
                            <Group justify="space-between" align="center">
                              <Stack gap={4}>
                                <Group gap="xs">
                                  <Badge color={decisionStatusColor(d.status)}>{d.status}</Badge>
                                  <Badge variant="light" color="gray">
                                    {formatTime(d.created_at)}
                                  </Badge>
                                </Group>
                                <Group gap="xs">
                                  <Badge variant="light" color={modeBadgeColor(d.mode)}>{d.mode}</Badge>
                                  <Badge variant="outline">{actionsCount} actions</Badge>
                                  {gkOk === true && <Badge color="green" leftSection={<IconCheck size={12} />}>Gatekeeper ok</Badge>}
                                  {gkOk === false && <Badge color="red" leftSection={<IconX size={12} />}>Blocked</Badge>}
                                  {gkOk == null && <Badge variant="light">Gatekeeper —</Badge>}
                                </Group>
                              </Stack>
                              <Button
                                size="xs"
                                variant={btnVariant as any}
                                onClick={() => { setActiveDecision(d); setReviewOpen(true); }}
                              >
                                {btnLabel}
                              </Button>
                            </Group>
                          </Paper>
                        );
                      })}
                    </Stack>
                  )}
                </Card>
              </Stack>
            </Grid.Col>

            <Grid.Col span={{ base: 12, lg: 4 }}>
              <Stack gap="lg">
                <Card withBorder radius="lg" p="lg">
                  <Group justify="space-between" mb="md">
                    <div>
                      <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Today&apos;s signals</Text>
                      <Text fw={700}>Calm snapshot</Text>
                    </div>
                    <Badge variant="light" color="blue">Live</Badge>
                  </Group>
                  <Stack gap="sm">
                    <Paper withBorder radius="md" p="md" style={{ borderColor: 'var(--mantine-color-gray-3)' }}>
                      <Group justify="space-between" mb="xs">
                        <Text fw={600}>Safety</Text>
                        <ThemeIcon size="sm" variant="light" color="teal">
                          <IconAlertTriangle size={14} />
                        </ThemeIcon>
                      </Group>
                      <Text fw={800} size="lg">{capPct}% cap</Text>
                      <Text size="sm" c="dimmed">Mode {modeLabel} · Guardrails on</Text>
                    </Paper>

                    <Paper withBorder radius="md" p="md" style={{ borderColor: 'var(--mantine-color-gray-3)' }}>
                      <Group justify="space-between" mb="xs">
                        <Text fw={600}>Performance</Text>
                        <Badge variant="light" color="blue">Demo</Badge>
                      </Group>
                      <Group gap="md" align="flex-end">
                        <Stack gap={2}>
                          <Text size="xs" c="dimmed">Spend</Text>
                          <Text fw={800} size="lg">${perfTotals.spend.toFixed(0)}</Text>
                        </Stack>
                        <Stack gap={2}>
                          <Text size="xs" c="dimmed">Leads</Text>
                          <Text fw={800} size="lg">{perfTotals.leads}</Text>
                        </Stack>
                        <Stack gap={2}>
                          <Text size="xs" c="dimmed">CPL</Text>
                          <Text fw={800} size="lg">${perfTotals.cpl.toFixed(2)}</Text>
                        </Stack>
                      </Group>
                      <Text size="xs" c="dimmed">Based on last 7 days demo data.</Text>
                    </Paper>

                    <Paper withBorder radius="md" p="md" style={{ borderColor: 'var(--mantine-color-gray-3)' }}>
                      <Group justify="space-between" mb="xs">
                        <Text fw={600}>Queue</Text>
                        <Badge variant="light" color="gray">{nextPreview.length} upcoming</Badge>
                      </Group>
                      <Stack gap={6}>
                        {nextPreview.map((item) => (
                          <Group key={item.id} justify="space-between">
                            <div>
                              <Text fw={600}>{item.label}</Text>
                              <Text size="xs" c="dimmed">{formatTime(item.at)}</Text>
                            </div>
                            <Badge variant="outline" color={item.requiresApproval ? 'blue' : 'green'}>
                              {item.requiresApproval ? 'Needs review' : 'Auto'}
                            </Badge>
                          </Group>
                        ))}
                        {nextPreview.length === 0 && (
                          <Text size="sm" c="dimmed">No queued steps yet.</Text>
                        )}
                      </Stack>
                    </Paper>
                  </Stack>
                </Card>

                <PlaybooksGrid adAccountId={adAccountId} />

                <Card withBorder radius="lg" p="lg">
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700} mb="xs">Ad account queues</Text>
                  <AdAccountQueuesClient tenantId={userId} adAccountRowId={adAccountId} />
                </Card>

                <Card withBorder radius="lg" p="lg">
                  <Group justify="space-between" mb="md">
                    <div>
                      <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Recent runs</Text>
                      <Text fw={700}>Execution trail</Text>
                    </div>
                    <Badge variant="light" color="blue">{jobs.length} jobs</Badge>
                  </Group>
                  {jobs.length === 0 ? (
                    <Text c="dimmed" size="sm">No runs yet.</Text>
                  ) : (
                    <Stack gap="sm">
                      {jobs.map((j) => (
                        <Paper
                          key={j.id}
                          withBorder
                          radius="md"
                          p="md"
                          style={{ borderColor: 'var(--mantine-color-gray-3)' }}
                        >
                          <Group justify="space-between" align="center" mb="xs">
                            <Group gap="xs">
                              <Badge color={jobStatusColor(j.status)}>{j.status}</Badge>
                              <Badge variant="light" color="gray">{formatTime(j.created_at)}</Badge>
                            </Group>
                            <Text size="sm" c="dimmed">{j.step || '—'}</Text>
                          </Group>
                          <Progress value={j.percent ?? 0} radius="xl" />
                        </Paper>
                      ))}
                    </Stack>
                  )}
                </Card>
              </Stack>
            </Grid.Col>
          </Grid>
        </Stack>
      </Container>

      <ApprovalsDrawer opened={reviewOpen} onClose={() => setReviewOpen(false)} decision={activeDecision} />
    </>
  );
}
