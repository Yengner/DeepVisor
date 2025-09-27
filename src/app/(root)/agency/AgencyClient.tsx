'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/utils/supabase/clients/browser';
import {
  Container, Card, Title, Text, Stack, Button, Group, Divider, Badge, NumberInput, Grid,
  Paper, Progress, Table, Tooltip, ActionIcon, ThemeIcon, Drawer, JsonInput, Switch,
  SegmentedControl, Chip, Avatar
} from '@mantine/core';
import {
  IconRobot, IconBolt, IconCheck, IconX, IconAlertTriangle, IconClock,
  IconPlayerPlay, IconSettings, IconCalendarTime, IconListCheck, IconWand
} from '@tabler/icons-react';
import toast from 'react-hot-toast';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip as RTooltip, CartesianGrid, Legend
} from 'recharts';
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

// -------------------- Add-on UI: Pipeline Stepper --------------------
function PipelineStepper({ currentStep }: { currentStep?: string | null }) {
  const steps = ['plan', 'gatekeeper', 'approve', 'execute', 'verify'];
  return (
    <Group gap="xs" wrap="nowrap">
      {steps.map((s, i) => {
        const active = currentStep === s;
        return (
          <Group key={s} gap={6} wrap="nowrap">
            <Badge variant={active ? 'filled' : 'light'} color={active ? 'blue' : 'gray'}>
              {s.toUpperCase()}
            </Badge>
            {i < steps.length - 1 && <Text c="dimmed">›</Text>}
          </Group>
        );
      })}
    </Group>
  );
}

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
    <Card withBorder p="lg" radius="md">
      <Group justify="space-between" mb="sm">
        <Title order={4}>Playbooks</Title>
      </Group>
      <Grid>
        {PLAYBOOKS.map((p) => (
          <Grid.Col key={p.id} span={{ base: 12, sm: 6, md: 4 }}>
            <Paper withBorder p="md" radius="md">
              <Group mb="xs">
                <ThemeIcon variant="light"><p.icon size={18} /></ThemeIcon>
                <Text fw={600}>{p.name}</Text>
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
          </Grid.Col>
        ))}
      </Grid>
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

function KPI({ label, value, delta, positive }: { label: string; value: string; delta?: string; positive?: boolean }) {
  return (
    <Paper withBorder p="md" radius="md">
      <Text c="dimmed" size="sm">{label}</Text>
      <Group justify="space-between" mt={6}>
        <Title order={3}>{value}</Title>
        {delta && (
          <Badge color={positive ? 'green' : 'red'} variant="light">{delta}</Badge>
        )}
      </Group>
    </Paper>
  );
}

