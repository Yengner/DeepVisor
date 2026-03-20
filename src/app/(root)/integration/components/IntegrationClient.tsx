'use client';

import React, { useEffect, useState } from 'react';
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
  Grid,
  Tabs,
  Paper,
  Divider,
  Accordion,
  Stack,
  Progress,
  Select,
  Container,
  Modal,
  Tooltip,
  ActionIcon,
  Menu,
  LoadingOverlay,
} from '@mantine/core';
import {
  IconBrandFacebook,
  IconCheck,
  IconLink,
  IconPlus,
  IconLock,
  IconX,
  IconChartBar,
  IconRefresh,
  IconTrash,
  IconSettings,
} from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { getPlatformIcon } from '@/components/utils/utils';
import type { IntegrationStatus } from '@/lib/shared/types/integrations';

type Platform = {
  id: string;
  platformKey: string;
  platformName: string;
  description: string;
  fullDescription: string;
  strengths: string;
  weaknesses: string;
  imageUrl: string;
  status: IntegrationStatus;
  integrationId: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
  connectedAt: string | null;
  disconnectedAt: string | null;
};

type PlatformListProps = {
  platforms: Platform[];
};

function formatDate(value: string | null): string {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleString();
}

function isConnected(status: IntegrationStatus): boolean {
  return status === 'connected';
}

function getStatusColor(status: IntegrationStatus): 'green' | 'gray' | 'red' | 'yellow' {
  if (status === 'connected') return 'green';
  if (status === 'needs_reauth') return 'yellow';
  if (status === 'error') return 'red';
  return 'gray';
}

function getStatusLabel(status: IntegrationStatus): string {
  if (status === 'connected') return 'Connected';
  if (status === 'needs_reauth') return 'Needs Reauth';
  if (status === 'error') return 'Error';
  return 'Not Connected';
}

