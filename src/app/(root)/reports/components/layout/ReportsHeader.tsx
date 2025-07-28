'use client';

import React from 'react';
import {
    Card,
    Group,
    Text,
    Button,
    ActionIcon,
    useMantineTheme,
    Menu,
    Box,
    Badge,
    Title,
} from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { IconRefresh, IconDownload, IconSettings, IconTarget, IconBell } from '@tabler/icons-react';

interface ReportsHeaderProps {
    dateRange: [Date | null, Date | null];
    setDateRange: (range: [Date | null, Date | null]) => void;
    title?: string;
    onRefresh?: () => void;
    onExport?: () => void;
}

export default function ReportsHeader({
    dateRange,
    setDateRange,
    title = "Reports",
    onRefresh,
    onExport,
}: ReportsHeaderProps) {
    const theme = useMantineTheme();

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
                    <Title order={2} size="h3" style={{ margin: 0 }}>
                        Meta {title}
                    </Title>
                </Box>
                {/* Date Range Picker */}
                <Group gap='lg'>
                    <DateTimePicker
                        type="range"
                        value={dateRange}
                        onChange={setDateRange}
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
