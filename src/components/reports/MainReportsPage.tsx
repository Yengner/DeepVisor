"use client";

import { useState } from "react";
import {
  AppShell,
  Title,
  Text,
  Group,
  Stack,
  Card,
  Tabs,
  Badge,
  Button,
  ThemeIcon,
  ActionIcon,
  SegmentedControl,
  Select,
  RingProgress,
  Paper,
  Grid,
  Avatar,
  Progress,
  Accordion,
  Divider,
  Menu,
  Container
} from "@mantine/core";
import { DatePickerInput } from '@mantine/dates';
import {
  IconChartBar,
  IconChartPie,
  IconAdjustments,
  IconDownload,
  IconFilter,
  IconRefresh,
  IconDots,
  IconTrendingUp,
  IconTrendingDown,
  IconCalendar,
  IconChevronDown,
  IconChevronRight,
  IconBrandFacebook,
  IconBrandGoogle,
  IconBrandInstagram,
  IconBrandTiktok,
  IconLayoutGrid,
  IconLayoutList,
  IconExclamationCircle,
  IconCheck,
  IconAd,
  IconUsersGroup,
  IconEye,
  IconClick
} from "@tabler/icons-react";
import {
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart
} from 'recharts';

interface MainReportProps {
  metrics: {
    topAdAccounts: any[];
    topCampaigns_metrics: any[];
    topAdset_metrics: any[];
    topAd_metrics: any[];
  };
}

