'use client';

import React from 'react';
import {
    Card,
    Group,
    Button,
    ActionIcon,
    Menu,
    Box,
    Badge,
    Title,
} from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { IconRefresh, IconSettings, IconTarget, IconBell } from '@tabler/icons-react';

interface ReportsHeaderProps {
    title: string;
    type: 'adAccount' | 'campaigns' | 'adsets' | 'ads';
    platform?: string; // e.g., "Meta", "Google", etc.
}

export default function ReportsHeader({ title, type, platform = "Meta" }: ReportsHeaderProps) {

    const typeBadge: Record<ReportsHeaderProps['type'], { label: string; color: string }> = {
        adAccount: { label: "Ad Account", color: "blue" },
        campaigns: { label: "Campaign", color: "grape" },
        adsets: { label: "Ad Set", color: "teal" },
        ads: { label: "Ad", color: "orange" },
    };

    return (
        <Card
            mb="lg"
            p="xl"
            radius="lg"
            withBorder
            style={{
                position: 'relative',
                overflow: 'hidden',
                background: 'linear-gradient(120deg, #0f172a 0%, #111827 50%, #0ea5e9 130%)',
                borderColor: 'rgba(255,255,255,0.08)',
            }}
        >
            <Box
                style={{
                    position: 'absolute',
                    inset: 0,
                    background:
                        'radial-gradient(circle at 10% 20%, rgba(14,165,233,0.2), transparent 34%), radial-gradient(circle at 80% 0%, rgba(14,165,233,0.18), transparent 28%)',
                }}
            />
            <Group justify="space-between" align="center" pos="relative">
                <Box>
                    <Group gap="xs" align="center">
                        <Badge
                            color="indigo"
                            variant="light"
                            size="md"
                            style={{ textTransform: 'uppercase', letterSpacing: 1 }}
                        >
                            {platform}
                        </Badge>
                        <Badge
                            color={typeBadge[type].color}
                            variant="light"
                            size="md"
                            style={{ textTransform: 'capitalize' }}
                        >
                            {typeBadge[type].label}
                        </Badge>
                    </Group>
                    <Title order={2} size="h2" c="white" mt="xs" mb={4}>
                        {title}
                    </Title>
                    <Group gap="xs">
                        <Badge variant="light" color="green">Live</Badge>
                        <Badge variant="outline" color="gray">Reporting workspace</Badge>
                    </Group>
                </Box>
                <Group gap="sm">
                    <DateTimePicker
                        placeholder="Select date range"
                        size="sm"
                        radius="md"
                    />
                    <Button variant='white' color='dark' radius="md">
                        Export CSV
                    </Button>

                    <Button
                        leftSection={<IconRefresh size={16} />}
                        variant="outline"
                        color="gray"
                        radius="md"
                    >
                        Refresh
                    </Button>


                    <Menu shadow="md" width={200}>
                        <Menu.Target>
                            <ActionIcon variant="light" size="lg" radius="md">
                                <IconSettings size={16} />
                            </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                            <Menu.Item leftSection={<IconTarget size={14} />}>
                                Set Goals
                            </Menu.Item>
                            <Menu.Item leftSection={<IconBell size={14} />}>
                                Alert Settings
                            </Menu.Item>
                        </Menu.Dropdown>
                    </Menu>
                </Group>
            </Group>
        </Card>
    );
}
