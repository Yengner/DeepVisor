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
            mb="xl"
            p="lg"
            radius="md"
            withBorder

        >
            <Group justify="space-between" align="center">
                {/* Left Section */}
                <Box>
                    <Group gap="xs">
                        {/* Platform badge */}
                        <Badge
                            color="indigo"
                            variant="filled"
                            size="md"
                            style={{ textTransform: 'uppercase', letterSpacing: 1 }}
                        >
                            {platform}
                        </Badge>
                        {/* Title */}
                        <Title order={2} size="h3" style={{ margin: 0 }}>
                            {title}
                        </Title>
                        {/* Type badge */}
                        <Badge
                            color={typeBadge[type].color}
                            variant="light"
                            size="md"
                            style={{ marginLeft: 8, textTransform: 'capitalize' }}
                        >
                            {typeBadge[type].label}
                        </Badge>
                    </Group>
                </Box>
                {/* Date Range Picker */}
                <Group gap='lg'>
                    <DateTimePicker
                        placeholder="Select date range"
                    />
                    <Button variant='filled' color='pink'>
                        Export CSV
                    </Button>

                    <Button
                        leftSection={<IconRefresh size={16} />}
                        variant="light"
                    // onClick={onRefresh}
                    // loading={refreshing}
                    >
                        Refresh
                    </Button>


                    <Menu shadow="md" width={200}>
                        <Menu.Target>
                            <ActionIcon variant="light" size="lg">
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