export default function MainReport({ metrics }: MainReportProps) {
  // State management
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    new Date()
  ]);
  const [activeTab, setActiveTab] = useState<string | null>("overview");
  const [viewMode, setViewMode] = useState<string>("grid");
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set());
  const [expandedAdSets, setExpandedAdSets] = useState<Set<string>>(new Set());

  // Toggle campaign expansion
  const toggleCampaign = (id: string) => {
    setExpandedCampaigns(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // Toggle ad set expansion
  const toggleAdSet = (id: string) => {
    setExpandedAdSets(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // Sample data for charts
  const chartData = Array(14).fill(0).map((_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (13 - index));
    
    return {
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      spend: Math.floor(Math.random() * 500) + 100,
      impressions: Math.floor(Math.random() * 10000) + 1000,
      clicks: Math.floor(Math.random() * 800) + 200,
    };
  });

  // Sample campaign data
  const campaignData = [
    {
      id: 'c1',
      name: 'Summer Sale 2025',
      status: 'ACTIVE',
      objective: 'CONVERSIONS',
      spend: 4580.25,
      impressions: 245890,
      clicks: 12450,
      ctr: 5.06,
      performance: 12,
      performanceDirection: 'up'
    },
    {
      id: 'c2',
      name: 'Product Launch Campaign',
      status: 'ACTIVE',
      objective: 'BRAND_AWARENESS',
      spend: 3250.80,
      impressions: 350780,
      clicks: 8960,
      ctr: 2.55,
      performance: 8,
      performanceDirection: 'up'
    },
    {
      id: 'c3',
      name: 'Holiday Promotion',
      status: 'PAUSED',
      objective: 'TRAFFIC',
      spend: 1876.40,
      impressions: 125670,
      clicks: 4532,
      ctr: 3.61,
      performance: -5,
      performanceDirection: 'down'
    },
    {
      id: 'c4',
      name: 'Lead Generation',
      status: 'ACTIVE',
      objective: 'LEAD_GENERATION',
      spend: 2980.15,
      impressions: 198540,
      clicks: 7650,
      ctr: 3.85,
      performance: 15,
      performanceDirection: 'up'
    },
    {
      id: 'c5',
      name: 'Retargeting Campaign',
      status: 'ACTIVE',
      objective: 'CONVERSIONS',
      spend: 1450.30,
      impressions: 98760,
      clicks: 5430,
      ctr: 5.50,
      performance: -2,
      performanceDirection: 'down'
    }
  ];

  // Sample ad sets data
  const adSetsData = [
    { id: 'as1', campaign_id: 'c1', name: 'US Mobile Users', spend: 2580.25, impressions: 145890, clicks: 8450 },
    { id: 'as2', campaign_id: 'c1', name: 'EU Desktop Users', spend: 2000.00, impressions: 100000, clicks: 4000 },
    { id: 'as3', campaign_id: 'c2', name: 'Young Adults 18-24', spend: 1250.80, impressions: 150780, clicks: 3960 },
    { id: 'as4', campaign_id: 'c2', name: 'Adults 25-34', spend: 2000.00, impressions: 200000, clicks: 5000 },
    { id: 'as5', campaign_id: 'c3', name: 'Holiday Shoppers', spend: 1876.40, impressions: 125670, clicks: 4532 },
    { id: 'as6', campaign_id: 'c4', name: 'Business Decision Makers', spend: 1480.15, impressions: 98540, clicks: 3650 },
    { id: 'as7', campaign_id: 'c4', name: 'Small Business Owners', spend: 1500.00, impressions: 100000, clicks: 4000 },
    { id: 'as8', campaign_id: 'c5', name: 'Website Visitors', spend: 1450.30, impressions: 98760, clicks: 5430 },
  ];

  // Sample ads data
  const adsData = [
    { id: 'a1', adset_id: 'as1', name: 'Summer Sale Banner', spend: 1280.25, impressions: 72945, clicks: 4225 },
    { id: 'a2', adset_id: 'as1', name: 'Summer Sale Video', spend: 1300.00, impressions: 72945, clicks: 4225 },
    { id: 'a3', adset_id: 'as2', name: 'EU Desktop Banner', spend: 2000.00, impressions: 100000, clicks: 4000 },
    { id: 'a4', adset_id: 'as3', name: 'Product Launch Video', spend: 1250.80, impressions: 150780, clicks: 3960 },
  ];

  // Calculate summary metrics
  const totalSpend = campaignData.reduce((sum, campaign) => sum + campaign.spend, 0);
  const totalImpressions = campaignData.reduce((sum, campaign) => sum + campaign.impressions, 0);
  const totalClicks = campaignData.reduce((sum, campaign) => sum + campaign.clicks, 0);
  const avgCTR = totalImpressions ? (totalClicks / totalImpressions) * 100 : 0;

  // Prepare summary stats
  const summaryStats = [
    { title: 'Total Spend', value: `$${totalSpend.toLocaleString()}`, diff: 12, icon: 'up' },
    { title: 'Impressions', value: totalImpressions.toLocaleString(), diff: 8, icon: 'up' },
    { title: 'Clicks', value: totalClicks.toLocaleString(), diff: 5, icon: 'up' },
    { title: 'Average CTR', value: `${avgCTR.toFixed(2)}%`, diff: -2, icon: 'down' },
  ];

  // Status badge color helper
  const getStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'ACTIVE': return 'green';
      case 'PAUSED': return 'yellow';
      case 'ARCHIVED': return 'gray';
      case 'DELETED': return 'red';
      default: return 'gray';
    }
  };

  return (
    <Container size="xl" py="xl">
      {/* Header with date range selector */}
      <Card withBorder p="lg" radius="md" mb="md">
        <Group justify="space-between" mb="sm">
          <div>
            <Title order={2} mb="xs">Campaign Reports</Title>
            <Text size="sm" c="dimmed">Comprehensive view of your advertising performance</Text>
          </div>
          
          <Group>
            <DatePickerInput
              type="range"
              label="Date Range"
              placeholder="Select date range"
              value={dateRange}
              onChange={setDateRange}
              clearable={false}
              maw={400}
              leftSection={<IconCalendar size="1.1rem" stroke={1.5} />}
              size="md"
            />
            
            <Menu position="bottom-end" shadow="md">
              <Menu.Target>
                <ActionIcon variant="default" size="lg" aria-label="Export">
                  <IconDownload stroke={1.5} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>Export Report</Menu.Label>
                <Menu.Item leftSection={<IconDownload size={14} />}>
                  Export as PDF
                </Menu.Item>
                <Menu.Item leftSection={<IconDownload size={14} />}>
                  Export as CSV
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
            
            <ActionIcon variant="default" size="lg" aria-label="Refresh data">
              <IconRefresh stroke={1.5} />
            </ActionIcon>
          </Group>
        </Group>
      </Card>
      
      {/* Summary stats */}
      <Grid gutter="md" mb="md">
        {summaryStats.map((stat) => {
          const DiffIcon = stat.icon === 'up' ? IconTrendingUp : IconTrendingDown;
          
          return (
            <Grid.Col span={{ base: 12, xs: 6, md: 3 }} key={stat.title}>
              <Card p="md" radius="md" withBorder>
                <Group justify="apart">
                  <div>
                    <Text c="dimmed" size="xs" fw={500} tt="uppercase">
                      {stat.title}
                    </Text>
                    <Text size="xl" fw={700}>
                      {stat.value}
                    </Text>
                  </div>
                  <ThemeIcon 
                    color={stat.icon === 'up' ? 'teal' : 'red'}
                    variant="light" 
                    size="xl" 
                    radius="xl"
                  >
                    <DiffIcon size="1.4rem" stroke={1.5} />
                  </ThemeIcon>
                </Group>
                <Group gap={5} mt="md">
                  <Text c={stat.icon === 'up' ? 'teal' : 'red'} size="sm" fw={500}>
                    {stat.icon === 'up' ? '+' : ''}{stat.diff}%
                  </Text>
                  <Text size="xs" c="dimmed">vs. previous period</Text>
                </Group>
              </Card>
            </Grid.Col>
          );
        })}
      </Grid>

      {/* Main content area with tabs */}
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Card p="md" radius="md" withBorder>
          <Card.Section withBorder inheritPadding py="md">
            <Group justify="space-between">
              <Tabs.List>
                <Tabs.Tab
                  value="overview"
                  leftSection={<IconChartBar size={16} />}
                >
                  Overview
                </Tabs.Tab>
                <Tabs.Tab
                  value="campaigns"
                  leftSection={<IconChartPie size={16} />}
                >
                  Campaigns
                </Tabs.Tab>
                <Tabs.Tab
                  value="platforms"
                  leftSection={<IconBrandFacebook size={16} />}
                >
                  Platforms
                </Tabs.Tab>
                <Tabs.Tab
                  value="insights"
                  leftSection={<IconTrendingUp size={16} />}
                >
                  Insights
                </Tabs.Tab>
              </Tabs.List>
              
              <Group>
                <SegmentedControl
                  size="xs"
                  value={viewMode}
                  onChange={setViewMode}
                  data={[
                    {
                      value: 'grid',
                      label: (
                        <Center>
                          <IconLayoutGrid size={16} stroke={1.5} />
                          <Box ml={8}>Grid</Box>
                        </Center>
                      ),
                    },
                    {
                      value: 'list',
                      label: (
                        <Center>
                          <IconLayoutList size={16} stroke={1.5} />
                          <Box ml={8}>List</Box>
                        </Center>
                      ),
                    },
                  ]}
                />
                
                <Menu position="bottom-end" shadow="md">
                  <Menu.Target>
                    <Button 
                      variant="light" 
                      size="xs"
                      leftSection={<IconFilter size={16} />}
                      color="blue"
                    >
                      Filters
                    </Button>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Label>Filter Campaigns</Menu.Label>
                    <Menu.Item>
                      Status: Active
                    </Menu.Item>
                    <Menu.Item>
                      Platform: All
                    </Menu.Item>
                    <Menu.Item>
                      Performance: All
                    </Menu.Item>
                    <Menu.Divider />
                    <Menu.Item color="blue">
                      Apply Filters
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              </Group>
            </Group>
          </Card.Section>
          
          {/* Tab content */}
          <Tabs.Panel value="overview" pt="md">
            <Grid gutter="md">
              {/* Campaign Performance Chart */}
              <Grid.Col span={{ base: 12, md: 8 }}>
                <Card withBorder shadow="sm" radius="md">
                  <Card.Section withBorder inheritPadding py="md">
                    <Group justify="space-between">
                      <div>
                        <Text fw={500}>Campaign Performance</Text>
                        <Text size="xs" c="dimmed">Performance over time</Text>
                      </div>
                      <Select
                        size="xs"
                        w={150}
                        placeholder="Metric"
                        data={[
                          { value: 'spend', label: 'Spend' },
                          { value: 'impressions', label: 'Impressions' },
                          { value: 'clicks', label: 'Clicks' },
                          { value: 'ctr', label: 'CTR' },
                        ]}
                        defaultValue="spend"
                      />
                    </Group>
                  </Card.Section>
                  
                  <div style={{ height: 350 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart
                        data={chartData}
                        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                        <XAxis dataKey="date" />
                        <YAxis yAxisId="left" />
                        <YAxis yAxisId="right" orientation="right" />
                        <Tooltip />
                        <Legend />
                        <Bar yAxisId="left" dataKey="spend" name="Spend ($)" fill="#228be6" />
                        <Line yAxisId="right" type="monotone" dataKey="impressions" name="Impressions" stroke="#40c057" strokeWidth={2} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </Grid.Col>
              
              {/* Top Performers */}
              <Grid.Col span={{ base: 12, md: 4 }}>
                <Card withBorder shadow="sm" h="100%" radius="md">
                  <Card.Section withBorder inheritPadding py="md">
                    <Group justify="space-between">
                      <Text fw={500}>Top Performers</Text>
                      <ActionIcon variant="subtle" color="gray" size="sm">
                        <IconDots size={16} />
                      </ActionIcon>
                    </Group>
                  </Card.Section>
                  
                  <Stack gap="xs" p="md">
                    {campaignData.slice(0, 5).map((campaign, index) => {
                      const maxSpend = Math.max(...campaignData.map(c => c.spend));
                      const percentOfMax = (campaign.spend / maxSpend) * 100;
                      
                      return (
                        <Paper key={campaign.id} p="xs" withBorder radius="md">
                          <Group justify="apart" wrap="nowrap">
                            <Group wrap="nowrap" gap="sm">
                              <Avatar 
                                size="md" 
                                radius="xl"
                                color={index % 2 === 0 ? 'blue' : 'green'}
                              >
                                {campaign.name.substring(0, 2).toUpperCase()}
                              </Avatar>
                              <div>
                                <Text size="sm" fw={500} lineClamp={1}>
                                  {campaign.name}
                                </Text>
                                <Text size="xs" c="dimmed">
                                  ${campaign.spend.toFixed(2)} spent
                                </Text>
                              </div>
                            </Group>
                            
                            <Group gap={4} align="center" wrap="nowrap">
                              <ThemeIcon 
                                color={campaign.performanceDirection === 'up' ? 'teal' : 'red'} 
                                variant="light" 
                                size="sm"
                              >
                                {campaign.performanceDirection === 'up' 
                                  ? <IconTrendingUp size={14} /> 
                                  : <IconTrendingDown size={14} />}
                              </ThemeIcon>
                              <Text 
                                size="xs" 
                                c={campaign.performanceDirection === 'up' ? 'teal' : 'red'} 
                                fw={500}
                              >
                                {campaign.performanceDirection === 'up' ? '+' : '-'}{Math.abs(campaign.performance)}%
                              </Text>
                            </Group>
                          </Group>
                          
                          <Progress 
                            value={percentOfMax} 
                            mt="xs" 
                            size="sm" 
                            color={index % 2 === 0 ? 'blue' : 'green'} 
                            radius="xl"
                          />
                        </Paper>
                      );
                    })}
                  </Stack>
                </Card>
              </Grid.Col>
              
              {/* Platform Distribution */}
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <Card withBorder shadow="sm" radius="md">
                  <Card.Section withBorder inheritPadding py="md">
                    <Group justify="space-between">
                      <Text fw={500}>Platform Distribution</Text>
                      <Badge variant="light" color="blue" radius="md">Last 7 Days</Badge>
                    </Group>
                  </Card.Section>
                  
                  <Group gap="apart" p="md">
                    <Stack align="center">
                      <RingProgress
                        size={130}
                        thickness={16}
                        roundCaps
                        sections={[
                          { value: 65, color: 'blue' },
                          { value: 25, color: 'green' },
                          { value: 10, color: 'pink' },
                        ]}
                        label={
                          <Text ta="center" fw={700} size="lg">
                            {totalSpend.toLocaleString('en-US', {
                              style: 'currency',
                              currency: 'USD',
                              minimumFractionDigits: 0
                            })}
                          </Text>
                        }
                      />
                      <Text size="sm">Total Spend</Text>
                    </Stack>
                    
                    <Stack gap={10}>
                      <Group>
                        <ThemeIcon size="md" color="blue" variant="filled" radius="xl">
                          <IconBrandFacebook size={16} />
                        </ThemeIcon>
                        <div>
                          <Text size="sm" fw={500}>Facebook</Text>
                          <Text size="xs" c="dimmed">65% of budget</Text>
                        </div>
                      </Group>
                      
                      <Group>
                        <ThemeIcon size="md" color="green" variant="filled" radius="xl">
                          <IconBrandInstagram size={16} />
                        </ThemeIcon>
                        <div>
                          <Text size="sm" fw={500}>Instagram</Text>
                          <Text size="xs" c="dimmed">25% of budget</Text>
                        </div>
                      </Group>
                      
                      <Group>
                        <ThemeIcon size="md" color="pink" variant="filled" radius="xl">
                          <IconBrandTiktok size={16} />
                        </ThemeIcon>
                        <div>
                          <Text size="sm" fw={500}>TikTok</Text>
                          <Text size="xs" c="dimmed">10% of budget</Text>
                        </div>
                      </Group>
                    </Stack>
                  </Group>
                </Card>
              </Grid.Col>
              
              {/* Campaign Health */}
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <Card withBorder shadow="sm" radius="md">
                  <Card.Section withBorder inheritPadding py="md">
                    <Group justify="space-between">
                      <Text fw={500}>Campaign Health</Text>
                      <Badge variant="light" color="yellow" radius="md">3 Issues Found</Badge>
                    </Group>
                  </Card.Section>
                  
                  <Stack p="md" gap="xs">
                    <Paper withBorder p="md" radius="md" bg="yellow.0">
                      <Group justify="apart">
                        <Group>
                          <ThemeIcon color="yellow" variant="light" size="md" radius="xl">
                            <IconExclamationCircle size={16} />
                          </ThemeIcon>
                          <div>
                            <Text size="sm" fw={500}>High CPM in Campaign "Summer Sale"</Text>
                            <Text size="xs" c="dimmed">CPM is 35% above account average</Text>
                          </div>
                        </Group>
                        <Badge size="sm" variant="outline" color="yellow" radius="md">Medium</Badge>
                      </Group>
                    </Paper>
                    
                    <Paper withBorder p="md" radius="md" bg="red.0">
                      <Group gap="apart">
                        <Group>
                          <ThemeIcon color="red" variant="light" size="md" radius="xl">
                            <IconExclamationCircle size={16} />
                          </ThemeIcon>
                          <div>
                            <Text size="sm" fw={500}>Low CTR in 2 Ad Sets</Text>
                            <Text size="xs" c="dimmed">CTR below 0.5% threshold</Text>
                          </div>
                        </Group>
                        <Badge size="sm" variant="outline" color="red" radius="md">High</Badge>
                      </Group>
                    </Paper>
                    
                    <Paper withBorder p="md" radius="md" bg="green.0">
                      <Group justify="apart">
                        <Group>
                          <ThemeIcon color="green" variant="light" size="md" radius="xl">
                            <IconCheck size={16} />
                          </ThemeIcon>
                          <div>
                            <Text size="sm" fw={500}>"Product Launch" campaign performing well</Text>
                            <Text size="xs" c="dimmed">ROAS 3.2x above target</Text>
                          </div>
                        </Group>
                        <Badge size="sm" variant="outline" color="green" radius="md">Good</Badge>
                      </Group>
                    </Paper>
                  </Stack>
                </Card>
              </Grid.Col>
            </Grid>
          </Tabs.Panel>
          
          {/* Campaigns Tab */}
          <Tabs.Panel value="campaigns" pt="md">
            <Card withBorder shadow="sm" radius="md">
              <Card.Section withBorder inheritPadding py="md">
                <Group justify="space-between">
                  <Text fw={500}>Campaign Hierarchy</Text>
                  <Select
                    size="sm"
                    w={180}
                    placeholder="Sort by"
                    data={[
                      { value: 'spend', label: 'Sort by Spend' },
                      { value: 'name', label: 'Sort by Name' },
                      { value: 'performance', label: 'Sort by Performance' },
                      { value: 'date', label: 'Sort by Date' },
                    ]}
                    defaultValue="spend"
                  />
                </Group>
              </Card.Section>
              
              <Stack gap="xs" p="md">
                {campaignData.map(campaign => (
                  <Box key={campaign.id}>
                    {/* Campaign row */}
                    <Paper p="md" withBorder radius="md" mb="xs">
                      <Group gap="apart">
                        <Group>
                          <ActionIcon 
                            onClick={() => toggleCampaign(campaign.id)} 
                            variant="subtle"
                            color="blue"
                            size="lg"
                            radius="xl"
                          >
                            {expandedCampaigns.has(campaign.id) 
                              ? <IconChevronDown size={16} /> 
                              : <IconChevronRight size={16} />}
                          </ActionIcon>
                          
                          <ThemeIcon size="lg" variant="light" color="blue" radius="xl">
                            <IconAd size={18} />
                          </ThemeIcon>
                          
                          <div>
                            <Text fw={500}>{campaign.name}</Text>
                            <Group gap="xs">
                              <Badge size="sm" radius="md" color="blue">{campaign.objective}</Badge>
                              <Badge 
                                size="sm" 
                                radius="md"
                                color={getStatusColor(campaign.status)}
                              >
                                {campaign.status}
                              </Badge>
                            </Group>
                          </div>
                        </Group>
                        
                        <Group gap="xl">
                          <Stack gap={0} align="center">
                            <Group gap="xs">
                              <IconEye size={14} stroke={1.5} />
                              <Text size="sm" fw={500}>
                                {campaign.impressions.toLocaleString()}
                              </Text>
                            </Group>
                            <Text size="xs" c="dimmed">Impressions</Text>
                          </Stack>
                          
                          <Stack gap={0} align="center">
                            <Group gap="xs">
                              <IconClick size={14} stroke={1.5} />
                              <Text size="sm" fw={500}>
                                {campaign.clicks.toLocaleString()}
                              </Text>
                            </Group>
                            <Text size="xs" c="dimmed">Clicks</Text>
                          </Stack>
                          
                          <Stack spacing={0} align="center">
                            <Text size="sm" fw={500} c="blue">
                              ${campaign.spend.toFixed(2)}
                            </Text>
                            <Text size="xs" c="dimmed">Spend</Text>
                          </Stack>
                        </Group>
                      </Group>
                    </Paper>
                    
                    {/* Ad Sets */}
                    {expandedCampaigns.has(campaign.id) && (
                      <Box ml={50}>
                        {adSetsData
                          .filter(adSet => adSet.campaign_id === campaign.id)
                          .map(adSet => (
                            <Box key={adSet.id}>
                              {/* Ad Set row */}
                              <Paper p="md" withBorder radius="md" bg="gray.0">
                                <Group justify="apart">
                                  <Group>
                                    <ActionIcon 
                                      onClick={() => toggleAdSet(adSet.id)} 
                                      variant="subtle" 
                                      size="sm"
                                      radius="xl"
                                    >
                                      {expandedAdSets.has(adSet.id) 
                                        ? <IconChevronDown size={14} /> 
                                        : <IconChevronRight size={14} />}
                                    </ActionIcon>
                                    
                                    <ThemeIcon size="md" variant="light" color="cyan" radius="xl">
                                      <IconUsersGroup size={14} />
                                    </ThemeIcon>
                                    
                                    <div>
                                      <Text size="sm" fw={500}>{adSet.name}</Text>
                                      <Badge size="xs" variant="outline" radius="md">
                                        ${adSet.spend.toFixed(2)} spent
                                      </Badge>
                                    </div>
                                  </Group>
                                  
                                  <Group>
                                    <Text size="xs">{adSet.impressions.toLocaleString()} impressions</Text>
                                    <Text size="xs">{adSet.clicks.toLocaleString()} clicks</Text>
                                  </Group>
                                </Group>
                              </Paper>
                              
                              {/* Ads */}
                              {expandedAdSets.has(adSet.id) && (
                                <Box ml={50} mb="xs">
                                  {adsData
                                    .filter(ad => ad.adset_id === adSet.id)
                                    .map(ad => (
                                      <Paper 
                                        key={ad.id} 
                                        p="md" 
                                        withBorder 
                                        radius="md"
                                        bg="gray.0" 
                                        mb="xs"
                                      >
                                        <Group justify="apart">
                                          <Group>
                                            <ThemeIcon size="sm" variant="light" color="grape" radius="xl">
                                              <IconAd size={12} />
                                            </ThemeIcon>
                                            <Text size="sm" fw={500}>{ad.name}</Text>
                                          </Group>
                                          
                                          <Group gap="xl">
                                            <Text size="xs">${ad.spend.toFixed(2)}</Text>
                                            <Text size="xs">{ad.impressions.toLocaleString()} impressions</Text>
                                            <Text size="xs">{ad.clicks.toLocaleString()} clicks</Text>
                                          </Group>
                                        </Group>
                                      </Paper>
                                    ))}
                                </Box>
                              )}
                            </Box>
                          ))}
                      </Box>
                    )}
                  </Box>
                ))}
              </Stack>
            </Card>
          </Tabs.Panel>
          
          {/* Additional tabs will be implemented later */}
          <Tabs.Panel value="platforms" pt="md">
            <Paper withBorder p="xl" ta="center" radius="md">
              <Stack align="center" gap="md">
                <ThemeIcon size="xl" radius="xl" color="blue" variant="light">
                  <IconBrandFacebook size={24} />
                </ThemeIcon>
                <Text fw={500} size="lg">Platform comparison and metrics coming soon</Text>
                <Text size="sm" c="dimmed" maw={500}>
                  This section will provide detailed performance breakdowns across Facebook, Instagram, 
                  and other platforms where your campaigns are running.
                </Text>
                <Button variant="light" color="blue" mt="md">Request Early Access</Button>
              </Stack>
            </Paper>
          </Tabs.Panel>
          
          <Tabs.Panel value="insights" pt="md">
            <Paper withBorder p="xl" ta="center" radius="md">
              <Stack align="center" gap="md">
                <ThemeIcon size="xl" radius="xl" color="indigo" variant="light">
                  <IconTrendingUp size={24} />
                </ThemeIcon>
                <Text fw={500} size="lg">AI-driven insights and recommendations coming soon</Text>
                <Text size="sm" c="dimmed" maw={500}>
                  Our AI system will analyze your campaign performance and provide actionable 
                  recommendations to optimize your advertising strategy and maximize ROI.
                </Text>
                <Button variant="light" color="indigo" mt="md">Join Waitlist</Button>
              </Stack>
            </Paper>
          </Tabs.Panel>
        </Card>
      </Tabs>
    </Container>
  );
}

// Helper component for centering content
function Center({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', alignItems: 'center' }}>{children}</div>;
}

function Box({ children, ml, mb }: { children: React.ReactNode; ml?: number; mb?: number }) {
  return (
    <div style={{ 
      marginLeft: ml !== undefined ? `${ml}px` : undefined,
      marginBottom: mb !== undefined ? `${mb}px` : undefined 
    }}>
      {children}
    </div>
  );
}
