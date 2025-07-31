import { Button, Card, Stack, Text, Title, ThemeIcon } from '@mantine/core';
import { IconPlug, IconBuildingStore, IconPresentationAnalytics } from '@tabler/icons-react';
import Link from 'next/link';

interface EmptyCampaignStateProps {
    type: 'platform' | 'adAccount' | 'campaigns';
    platformName?: string;
}

export function EmptyCampaignState({ type, platformName }: EmptyCampaignStateProps) {
    const config = {
        platform: {
            icon: <IconPlug size={30} />,
            title: 'No Platform Selected',
            description: 'You need to connect and select an ad platform to view your campaigns.',
            buttonText: 'Connect a Platform',
            buttonLink: '/integration'
        },
        adAccount: {
            icon: <IconBuildingStore size={30} />,
            title: `No ${platformName} Ad Accounts Found`,
            description: `Add an ad account for ${platformName} to manage your campaigns.`,
            buttonText: 'Add Ad Account',
            buttonLink: '/integration'
        },
        campaigns: {
            icon: <IconPresentationAnalytics size={30} />,
            title: 'No Campaigns Found',
            description: 'Create your first campaign to start advertising.',
            buttonText: 'Create Campaign',
            buttonLink: '/campaigns/create'
        }
    };

    const content = config[type];

    return (
        <Card p="xl" withBorder radius="md" className="mx-auto max-w-md mt-16">
            <Stack align="center" gap="md">
                <ThemeIcon size={60} radius={40} color={type === 'platform' ? 'blue' : type === 'adAccount' ? 'indigo' : 'green'}>
                    {content.icon}
                </ThemeIcon>
                <Title order={2} ta="center">{content.title}</Title>
                <Text size="lg" c="dimmed" ta="center" mb="md">
                    {content.description}
                </Text>
                <Button component={Link} href={content.buttonLink} size="md">
                    {content.buttonText}
                </Button>
            </Stack>
        </Card>
    );
}