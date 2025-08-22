'use client';

import {
    Paper, Stack, Text, Title,
    Badge, ThemeIcon, Container, Group
} from '@mantine/core';
import {
    IconBrandFacebook, IconBrandGoogle, IconBrandTiktok,
    IconChevronRight
} from '@tabler/icons-react';
import { showError } from '@/lib/utils/toasts';

interface PlatformSelectorProps {
    campaignType: 'smart' | 'manual';
    onSelectPlatform: (platform: string) => void;
    availablePlatforms?: Array<{
        id: string;
        available: boolean;
    }>;
}

export default function PlatformSelector({
    campaignType,
    onSelectPlatform,
    availablePlatforms = [
        { id: 'meta', available: true },
        { id: 'google', available: false },
        { id: 'tiktok', available: false }
    ]
}: PlatformSelectorProps) {
    const isManual = campaignType === 'manual';

    return (
        <Container size="lg" py="xl">
            <Paper p="xl" radius="md" withBorder>
                <Stack gap="lg">
                    <Group justify="apart">
                        <Stack gap={0}>
                            <Title order={2}>
                                Create {isManual ? 'Custom' : 'Smart'} Campaign
                            </Title>
                            <Text c="dimmed">
                                {isManual
                                    ? "Select the platform where you want to run your campaign"
                                    : "Let our AI help you build an optimized campaign"}
                            </Text>
                        </Stack>
                        <Badge size="lg" color={isManual ? "blue" : "green"}>
                            {isManual ? 'Manual' : 'Smart'} Campaign
                        </Badge>
                    </Group>

                    <Stack gap="md">
                        {/* Meta (Facebook/Instagram) */}
                        <PlatformCard
                            id="meta"
                            icon={<IconBrandFacebook size={24} />}
                            title="Meta Ads"
                            description="Facebook, Instagram, WhatsApp, Messenger"
                            color="blue"
                            available={availablePlatforms.find(p => p.id === 'meta')?.available ?? true}
                            onClick={(id) => onSelectPlatform(id)}
                        />

                        {/* Google */}
                        <PlatformCard
                            id="google"
                            icon={<IconBrandGoogle size={24} />}
                            title="Google Ads"
                            description="Search, Display, YouTube"
                            color="red"
                            available={availablePlatforms.find(p => p.id === 'google')?.available ?? false}
                            onClick={(id) =>
                                availablePlatforms.find(p => p.id === 'google')?.available
                                    ? onSelectPlatform(id)
                                    : showError("Google Ads integration coming soon")
                            }
                        />

                        {/* TikTok */}
                        <PlatformCard
                            id="tiktok"
                            icon={<IconBrandTiktok size={24} />}
                            title="TikTok Ads"
                            description="In-feed, TopView, Branded Hashtag"
                            color="dark"
                            available={availablePlatforms.find(p => p.id === 'tiktok')?.available ?? false}
                            onClick={(id) =>
                                availablePlatforms.find(p => p.id === 'tiktok')?.available
                                    ? onSelectPlatform(id)
                                    : showError("TikTok Ads integration coming soon")
                            }
                        />
                    </Stack>
                </Stack>
            </Paper>
        </Container>
    );
}

// Helper component for platform cards
interface PlatformCardProps {
    id: string;
    icon: React.ReactNode;
    title: string;
    description: string;
    color: string;
    available: boolean;
    onClick: (id: string) => void;
}

function PlatformCard({
    id, icon, title, description, color, available, onClick
}: PlatformCardProps) {
    return (
        <Paper
            withBorder
            p="md"
            radius="md"
            style={{
                cursor: 'pointer',
                opacity: available ? 1 : 0.7,
                borderColor: available ? `var(--mantine-color-${color}-6)` : undefined,
                borderWidth: available ? 2 : 1
            }}
            onClick={() => onClick(id)}
        >
            <Group>
                <ThemeIcon
                    size="xl"
                    radius="md"
                    color={color}
                    variant={available ? "filled" : "light"}
                >
                    {icon}
                </ThemeIcon>

                <Stack gap={0} style={{ flex: 1 }}>
                    <Group gap="xs">
                        <Text fw={600} size="lg">{title}</Text>
                        {!available && (
                            <Badge size="xs" variant="outline">Coming Soon</Badge>
                        )}
                    </Group>
                    <Text size="sm" c="dimmed">{description}</Text>
                </Stack>

                <ThemeIcon
                    variant="light"
                    color={available ? color : "gray"}
                >
                    <IconChevronRight size={18} />
                </ThemeIcon>
            </Group>
        </Paper>
    );
}