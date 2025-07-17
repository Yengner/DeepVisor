'use client';

import React, { useState, useEffect } from 'react';
import {
    Title,
    Text,
    Group,
    Card,
    SimpleGrid,
    Badge,
    Button,
    Image as MantineImage,
    ThemeIcon,
    Tabs,
    Paper,
    Divider,
    Accordion,
    Stack,
    Progress,
    Container,
    Modal,
    Tooltip,
    ActionIcon,
    Menu,
    LoadingOverlay
} from '@mantine/core';
import {
    IconBrandFacebook,
    IconBrandGoogle,
    IconBrandTiktok,
    IconCheck,
    IconLink,
    IconPlus,
    IconLock,
    IconX,
    IconBrandSnapchat,
    IconBrandLinkedin,
    IconBrandTwitter,
    IconChartBar,
    IconRefresh,
    IconTrash,
    IconSettings
} from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/utils/supabase/clients/browser';
import toast from 'react-hot-toast';

type Platform = {
    id: string;
    platform_name: string;
    description: string;
    full_description: string;
    strengths: string;
    weaknesses: string;
    image_url: string;
    isIntegrated: boolean;
};

type PlatformListProps = {
    platforms: Platform[];
    userId: string;
};

// Helper function to get platform icon
const getPlatformIcon = (platformId: string) => {
    switch (platformId.toLowerCase()) {
        case 'meta':
        case 'facebook':
            return <IconBrandFacebook size={24} stroke={1.5} />;
        case 'google':
            return <IconBrandGoogle size={24} stroke={1.5} />;
        case 'tiktok':
            return <IconBrandTiktok size={24} stroke={1.5} />;
        case 'snapchat':
            return <IconBrandSnapchat size={24} stroke={1.5} />;
        case 'linkedin':
            return <IconBrandLinkedin size={24} stroke={1.5} />;
        case 'twitter':
        case 'x':
            return <IconBrandTwitter size={24} stroke={1.5} />;
        default:
            return <IconChartBar size={24} stroke={1.5} />;
    }
};

