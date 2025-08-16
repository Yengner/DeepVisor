"use client";

import { useState } from "react";
import {
    Container,
    Card,
    Title,
    Text,
    TextInput,
    NumberInput,
    Select,
    Button,
    Group,
    Stack,
    Grid,
    Badge,
    Divider,
    Paper,
    Box,
    Tabs,
    ThemeIcon,
    Timeline,
    Stepper,
    ActionIcon,
    Tooltip
} from "@mantine/core";
import { 
    IconCheck, 
    IconX, 
    IconDeviceFloppy, 
    IconTarget, 
    IconUsers, 
    IconAd, 
    IconCalendar,
    IconCoin,
    IconRocket,
    IconSettings,
    IconChevronRight
} from "@tabler/icons-react";

type DraftRow = {
    id: string;
    status: string;
    version: number;
    payload_json: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    created_at: string;
    updated_at: string;
};

export default function DraftEditor({ initialDraft }: { initialDraft: DraftRow }) {
    const [draft] = useState<DraftRow>(initialDraft);
    const [payload, setPayload] = useState(() =>
        initialDraft.payload_json?.output ?? initialDraft.payload_json ?? {}
      );
          const [activeTab, setActiveTab] = useState<string | null>('campaign');
    const draftId = initialDraft.id;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const update = (path: string, value: any) => {
        const next = structuredClone(payload);
        const keys = path.split(".");
        let ref = next;
        while (keys.length > 1) ref = ref[keys.shift() as any]; // eslint-disable-line @typescript-eslint/no-explicit-any
        ref[keys[0]] = value;
        setPayload(next);
    };

    const saveEdits = async () => {
        await fetch(`/api/campaign/draft/${draftId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ payload, version: draft.version })
        });
    };

    const approve = async () => {
        await fetch(`/api/campaign/draft/${draftId}/approve`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ approved: true, payload })
        });
    };

    const deny = async () => {
        await fetch(`/api/campaign/draft/${draftId}/deny`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reason: "User declined" })
        });
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pending': return 'yellow';
            case 'approved': return 'green';
            case 'denied': return 'red';
            default: return 'gray';
        }
    };

    return (
        <Container size="lg" py="xl">
            <Stack gap="xl">
                {/* Header Card */}
                <Card withBorder p="xl" radius="md" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
                    <Group justify="space-between" mb="md">
                        <Box>
                            <Title order={2} c="white">🎯 Campaign Draft Review</Title>
                            <Text c="gray.2" size="sm">Draft ID: {draftId}</Text>
                        </Box>
                        <Group>
                            <Badge color={getStatusColor(draft.status)} variant="light" size="lg">
                                {draft.status.toUpperCase()}
                            </Badge>
                            <Badge variant="light" color="gray" size="lg">v{draft.version}</Badge>
                        </Group>
                    </Group>
                    
                    {/* Campaign Flow Visualization */}
                    <Paper withBorder p="md" radius="md" bg="white" mt="md">
                        <Timeline active={2} bulletSize={24} lineWidth={2}>
                            <Timeline.Item 
                                bullet={<IconTarget size={12} />} 
                                title="Campaign Setup"
                                c="blue"
                            >
                                <Text size="xs" c="dimmed">Define objectives & budget</Text>
                            </Timeline.Item>
                            <Timeline.Item 
                                bullet={<IconUsers size={12} />} 
                                title="Audience & Targeting"
                                c="teal"
                            >
                                <Text size="xs" c="dimmed">Set targeting parameters</Text>
                            </Timeline.Item>
                            <Timeline.Item 
                                bullet={<IconAd size={12} />} 
                                title="Creative Assets"
                                c="grape"
                            >
                                <Text size="xs" c="dimmed">Design & copy creation</Text>
                            </Timeline.Item>
                        </Timeline>
                    </Paper>
                </Card>

                {/* Main Content with Tabs */}
                <Card withBorder p="xl" radius="md">
                    <Tabs value={activeTab} onChange={setActiveTab} variant="pills">
                        <Tabs.List grow>
                            <Tabs.Tab 
                                value="campaign" 
                                leftSection={<IconRocket size={16} />}
                                style={{ fontWeight: 600 }}
                            >
                                🚀 Campaign
                            </Tabs.Tab>
                            <Tabs.Tab 
                                value="adset" 
                                leftSection={<IconUsers size={16} />}
                                style={{ fontWeight: 600 }}
                            >
                                👥 Ad Set
                            </Tabs.Tab>
                            <Tabs.Tab 
                                value="creative" 
                                leftSection={<IconAd size={16} />}
                                style={{ fontWeight: 600 }}
                            >
                                🎨 Creative
                            </Tabs.Tab>
                        </Tabs.List>

                        <Tabs.Panel value="campaign" pt="xl">
                            <Stack gap="lg">
                                {/* Campaign Overview Card */}
                                <Paper withBorder p="lg" radius="md" style={{ background: 'linear-gradient(145deg, #f8f9ff 0%, #e8f0ff 100%)' }}>
                                    <Group mb="md">
                                        <ThemeIcon size="lg" radius="md" variant="gradient" gradient={{ from: 'blue', to: 'cyan' }}>
                                            <IconTarget size={20} />
                                        </ThemeIcon>
                                        <Title order={3}>Campaign Configuration</Title>
                                    </Group>
                                    <Grid gutter="md">
                                        <Grid.Col span={12}>
                                            <TextInput
                                                label="🏷️ Campaign Name"
                                                value={payload.campaign?.campaignName || ''}
                                                onChange={(e) => update("campaign.campaignName", e.target.value)}
                                                size="md"
                                            />
                                        </Grid.Col>
                                        <Grid.Col span={6}>
                                            <Select
                                                label="🎯 Objective"
                                                value={payload.campaign?.objective || 'OUTCOME_LEADS'}
                                                onChange={(value) => update("campaign.objective", value)}
                                                data={[
                                                    { value: 'OUTCOME_LEADS', label: '📋 Leads' },
                                                    { value: 'OUTCOME_TRAFFIC', label: '🌐 Traffic' },
                                                    { value: 'OUTCOME_AWARENESS', label: '👁️ Awareness' }
                                                ]}
                                                size="md"
                                            />
                                        </Grid.Col>
                                        <Grid.Col span={6}>
                                            <Select
                                                label="⚡ Status"
                                                value={payload.campaign?.status || 'PAUSED'}
                                                onChange={(value) => update("campaign.status", value)}
                                                data={[
                                                    { value: 'PAUSED', label: '⏸️ Paused' },
                                                    { value: 'ACTIVE', label: '▶️ Active' }
                                                ]}
                                                size="md"
                                            />
                                        </Grid.Col>
                                    </Grid>
                                </Paper>

                                {/* Budget Card */}
                                <Paper withBorder p="lg" radius="md" style={{ background: 'linear-gradient(145deg, #fff8f0 0%, #ffe8cc 100%)' }}>
                                    <Group mb="md">
                                        <ThemeIcon size="lg" radius="md" variant="gradient" gradient={{ from: 'orange', to: 'yellow' }}>
                                            <IconCoin size={20} />
                                        </ThemeIcon>
                                        <Title order={3}>Budget & Spending</Title>
                                    </Group>
                                    <Grid gutter="md">
                                        <Grid.Col span={6}>
                                            <NumberInput
                                                label="💰 Budget Amount ($)"
                                                value={payload.budget?.amount || 0}
                                                onChange={(value) => update("budget.amount", Number(value))}
                                                min={1}
                                                size="md"
                                            />
                                        </Grid.Col>
                                        <Grid.Col span={6}>
                                            <Select
                                                label="📊 Budget Type"
                                                value={payload.budget?.type || 'daily'}
                                                onChange={(value) => update("budget.type", value)}
                                                data={[
                                                    { value: 'daily', label: '📅 Daily Budget' },
                                                    { value: 'lifetime', label: '♾️ Lifetime Budget' }
                                                ]}
                                                size="md"
                                            />
                                        </Grid.Col>
                                    </Grid>
                                </Paper>
                            </Stack>
                        </Tabs.Panel>

                        <Tabs.Panel value="adset" pt="xl">
                            <Paper withBorder p="lg" radius="md" style={{ background: 'linear-gradient(145deg, #f0fff8 0%, #ccffdd 100%)' }}>
                                <Group mb="md">
                                    <ThemeIcon size="lg" radius="md" variant="gradient" gradient={{ from: 'teal', to: 'green' }}>
                                        <IconUsers size={20} />
                                    </ThemeIcon>
                                    <Title order={3}>Audience & Targeting</Title>
                                </Group>
                                <Grid gutter="md">
                                    <Grid.Col span={12}>
                                        <TextInput
                                            label="📋 Ad Set Name"
                                            value={payload.adset?.name || ''}
                                            onChange={(e) => update("adset.name", e.target.value)}
                                            size="md"
                                        />
                                    </Grid.Col>
                                    <Grid.Col span={6}>
                                        <Select
                                            label="🎯 Optimization Goal"
                                            value={payload.adset?.optimization_goal || 'OUTCOME_LEADS'}
                                            onChange={(value) => update("adset.optimization_goal", value)}
                                            data={[
                                                { value: 'OUTCOME_LEADS', label: '📋 Leads' },
                                                { value: 'LINK_CLICKS', label: '🔗 Link Clicks' },
                                                { value: 'IMPRESSIONS', label: '👁️ Impressions' }
                                            ]}
                                            size="md"
                                        />
                                    </Grid.Col>
                                    <Grid.Col span={6}>
                                        <Select
                                            label="📍 Destination Type"
                                            value={payload.adset?.destination_type || 'ON_AD'}
                                            onChange={(value) => update("adset.destination_type", value)}
                                            data={[
                                                { value: 'ON_AD', label: '📝 Lead Form' },
                                                { value: 'MESSENGER', label: '💬 Messenger' },
                                                { value: 'PHONE_CALL', label: '📞 Phone Call' }
                                            ]}
                                            size="md"
                                        />
                                    </Grid.Col>
                                </Grid>
                            </Paper>
                        </Tabs.Panel>

                        <Tabs.Panel value="creative" pt="xl">
                            <Paper withBorder p="lg" radius="md" style={{ background: 'linear-gradient(145deg, #fff0f8 0%, #ffccee 100%)' }}>
                                <Group mb="md">
                                    <ThemeIcon size="lg" radius="md" variant="gradient" gradient={{ from: 'pink', to: 'grape' }}>
                                        <IconAd size={20} />
                                    </ThemeIcon>
                                    <Title order={3}>Creative Assets</Title>
                                </Group>
                                <Grid gutter="md">
                                    <Grid.Col span={6}>
                                        <TextInput
                                            label="📅 Start Date"
                                            value={payload.schedule?.startDate || ''}
                                            onChange={(e) => update("schedule.startDate", e.target.value)}
                                            placeholder="YYYY-MM-DDTHH:mm:ssZ"
                                            size="md"
                                        />
                                    </Grid.Col>
                                    <Grid.Col span={6}>
                                        <TextInput
                                            label="🏁 End Date"
                                            value={payload.schedule?.endDate || ''}
                                            onChange={(e) => update("schedule.endDate", e.target.value)}
                                            placeholder="YYYY-MM-DDTHH:mm:ssZ"
                                            size="md"
                                        />
                                    </Grid.Col>
                                </Grid>
                                <Box mt="md" p="md" style={{ border: '2px dashed #e0e0e0', borderRadius: '8px' }}>
                                    <Text ta="center" c="dimmed">🎨 Creative preview will appear here</Text>
                                    <Text ta="center" c="dimmed" size="sm">Creative ID: {initialDraft.payload_json?.creative_id || 'N/A'}</Text>
                                </Box>
                            </Paper>
                        </Tabs.Panel>
                    </Tabs>
                </Card>

                {/* Action Bar */}
                <Card withBorder p="lg" radius="md" style={{ background: 'linear-gradient(90deg, #f8f9fa 0%, #e9ecef 100%)' }}>
                    <Group justify="space-between">
                        <Group>
                            <Tooltip label="Save your changes">
                                <Button
                                    leftSection={<IconDeviceFloppy size={16} />}
                                    variant="outline"
                                    onClick={saveEdits}
                                    size="md"
                                >
                                    Save Changes
                                </Button>
                            </Tooltip>
                        </Group>
                        <Group>
                            <Tooltip label="Reject this campaign">
                                <Button
                                    leftSection={<IconX size={16} />}
                                    color="red"
                                    variant="light"
                                    onClick={deny}
                                    size="md"
                                >
                                    ❌ Deny
                                </Button>
                            </Tooltip>
                            <Tooltip label="Approve and launch campaign">
                                <Button
                                    leftSection={<IconCheck size={16} />}
                                    color="green"
                                    onClick={approve}
                                    size="md"
                                    style={{ boxShadow: '0 4px 14px 0 rgba(0, 118, 255, 0.39)' }}
                                >
                                    ✅ Approve & Launch
                                </Button>
                            </Tooltip>
                        </Group>
                    </Group>
                </Card>
            </Stack>
        </Container>
    );
}