const PlatformList: React.FC<PlatformListProps> = ({ platforms }) => {
  const [detailsOpened, { open: openDetails, close: closeDetails }] = useDisclosure(false);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const integration = searchParams.get('integration');
    const status = searchParams.get('status');

    if (!integration || !status) return;

    if (status === 'connected') {
      toast.success(`${integration} connected successfully.`);
    } else if (status === 'error') {
      toast.error(`Failed to connect ${integration}. Please try again.`);
    }

    router.replace('/integration');
  }, [searchParams, router]);

  const metaPlatform = platforms.find((platform) => platform.platformKey === 'meta') || platforms[0];
  const otherPlatforms = platforms.filter((platform) => platform.platformKey !== 'meta');

  const totalIntegrations = platforms.length;
  const activeIntegrations = platforms.filter((platform) => isConnected(platform.status)).length;
  const availableIntegrations = totalIntegrations - activeIntegrations;
  const integrationPercentage = totalIntegrations > 0 ? (activeIntegrations / totalIntegrations) * 100 : 0;

  const handleConnect = async (platformKey: string) => {
    setConnecting(platformKey);
    try {
      const returnTo = encodeURIComponent('/integration');
      window.location.href = `/api/integrations/connect/${platformKey}?returnTo=${returnTo}`;
    } catch (error) {
      console.error(`Error connecting to ${platformKey}:`, error);
      toast.error(`Failed to connect to ${platformKey}. Please try again.`);
      setConnecting(null);
    }
  };

  const handleDisconnect = async (platform: Platform) => {
    if (!confirm('Are you sure you want to disconnect this platform?')) {
      return;
    }

    if (!platform.integrationId) {
      toast.error('No integration found for this platform.');
      return;
    }

    setDisconnecting(platform.platformKey);
    try {
      const response = await fetch('/api/integrations/disconnect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ integrationId: platform.integrationId }),
      });

      if (!response.ok) {
        throw new Error('Failed to disconnect integration');
      }

      toast.success(`${platform.platformName} disconnected successfully.`);
      router.refresh();
    } catch (error) {
      console.error(`Error disconnecting ${platform.platformName}:`, error);
      toast.error(`Failed to disconnect ${platform.platformName}. Please try again.`);
    } finally {
      setDisconnecting(null);
    }
  };

  const handleRefreshConnections = async () => {
    setRefreshing(true);
    try {
      const response = await fetch('/api/integrations/refresh', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to refresh integrations');
      }

      toast.success('Connections refreshed successfully.');
      router.refresh();
    } catch (error) {
      console.error('Error refreshing connections:', error);
      toast.error('Failed to refresh connections.');
    } finally {
      setRefreshing(false);
    }
  };

  const handleViewDetails = (platform: Platform) => {
    setSelectedPlatform(platform);
    openDetails();
  };

  return (
    <Container size="xl" pos="relative" pb="xl">
      <LoadingOverlay visible={refreshing} zIndex={1000} overlayProps={{ radius: 'sm', blur: 2 }} />

      <Stack gap="xl">
        <Group justify="apart" align="flex-start">
          <Stack gap={6}>
            <Title order={2}>Integrations</Title>
            <Text size="sm" c="dimmed">
              Connect your ad platforms to sync performance data, unlock automation, and keep reporting consistent.
            </Text>
          </Stack>
          <Group>
            <Button
              leftSection={<IconRefresh size={16} />}
              variant="subtle"
              onClick={handleRefreshConnections}
              loading={refreshing}
            >
              Refresh Connections
            </Button>
            <Button leftSection={<IconPlus size={16} />} variant="outline">
              Request New Integration
            </Button>
          </Group>
        </Group>

        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
          <Paper withBorder radius="md" p="md">
            <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
              Connected
            </Text>
            <Group justify="apart" align="flex-end" mt="xs">
              <Title order={3}>{activeIntegrations}</Title>
              <Text size="sm" c="dimmed">
                of {totalIntegrations}
              </Text>
            </Group>
            <Text size="xs" c="dimmed">
              Platforms currently synced
            </Text>
          </Paper>

          <Paper withBorder radius="md" p="md">
            <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
              Available
            </Text>
            <Group justify="apart" align="flex-end" mt="xs">
              <Title order={3}>{availableIntegrations}</Title>
              <Text size="sm" c="dimmed">
                platforms
              </Text>
            </Group>
            <Text size="xs" c="dimmed">
              Ready to connect when you are
            </Text>
          </Paper>

          <Paper withBorder radius="md" p="md">
            <Group justify="apart" align="center" mb="xs">
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                Integration progress
              </Text>
              <Badge size="sm" color={integrationPercentage > 0 ? 'blue' : 'gray'} variant="light">
                {Math.round(integrationPercentage)}%
              </Badge>
            </Group>
            <Progress
              value={integrationPercentage}
              size="md"
              radius="xl"
              color={integrationPercentage > 0 ? 'blue' : 'gray'}
            />
            <Text size="xs" c="dimmed" mt="xs">
              Add platforms to unlock more insights
            </Text>
          </Paper>
        </SimpleGrid>

        {metaPlatform && (
          <div>
            <Title order={3} mb="md">
              Featured Integration
            </Title>
            <Card withBorder radius="md" shadow="sm">
              <Group justify="apart" mb="lg">
                <Group gap="xl">
                  <ThemeIcon size={70} variant="light" color="blue" radius="md">
                    <IconBrandFacebook size={40} stroke={1.5} />
                  </ThemeIcon>
                  <div>
                    <Title order={3}>{metaPlatform.platformName}</Title>
                    <Text c="dimmed" size="sm">
                      Connect to Facebook Ads Manager to sync campaigns, ad sets, and performance data.
                    </Text>
                  </div>
                </Group>
                <Badge
                  size="lg"
                  color={getStatusColor(metaPlatform.status)}
                  variant={metaPlatform.status === 'disconnected' ? 'outline' : 'filled'}
                  leftSection={isConnected(metaPlatform.status) ? <IconCheck size={14} /> : <IconX size={14} />}
                >
                  {getStatusLabel(metaPlatform.status)}
                </Badge>
              </Group>

              <Tabs defaultValue="overview">
                <Tabs.List mb="md">
                  <Tabs.Tab value="overview">Overview</Tabs.Tab>
                  <Tabs.Tab value="features">Features</Tabs.Tab>
                  <Tabs.Tab value="settings" disabled={!isConnected(metaPlatform.status)}>
                    Settings
                  </Tabs.Tab>
                </Tabs.List>

                <Tabs.Panel value="overview">
                  <Grid>
                    <Grid.Col span={{ base: 12, md: 8 }}>
                      <Text mb="md">{metaPlatform.fullDescription || metaPlatform.description}</Text>

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

                    <Grid.Col span={{ base: 12, md: 4 }}>
                      <Paper withBorder p="md" radius="md">
                        <Title order={5} mb="md">
                          Meta Integration
                        </Title>

                        {isConnected(metaPlatform.status) ? (
                          <>
                            <Group>
                              <ThemeIcon color="green" size="md" radius="xl">
                                <IconCheck size={16} />
                              </ThemeIcon>
                              <div>
                                <Text fw={500}>Connected</Text>
                                <Text size="xs" c="dimmed">
                                  Your Meta account is linked
                                </Text>
                              </div>
                            </Group>

                            <Divider my="md" />

                            <Group justify="apart">
                              <Text size="sm">Last synced</Text>
                              <Text size="sm" c="dimmed">
                                {formatDate(metaPlatform.lastSyncedAt)}
                              </Text>
                            </Group>

                            {metaPlatform.lastError && (
                              <Text size="xs" c="red" mt="sm">
                                {metaPlatform.lastError}
                              </Text>
                            )}

                            <Group mt="md">
                              <Button
                                leftSection={<IconRefresh size={16} />}
                                variant="light"
                                flex="1"
                                onClick={handleRefreshConnections}
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
                                  <Menu.Item onClick={() => handleViewDetails(metaPlatform)}>View Details</Menu.Item>
                                  <Menu.Divider />
                                  <Menu.Label>Danger</Menu.Label>
                                  <Menu.Item
                                    color="red"
                                    leftSection={<IconTrash size={14} />}
                                    onClick={() => handleDisconnect(metaPlatform)}
                                    disabled={disconnecting === 'meta'}
                                  >
                                    {disconnecting === 'meta' ? 'Disconnecting...' : 'Disconnect'}
                                  </Menu.Item>
                                </Menu.Dropdown>
                              </Menu>
                            </Group>
                          </>
                        ) : (
                          <>
                            {metaPlatform.status === 'error' && metaPlatform.lastError ? (
                              <Text size="xs" c="red" mb="sm">
                                {metaPlatform.lastError}
                              </Text>
                            ) : null}
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
                          </>
                        )}
                      </Paper>
                    </Grid.Col>
                  </Grid>
                </Tabs.Panel>

                <Tabs.Panel value="features">
                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                    <FeatureCard
                      title="Automated Campaign Syncing"
                      description="Automatically sync all campaigns, ad sets, and ads with real-time performance data."
                      icon={<IconRefresh size={18} />}
                    />
                    <FeatureCard
                      title="Detailed Analytics"
                      description="Get comprehensive analytics on campaigns across demographics, placements, and objectives."
                      icon={<IconChartBar size={18} />}
                    />
                    <FeatureCard
                      title="Cross-Platform Insights"
                      description="Compare Facebook performance with other connected platforms for holistic marketing insights."
                      icon={<IconBrandFacebook size={18} />}
                    />
                    <FeatureCard
                      title="Customizable Reports"
                      description="Generate and schedule custom reports with the KPIs that matter most to your business."
                      icon={<IconChartBar size={18} />}
                    />
                  </SimpleGrid>
                </Tabs.Panel>

                <Tabs.Panel value="settings">
                  <Paper withBorder p="md" radius="md">
                    {isConnected(metaPlatform.status) ? (
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
                            w={200}
                          />
                        </Group>
                        <Divider />
                        <Button
                          color="red"
                          variant="light"
                          leftSection={<IconX size={16} />}
                          onClick={() => handleDisconnect(metaPlatform)}
                          disabled={disconnecting === 'meta'}
                        >
                          Disconnect
                        </Button>
                      </Stack>
                    ) : (
                      <Text>
                        {metaPlatform.status === 'error' || metaPlatform.status === 'needs_reauth'
                          ? 'Meta connection needs attention. Reconnect to restore sync.'
                          : 'Connect Meta to access settings'}
                      </Text>
                    )}
                  </Paper>
                </Tabs.Panel>
              </Tabs>
            </Card>
          </div>
        )}

        <div>
          <Group justify="apart" mb="md">
            <Title order={3}>Other Platforms</Title>
            <Text size="sm" c="dimmed">
              Additional channels ready for connection
            </Text>
          </Group>

          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
            {otherPlatforms.map((platform) => (
              <Card key={platform.id} withBorder radius="md" p="md">
                <Card.Section p="md" mb="md">
                  <Group justify="apart">
                    <Group>
                      <ThemeIcon size="lg" radius="md" color="blue" variant="light">
                        {getPlatformIcon(platform.platformKey, 24, 1.5)}
                      </ThemeIcon>
                      <Text fw={500}>{platform.platformName}</Text>
                    </Group>
                    <Badge
                      color={getStatusColor(platform.status)}
                      variant={platform.status === 'disconnected' ? 'outline' : 'filled'}
                    >
                      {getStatusLabel(platform.status)}
                    </Badge>
                  </Group>
                </Card.Section>

                <Text size="sm" lineClamp={3} mb="md">
                  {platform.description}
                </Text>

                <Card.Section p="md">
                  <Group justify="apart">
                    <Button variant="light" size="compact-md" onClick={() => handleViewDetails(platform)}>
                      View Details
                    </Button>
                    <Tooltip label="Coming soon">
                      <Button leftSection={<IconLock size={16} />} variant="subtle" size="compact-md" disabled>
                        Coming Soon
                      </Button>
                    </Tooltip>
                  </Group>
                </Card.Section>
              </Card>
            ))}
          </SimpleGrid>
        </div>

        <Modal
          opened={detailsOpened}
          onClose={closeDetails}
          size="lg"
          title={
            <Group>
              {selectedPlatform && (
                <>
                  <ThemeIcon size="md" radius="md" color="blue" variant="light">
                    {getPlatformIcon(selectedPlatform.platformKey, 24, 1.5)}
                  </ThemeIcon>
                  <Text fw={700}>{selectedPlatform.platformName} Integration</Text>
                </>
              )}
            </Group>
          }
        >
          {selectedPlatform && (
            <Stack>
              <MantineImage
                src={selectedPlatform.imageUrl}
                alt={selectedPlatform.platformName}
                width={100}
                height={100}
                fit="contain"
              />
              <Text>{selectedPlatform.fullDescription || selectedPlatform.description}</Text>

              <Title order={5}>Strengths</Title>
              <Text size="sm">{selectedPlatform.strengths}</Text>

              <Title order={5}>Limitations</Title>
              <Text size="sm">{selectedPlatform.weaknesses}</Text>

              <Divider my="sm" />

              <Group justify="apart">
                {selectedPlatform.platformKey === 'meta' ? (
                  isConnected(selectedPlatform.status) ? (
                    <Button
                      color="red"
                      variant="outline"
                      leftSection={<IconTrash size={14} />}
                      onClick={() => handleDisconnect(selectedPlatform)}
                      loading={disconnecting === 'meta'}
                    >
                      Disconnect {selectedPlatform.platformName}
                    </Button>
                  ) : (
                    <Button
                      color="blue"
                      leftSection={<IconLink size={16} />}
                      onClick={() => handleConnect('meta')}
                      loading={connecting === 'meta'}
                    >
                      Connect {selectedPlatform.platformName}
                    </Button>
                  )
                ) : (
                  <Button leftSection={<IconLock size={16} />} variant="subtle" disabled>
                    Coming Soon
                  </Button>
                )}

                <Button variant="subtle" onClick={closeDetails}>
                  Close
                </Button>
              </Group>
            </Stack>
          )}
        </Modal>
      </Stack>
    </Container>
  );
};

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
    <Text size="sm" c="dimmed">
      {description}
    </Text>
  </Paper>
);

export default PlatformList;
