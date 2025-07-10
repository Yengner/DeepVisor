import { useCallback, useMemo, useState } from 'react';
import { 
  Box, 
  Group, 
  Paper, 
  Text, 
  ThemeIcon, 
  UnstyledButton, 
  Badge,
  Collapse,
  ActionIcon, 
  Stack
} from '@mantine/core';
import { 
  IconChevronRight, 
  IconChevronDown, 
  IconAd, 
  IconLayoutGrid, 
  IconTargetArrow,
  IconEye,
  IconClick
} from '@tabler/icons-react';

interface CampaignTreeViewProps {
  campaigns: any[];
  adSets: any[];
  ads: any[];
}

export function CampaignTreeView({ campaigns, adSets, ads }: CampaignTreeViewProps) {
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set());
  const [expandedAdSets, setExpandedAdSets] = useState<Set<string>>(new Set());

  // Toggle campaign expansion
  const toggleCampaign = useCallback((id: string) => {
    setExpandedCampaigns(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  // Toggle ad set expansion
  const toggleAdSet = useCallback((id: string) => {
    setExpandedAdSets(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  // Get status badge color
  const getStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'ACTIVE': return 'green';
      case 'PAUSED': return 'yellow';
      case 'ARCHIVED': return 'gray';
      case 'DELETED': return 'red';
      default: return 'gray';
    }
  };

  // Organize data for tree view
  const campaignsWithChildren = useMemo(() => {
    return campaigns.map(campaign => {
      const campaignAdSets = adSets.filter(adSet => adSet.campaign_id === campaign.id);
      
      const adSetsWithChildren = campaignAdSets.map(adSet => {
        const adSetAds = ads.filter(ad => ad.adset_id === adSet.id);
        return { ...adSet, ads: adSetAds };
      });
      
      return { ...campaign, adSets: adSetsWithChildren };
    });
  }, [campaigns, adSets, ads]);

  return (
    <Stack spacing={0}>
      {campaignsWithChildren.map(campaign => (
        <Box key={campaign.id}>
          {/* Campaign row */}
          <Paper p="md" withBorder mb="xs">
            <Group position="apart">
              <Group>
                <ActionIcon 
                  onClick={() => toggleCampaign(campaign.id)} 
                  variant="subtle"
                >
                  {expandedCampaigns.has(campaign.id) 
                    ? <IconChevronDown size={16} /> 
                    : <IconChevronRight size={16} />}
                </ActionIcon>
                
                <ThemeIcon size="lg" variant="light" color="blue" radius="md">
                  <IconAd size={18} />
                </ThemeIcon>
                
                <div>
                  <Text fw={500}>{campaign.name}</Text>
                  <Group spacing="xs">
                    <Badge size="sm">{campaign.objective || 'Unknown Objective'}</Badge>
                    <Badge 
                      size="sm" 
                      color={getStatusColor(campaign.status)}
                    >
                      {campaign.status}
                    </Badge>
                  </Group>
                </div>
              </Group>
              
              <Group spacing="xl">
                <Stack spacing={0} align="center">
                  <Group spacing="xs">
                    <IconEye size={14} stroke={1.5} />
                    <Text size="sm" fw={500}>
                      {/* {(campaign.raw_data?.insights?.data?.[0]?.impressions || 0).toLocaleString()} */}
                    </Text>
                  </Group>
                  <Text size="xs" c="dimmed">Impressions</Text>
                </Stack>
                
                <Stack spacing={0} align="center">
                  <Group spacing="xs">
                    <IconClick size={14} stroke={1.5} />
                    <Text size="sm" fw={500}>
                      {/* {(campaign.raw_data?.insights?.data?.[0]?.clicks || 0).toLocaleString()} */}
                    </Text>
                  </Group>
                  <Text size="xs" c="dimmed">Clicks</Text>
                </Stack>
                
                <Stack spacing={0} align="center">
                  <Text size="sm" fw={500} c="green">
                    {/* ${(campaign.raw_data?.insights?.data?.[0]?.spend || 0).toFixed(2)} */}
                  </Text>
                  <Text size="xs" c="dimmed">Spend</Text>
                </Stack>
              </Group>
            </Group>
          </Paper>
          
          {/* Ad Sets */}
          <Collapse in={expandedCampaigns.has(campaign.id)}>
            <Box ml={30}>
              {campaign.adSets?.map(adSet => (
                <Box key={adSet.id} mb="xs">
                  {/* Ad Set row */}
                  <Paper p="sm" withBorder bg="gray.0">
                    <Group position="apart">
                      <Group>
                        <ActionIcon 
                          onClick={() => toggleAdSet(adSet.id)} 
                          variant="subtle" 
                          size="sm"
                        >
                          {expandedAdSets.has(adSet.id) 
                            ? <IconChevronDown size={14} /> 
                            : <IconChevronRight size={14} />}
                        </ActionIcon>
                        
                        <ThemeIcon size="md" variant="light" color="cyan">
                          <IconLayoutGrid size={14} />
                        </ThemeIcon>
                        
                        <div>
                          <Text size="sm" fw={500}>{adSet.name}</Text>
                          <Badge size="xs" variant="outline">
                            {adSet.ads?.length || 0} Ads
                          </Badge>
                        </div>
                      </Group>
                    </Group>
                  </Paper>
                  
                  {/* Ads */}
                  <Collapse in={expandedAdSets.has(adSet.id)}>
                    <Box ml={30} mb="xs">
                      {adSet.ads?.map(ad => (
                        <Paper 
                          key={ad.id} 
                          p="sm" 
                          withBorder 
                          bg="gray.0" 
                          mb="xs"
                        >
                          <Group>
                            <ThemeIcon size="sm" variant="light" color="grape">
                              <IconTargetArrow size={12} />
                            </ThemeIcon>
                            
                            <Text size="sm">{ad.name}</Text>
                          </Group>
                        </Paper>
                      ))}
                    </Box>
                  </Collapse>
                </Box>
              ))}
            </Box>
          </Collapse>
        </Box>
      ))}
    </Stack>
  );
}