function PerformanceOverview() {
  const totals = demoPerf.reduce((acc, r) => {
    acc.spend += r.spend; acc.leads += r.leads; return acc;
  }, { spend: 0, leads: 0 });
  const cpl = totals.leads ? (totals.spend / totals.leads) : 0;

  return (
    <Card withBorder p="lg" radius="md">
      <Group justify="space-between" mb="sm">
        <Title order={4}>Performance Overview</Title>
        <Chip checked={false} onChange={() => {}} variant="light">Last 7 days</Chip>
      </Group>

      <Grid mb="md">
        <Grid.Col span={{ base: 12, md: 4 }}>
          <KPI label="Spend" value={`$${totals.spend.toFixed(0)}`} delta="+8%" positive />
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <KPI label="Leads" value={`${totals.leads}`} delta="+11%" positive />
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <KPI label="CPL" value={`$${cpl.toFixed(2)}`} delta="-3%" positive />
        </Grid.Col>
      </Grid>

      <div style={{ height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={demoPerf} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="spend" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="currentColor" stopOpacity={0.35}/>
                <stop offset="95%" stopColor="currentColor" stopOpacity={0.02}/>
              </linearGradient>
              <linearGradient id="leads" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="currentColor" stopOpacity={0.35}/>
                <stop offset="95%" stopColor="currentColor" stopOpacity={0.02}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="day" />
            <YAxis />
            <RTooltip />
            <Legend />
            <Area type="monotone" dataKey="spend" stroke="currentColor" fill="url(#spend)" />
            <Area type="monotone" dataKey="leads" stroke="currentColor" fill="url(#leads)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

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
  return (
    <Card withBorder p="lg" radius="md">
      <Group justify="space-between" mb="xs">
        <Group gap="xs">
          <ThemeIcon variant="light"><IconListCheck size={16} /></ThemeIcon>
          <Title order={4}>Next steps</Title>
        </Group>
        <Badge variant="light">{items.length}</Badge>
      </Group>
      <Text c="dimmed" size="sm" mb="sm">What the agency will do next, in order.</Text>

      <Stack gap="sm">
        {items.map((s) => (
          <Paper key={s.id} withBorder p="sm" radius="md">
            <Group justify="space-between" align="start">
              <Group>
                <Avatar size="sm" radius="xl">{s.label[0]}</Avatar>
                <div>
                  <Group gap="xs">
                    <Text fw={600}>{s.label}</Text>
                    <Badge variant="light" leftSection={<IconCalendarTime size={12} />}>
                      {formatTime(s.at)}
                    </Badge>
                    <Badge variant="light" color={s.requiresApproval ? 'blue' : 'green'}>
                      {s.requiresApproval ? 'Needs review' : 'Auto'}
                    </Badge>
                    {s.estImpact && <Badge variant="light">{s.estImpact}</Badge>}
                  </Group>
                  <Text size="sm" c="dimmed">{s.details}</Text>
                </div>
              </Group>
              <Group gap="xs">
                <Button size="xs" variant="light" onClick={() => onSkip(s)}>Skip</Button>
                <Button size="xs" onClick={() => onRunNow(s)}>Run now</Button>
              </Group>
            </Group>
          </Paper>
        ))}
      </Stack>
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

      <Container size="lg" py="md">
        <Stack gap="xl">
          {/* Top: Brand + Controls */}
          <Card withBorder p="xl" radius="md">
            <Group justify="space-between" align="center" mb="md">
              <Group>
                <IconRobot size={32} color="#228be6" />
                <div>
                  <Title order={2}>Agency</Title>
                  <Text c="dimmed" size="sm">Automated planner, guardrails, executor.</Text>
                </div>
              </Group>
              <Badge color={modeBadgeColor(mode)} size="lg" variant="light">{mode.toUpperCase()}</Badge>
            </Group>
            <Divider my="sm" />

            {/* Sleek control bar */}
            <Grid align="end">
              <Grid.Col span={{ base: 12, md: 5 }}>
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
                </Stack>
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 3 }}>
                <NumberInput
                  label="Max budget change per run (%)"
                  min={1}
                  max={50}
                  value={capPct}
                  onChange={(v) => setCapPct(Number(v || 0))}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 4 }}>
                <Stack gap="xs">
                  <Switch
                    checked={autoEnabled}
                    onChange={(e) => toggleSchedule(e.currentTarget.checked)}
                    label="Run daily at 9:00 AM"
                  />
                  <Group gap="xs">
                    <Button variant="light" onClick={saveSettings} leftSection={<IconSettings size={14} />}>Save</Button>
                    <Button onClick={runNow} leftSection={<IconPlayerPlay size={16} />}>Run now</Button>
                  </Group>
                </Stack>
              </Grid.Col>
            </Grid>
          </Card>

          {/* Middle: Performance + Next Steps */}
          <AdAccountQueuesClient tenantId={userId} adAccountRowId={adAccountId} />


          {/* Playbooks */}
          <PlaybooksGrid adAccountId={adAccountId} />

          {/* Recent Decisions */}
          <Card withBorder p="lg" radius="md">
            <Group justify="space-between" mb="sm">
              <Title order={4}>Recent Decisions</Title>
              <Badge variant="light">{filteredDecisions.length} items</Badge>
            </Group>
            {filteredDecisions.length === 0 ? (
              <Text c="dimmed" size="sm">No decisions yet. Run the optimizer to generate plans.</Text>
            ) : (
              <Table striped highlightOnHover withRowBorders={false} stickyHeader>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Created</Table.Th>
                    <Table.Th>Mode</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Actions</Table.Th>
                    <Table.Th>Gatekeeper</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {filteredDecisions.map((d) => {
                    const actionsCount = Array.isArray(d.plan_json?.actions) ? d.plan_json.actions.length : 0;
                    const gkOk = d.gatekeeper_result?.ok;
                    const btnLabel = d.status === 'needs_review' ? 'Review' : 'View';
                    const btnVariant = d.status === 'needs_review' ? 'light' : 'subtle';
                    
                    return (
                      <Table.Tr key={d.id}>
                        <Table.Td>{new Date(d.created_at).toLocaleString()}</Table.Td>
                        <Table.Td><Badge color={modeBadgeColor(d.mode)}>{d.mode}</Badge></Table.Td>
                        <Table.Td><Badge color={decisionStatusColor(d.status)}>{d.status}</Badge></Table.Td>
                        <Table.Td>
                          <Group gap="xs">
                            <Badge variant="light">{actionsCount}</Badge>
                            <Button
                              size="xs"
                              variant={btnVariant as any}
                              onClick={() => { setActiveDecision(d); setReviewOpen(true); }}
                            >
                              {btnLabel}
                            </Button>
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

      {/* Approvals Drawer */}
      <ApprovalsDrawer opened={reviewOpen} onClose={() => setReviewOpen(false)} decision={activeDecision} />
    </>
  );
}