const PlatformList: React.FC<PlatformListProps> = ({ platforms, userId }) => {
    const [detailsOpened, { open: openDetails, close: closeDetails }] = useDisclosure(false);
    const [connecting, setConnecting] = useState<string | null>(null);
    const [disconnecting, setDisconnecting] = useState<string | null>(null);
    const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        const success = searchParams.get('success');
        if (success === 'true') {
            toast.success('Platform connected successfully!');
            router.replace('/integration');
        }
    }, [searchParams, router]);

    const metaPlatform = platforms.find(p => p.id === 'meta') || platforms[0];

    const otherPlatforms = platforms.filter(p => p.id !== 'meta');

    const totalIntegrations = platforms.length;
    const activeIntegrations = platforms.filter(p => p.isIntegrated).length;
    const integrationPercentage = (activeIntegrations / totalIntegrations) * 100;

    const handleConnect = async (platform: string) => {
        setConnecting(platform);
        try {
            // Create URL with searchParams to ensure proper return path
            const returnPath = encodeURIComponent(`/integration`);

            // Redirect to the connection endpoint with return path
            window.location.href = `/api/integrations/connect/${platform}?return=${returnPath}`;
        } catch (error) {
            console.error(`Error connecting to ${platform}:`, error);
            toast.error(`Failed to connect to ${platform}. Please try again.`);
            setConnecting(null);
        }
    };

    const handleDisconnect = async (platform: string, integrationId?: string) => {
        if (!confirm('Are you sure you want to disconnect this platform? This will remove all associated data.')) {
            return;
        }

        setDisconnecting(platform);
        try {
            const supabase = createClient();

            // Delete platform integration from database
            const { error } = await supabase
                .from('platform_integrations')
                .delete()
                .eq('user_id', userId)
                .eq('platform_name', platform);

            if (error) {
                throw error;
            }

            // Refresh the page to update UI
            toast.success(`${platform} disconnected successfully`);
            window.location.reload();
        } catch (error) {
            console.error(`Error disconnecting ${platform}:`, error);
            toast.error(`Failed to disconnect ${platform}. Please try again.`);
        } finally {
            setDisconnecting(null);
        }
    };

    const handleRefreshConnections = async () => {
        setRefreshing(true);
        try {
            // API call to refresh connections
            await fetch('/api/integrations/refresh', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ userId })
            });

            toast.success('Connections refreshed successfully');
            // Reload the page to get updated data
            window.location.reload();
        } catch (error) {
            console.error('Error refreshing connections:', error);
            toast.error('Failed to refresh connections');
        } finally {
            setRefreshing(false);
        }
    };

    const handleViewDetails = (platform: Platform) => {
        setSelectedPlatform(platform);
        openDetails();
    };

    return (
        <Container size="xl" pos="relative">
            <LoadingOverlay visible={refreshing} zIndex={1000} overlayProps={{ radius: "sm", blur: 2 }} />

            {/* Stats Section */}
            <Paper withBorder radius="md" p="md" mb={30}>
                <Stack>
                    <Title order={4}>Platform Integrations</Title>
                    <Group justify="apart" align="center">
                        <div>
                            <Text size="sm" c="dimmed">Connected Platforms</Text>
                            <Text fw={700} size="xl">{activeIntegrations} of {totalIntegrations}</Text>
                        </div>

                        <div style={{ width: '70%' }}>
                            <Group justify="apart" mb={5}>
                                <Text size="xs" c="dimmed">Integration Progress</Text>
                                <Text size="xs" c="dimmed">{Math.round(integrationPercentage)}%</Text>
                            </Group>
                            <Progress
                                value={integrationPercentage}
                                size="md"
                                radius="xl"
                                color={integrationPercentage > 0 ? "blue" : "gray"}
                            />
                        </div>

                        <Button
                            leftSection={<IconRefresh size={16} />}
                            variant="subtle"
                            onClick={handleRefreshConnections}
                            loading={refreshing}
                        >
                            Refresh Connections
                        </Button>
                    </Group>
                </Stack>
            </Paper>

            {/* Featured Integration - Meta */}
            <Title order={3} mb="md">Featured Integration</Title>
            <Card withBorder radius="md" shadow="sm" mb={40}>
                <Group justify="apart" mb="lg">
                    <Group gap="xl">
                        <ThemeIcon size={70} variant="light" color="blue" radius="md">
                            <IconBrandFacebook size={40} stroke={1.5} />
                        </ThemeIcon>
                        <div>
                            <Title order={3}>{metaPlatform.platform_name}</Title>
                            <Text c="dimmed" size="sm">
                                Connect to Facebook Ads Manager to sync campaigns, ad sets, and performance data
                            </Text>
                        </div>
                    </Group>
                    <Badge
                        size="lg"
                        color={metaPlatform.isIntegrated ? "green" : "gray"}
                        variant="filled"
                        leftSection={metaPlatform.isIntegrated ?
                            <IconCheck size={14} /> :
                            <IconX size={14} />
                        }
                    >
                        {metaPlatform.isIntegrated ? "Connected" : "Not Connected"}
                    </Badge>
                </Group>

                <Tabs defaultValue="overview">
                    <Tabs.List mb="md">
                        <Tabs.Tab value="overview">Overview</Tabs.Tab>
                        <Tabs.Tab value="features">Features</Tabs.Tab>
                        <Tabs.Tab value="settings" disabled={!metaPlatform.isIntegrated}>Settings</Tabs.Tab>
                    </Tabs.List>

                    <Tabs.Panel value="overview">
                        <Grid>
                            <Grid.Col span={8}>
                                <Text mb="md">{metaPlatform.full_description || metaPlatform.description}</Text>

                                <Accordion variant="separated" mt="md">
                                    <Accordion.Item value="strengths">
                                        <Accordion.Control>
                                            <Text fw={500}>Strengths</Text>
                                        </Accordion.Control>
                                        <Accordion.Panel>
                                            <Text size="sm">{metaPlatform.strengths}</Text>
                                        </Accordion.Panel>
                                    </Accordion.Item>

                                    <Accordion.Item value="weaknesses">
                                        <Accordion.Control>
                                            <Text fw={500}>Limitations</Text>
                                        </Accordion.Control>
                                        <Accordion.Panel>
                                            <Text size="sm">{metaPlatform.weaknesses}</Text>
                                        </Accordion.Panel>
                                    </Accordion.Item>
                                </Accordion>
                            </Grid.Col>

                            <Grid.Col span={4}>
                                <Paper withBorder p="md" radius="md">
                                    <Title order={5} mb="md">Meta Integration</Title>

                                    {metaPlatform.isIntegrated ? (
                                        <>
                                            <Group>
                                                <ThemeIcon color="green" size="md" radius="xl">
                                                    <IconCheck size={16} />
                                                </ThemeIcon>
                                                <div>
                                                    <Text fw={500}>Connected</Text>
                                                    <Text size="xs" color="dimmed">Your Meta account is linked</Text>
                                                </div>
                                            </Group>

                                            <Divider my="md" />

                                            <Group justify="apart">
                                                <Text size="sm">Last synced</Text>
                                                <Text size="sm" c="dimmed">10 minutes ago</Text>
                                            </Group>

                                            <Group mt="md">
                                                <Button
                                                    leftSection={<IconRefresh size={16} />}
                                                    variant="light"
                                                    flex="1"
                                                >
                                                    Sync Data
                                                </Button>

                                                <Menu shadow="md">
                                                    <Menu.Target>
                                                        <ActionIcon variant="default">
                                                            <IconSettings size={16} />
                                                        </ActionIcon>
                                                    </Menu.Target>
                                                    <Menu.Dropdown>
                                                        <Menu.Label>Integration</Menu.Label>
                                                        <Menu.Item>
                                                            View Details
                                                        </Menu.Item>
                                                        <Menu.Divider />
                                                        <Menu.Label>Danger</Menu.Label>
                                                        <Menu.Item
                                                            color="red"
                                                            leftSection={<IconTrash size={14} />}
                                                            onClick={() => handleDisconnect('meta')}
                                                            disabled={disconnecting === 'meta'}
                                                        >
                                                            {disconnecting === 'meta' ? 'Disconnecting...' : 'Disconnect'}
                                                        </Menu.Item>
                                                    </Menu.Dropdown>
                                                </Menu>
                                            </Group>
                                        </>
                                    ) : (
                                        <Button
                                            fullWidth
                                            size="md"
                                            variant="filled"
                                            color="blue"
                                            leftSection={<IconPlus size={16} />}
                                            onClick={() => handleConnect('meta')}
                                            loading={connecting === 'meta'}
                                            mt="md"
                                        >
                                            Connect Meta Account
                                        </Button>
                                    )}
                                </Paper>
                            </Grid.Col>
                        </Grid>
                    </Tabs.Panel>

                    <Tabs.Panel value="features">
                        <SimpleGrid cols={2} spacing="md">
                            <FeatureCard
                                title="Automated Campaign Syncing"
                                description="Automatically sync all campaigns, ad sets, and ads with real-time performance data"
                                icon={<IconRefresh size={18} />}
                            />
                            <FeatureCard
                                title="Detailed Analytics"
                                description="Get comprehensive analytics on campaigns across demographics, placements, and objectives"
                                icon={<IconChartBar size={18} />}
                            />
                            <FeatureCard
                                title="Cross-Platform Insights"
                                description="Compare Facebook performance with other connected platforms for holistic marketing insights"
                                icon={<IconBrandFacebook size={18} />}
                            />
                            <FeatureCard
                                title="Customizable Reports"
                                description="Generate and schedule custom reports with the KPIs that matter most to your business"
                                icon={<IconChartBar size={18} />}
                            />
                        </SimpleGrid>
                    </Tabs.Panel>

                    <Tabs.Panel value="settings">
                        <Paper withBorder p="md" radius="md">
                            {metaPlatform.isIntegrated ? (
                                <Stack>
                                    <Group justify="apart">
                                        <Text fw={500}>Connection Status</Text>
                                        <Badge color="green">Active</Badge>
                                    </Group>
                                    <Group justify="apart">
                                        <Text fw={500}>Sync Frequency</Text>
                                        <Select
                                            defaultValue="1h"
                                            data={[
                                                { value: '30m', label: 'Every 30 minutes' },
                                                { value: '1h', label: 'Every hour' },
                                                { value: '3h', label: 'Every 3 hours' },
                                                { value: '1d', label: 'Daily' },
                                            ]}
                                            style={{ width: 200 }}
                                        />
                                    </Group>
                                    <Divider />
                                    <Button
                                        color="red"
                                        variant="light"
                                        leftSection={<IconX size={16} />}
                                    >
                                        Disconnect
                                    </Button>
                                </Stack>
                            ) : (
                                <Text>Connect Meta to access settings</Text>
                            )}
                        </Paper>
                    </Tabs.Panel>
                </Tabs>
            </Card>

            {/* Other Platforms */}
            <Group justify="apart" mb="md">
                <Title order={3}>Other Platforms</Title>
                <Button leftSection={<IconPlus size={16} />} variant="outline" size='compact-md'>
                    Request New Integration
                </Button>
            </Group>

            <SimpleGrid
                cols={{ base: 3, md: 2, sm: 1 }}
                spacing="lg"
            >
                {otherPlatforms.map((platform) => (
                    <Card key={platform.id} withBorder radius="md" p="md">
                        <Card.Section p="md" mb="md">
                            <Group justify="apart">
                                <Group>
                                    <ThemeIcon size="lg" radius="md" color="blue" variant="light">
                                        {getPlatformIcon(platform.id)}
                                    </ThemeIcon>
                                    <Text fw={500}>{platform.platform_name}</Text>
                                </Group>
                                <Badge
                                    color={platform.isIntegrated ? "green" : "gray"}
                                    variant={platform.isIntegrated ? "filled" : "outline"}
                                >
                                    {platform.isIntegrated ? "Connected" : "Not Connected"}
                                </Badge>
                            </Group>
                        </Card.Section>

                        <Text size="sm" lineClamp={3} mb="md">
                            {platform.description}
                        </Text>

                        <Card.Section p="md">
                            <Group justify="apart">
                                <Button
                                    variant="light"
                                    size='compact-md'
                                    onClick={() => handleViewDetails(platform)}
                                >
                                    View Details
                                </Button>
                                {platform.id !== 'meta' && (
                                    <>
                                        {platform.id === 'google' ? (
                                            <Button
                                                leftSection={<IconLink size={16} />}
                                                variant="filled"
                                                size='compact-md'
                                            >
                                                Connect
                                            </Button>
                                        ) : (
                                            <Tooltip label="Coming soon">
                                                <Button
                                                    leftSection={<IconLock size={16} />}
                                                    variant="subtle"
                                                    size='compact-md'
                                                    disabled
                                                >
                                                    Coming Soon
                                                </Button>
                                            </Tooltip>
                                        )}
                                    </>
                                )}
                            </Group>
                        </Card.Section>
                    </Card>
                ))}
            </SimpleGrid>

            {/* Platform Details Modal */}
            <Modal
                opened={detailsOpened}
                onClose={closeDetails}
                size="lg"
                title={
                    <Group>
                        {selectedPlatform && (
                            <>
                                <ThemeIcon size="md" radius="md" color="blue" variant="light">
                                    {getPlatformIcon(selectedPlatform.id)}
                                </ThemeIcon>
                                <Text fw={700}>{selectedPlatform?.platform_name} Integration</Text>
                            </>
                        )}
                    </Group>
                }
            >
                {selectedPlatform && (
                    <Stack>
                        <MantineImage
                            src={selectedPlatform.image_url}
                            alt={selectedPlatform.platform_name}
                            width={100}
                            height={100}
                            fit="contain"
                        />
                        <Text>{selectedPlatform.full_description || selectedPlatform.description}</Text>

                        <Title order={5}>Strengths</Title>
                        <Text size="sm">{selectedPlatform.strengths}</Text>

                        <Title order={5}>Limitations</Title>
                        <Text size="sm">{selectedPlatform.weaknesses}</Text>

                        <Divider my="sm" />

                        <Group justify="apart">
                            {selectedPlatform.id === 'meta' ? (
                                selectedPlatform.isIntegrated ? (
                                    <Button
                                        color="red"
                                        variant="outline"
                                        leftSection={<IconTrash size={14} />}
                                        onClick={() => handleDisconnect('meta')}
                                        loading={disconnecting === 'meta'}
                                    >
                                        Disconnect {selectedPlatform.platform_name}
                                    </Button>
                                ) : (
                                    <Button
                                        color="blue"
                                        leftSection={<IconLink size={16} />}
                                        onClick={() => handleConnect('meta')}
                                        loading={connecting === 'meta'}
                                    >
                                        Connect {selectedPlatform.platform_name}
                                    </Button>
                                )
                            ) : selectedPlatform.id === 'google' ? (
                                <Button leftSection={<IconLink size={16} />}>Connect Google Ads</Button>
                            ) : (
                                <Button
                                    leftSection={<IconLock size={16} />}
                                    variant="subtle"
                                    disabled
                                >
                                    Coming Soon
                                </Button>
                            )}

                            <Button variant="subtle" onClick={closeDetails}>Close</Button>
                        </Group>
                    </Stack>
                )}
            </Modal>
        </Container>
    );
};

