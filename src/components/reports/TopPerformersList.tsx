import { Avatar, Group, Paper, Stack, Text, ThemeIcon, Progress } from '@mantine/core';
import { IconTrendingUp, IconTrendingDown } from '@tabler/icons-react';

interface TopPerformersListProps {
  campaigns: any[];
}

export function TopPerformersList({ campaigns }: TopPerformersListProps) {
  // Sort campaigns by spend
  const sortedCampaigns = [...campaigns]
    .sort((a, b) => {
      const spendA = a.raw_data?.insights?.data?.[0]?.spend || 0;
      const spendB = b.raw_data?.insights?.data?.[0]?.spend || 0;
      return spendB - spendA;
    })
    .slice(0, 5);
  
  // Get max spend for calculating relative width
  const maxSpend = Math.max(
    ...sortedCampaigns.map(c => c.raw_data?.insights?.data?.[0]?.spend || 0)
  );
  
  return (
    <Stack spacing="xs" mt="md">
      {sortedCampaigns.map((campaign, index) => {
        const spend = campaign.raw_data?.insights?.data?.[0]?.spend || 0;
        const percentOfMax = (spend / maxSpend) * 100;
        
        // Fake performance indicators
        const isPositive = Math.random() > 0.3;
        const performancePercent = Math.floor(Math.random() * 25) + 1;
        
        return (
          <Paper key={campaign.id} p="xs" withBorder>
            <Group position="apart">
              <Group spacing="sm">
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
                    {/* ${spend.toFixed(2)} spent */}
                  </Text>
                </div>
              </Group>
              
              <Group spacing={4} align="center">
                <ThemeIcon 
                  color={isPositive ? 'teal' : 'red'} 
                  variant="light" 
                  size="sm"
                >
                  {isPositive ? <IconTrendingUp size={14} /> : <IconTrendingDown size={14} />}
                </ThemeIcon>
                <Text 
                  size="xs" 
                  c={isPositive ? 'teal' : 'red'} 
                  fw={500}
                >
                  {isPositive ? '+' : '-'}{performancePercent}%
                </Text>
              </Group>
            </Group>
            
            <Progress 
              value={percentOfMax} 
              mt="xs" 
              size="sm" 
              color={index % 2 === 0 ? 'blue' : 'green'} 
            />
          </Paper>
        );
      })}
    </Stack>
  );
}