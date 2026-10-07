'use client';

import { Button, Card, Stack, Text, Title, ThemeIcon } from '@mantine/core';
import { IconArrowRight, IconPlug, IconBuildingStore, IconPresentationAnalytics } from '@tabler/icons-react';
import Link from 'next/link';
import product from '@/components/product/Product.module.css';

interface EmptyCampaignStateProps {
    type: 'platform' | 'adAccount' | 'campaigns';
    platformName?: string;
}

export function EmptyCampaignState({ type, platformName }: EmptyCampaignStateProps) {
    const config = {
        platform: {
            icon: <IconPlug size={30} />,
            title: 'No Ad Platform Connected',
            description: 'Connect Meta to see your campaigns and their performance here.',
            buttonText: 'Connect a Platform',
            buttonLink: '/integration',
        },
        adAccount: {
            icon: <IconBuildingStore size={30} />,
            title: `No ${platformName} Ad Accounts Synced`,
            description: `Sync at least one ${platformName} ad account to manage campaigns and receive AI recommendations.`,
            buttonText: 'Add Ad Account',
            buttonLink: '/integration',
        },
        campaigns: {
            icon: <IconPresentationAnalytics size={30} />,
            title: 'No Campaigns Found',
            description: 'Create your first campaign to start advertising.',
            buttonText: 'Create Campaign',
            buttonLink: '/campaigns/create',
        },
    } as const;

    const content = config[type];

    return (
        <Card p="xl" withBorder radius="md" className={`${product.page} mx-auto mt-8 max-w-xl`}>
            <Stack align="center" gap="md">
                <ThemeIcon
                    size={48}
                    radius="sm"
                    color="signal"
                    style={{ background: '#e8f4ec', color: '#226443' }}
                >
                    {content.icon}
                </ThemeIcon>

                <Title order={2} ta="center" className="app-platform-page-title">
                    {content.title}
                </Title>

                <Text size="md" ta="center" mb="md" className="app-platform-page-copy">
                    {content.description}
                </Text>

                <Button
                  component={Link}
                  href={content.buttonLink}
                  size="md"
                  rightSection={<IconArrowRight size={16} />}
                  className="app-platform-page-action-primary"
                >
                  {content.buttonText}
                </Button>
            </Stack>
        </Card>
    );
}