// Feature Card component for the features tab
interface FeatureCardProps {
    title: string;
    description: string;
    icon: React.ReactNode;
}

const FeatureCard: React.FC<FeatureCardProps> = ({ title, description, icon }) => (
    <Paper withBorder p="md" radius="md">
        <Group justify="apart" mb="xs">
            <Text fw={500}>{title}</Text>
            <ThemeIcon size="sm" variant="light" color="blue" radius="xl">
                {icon}
            </ThemeIcon>
        </Group>
        <Text size="sm" c="dimmed">{description}</Text>
    </Paper>
);

// Grid component for layout
const Grid = ({ children }: { children: React.ReactNode }) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', margin: '-8px' }}>
        {children}
    </div>
);

// Create the Col component with proper display name
const GridCol: React.FC<{ span: number; children: React.ReactNode }> = ({ span, children }) => (
    <div style={{ flex: `0 0 ${(span / 12) * 100}%`, padding: '8px' }}>
        {children}
    </div>
);

// Assign it as a property and set the display name
Grid.Col = GridCol;
GridCol.displayName = 'Grid.Col'; // This fixes the ESLint error

// Define types for Select component
interface SelectOption {
    value: string;
    label: string;
}

interface SelectProps {
    data: SelectOption[];
    defaultValue: string;
    style?: React.CSSProperties;
}

const Select = ({ data, defaultValue, style }: SelectProps) => (
    <select
        defaultValue={defaultValue}
        style={{
            ...style,
            padding: '8px 12px',
            borderRadius: '4px',
            border: '1px solid #ced4da'
        }}
    >
        {data.map(option => (
            <option key={option.value} value={option.value}>
                {option.label}
            </option>
        ))}
    </select>
);

export default PlatformList;
