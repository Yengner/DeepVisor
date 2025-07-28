'use client';

import React, { useState } from 'react';
import {
    Box,
    Text,
    Checkbox,
    Stack,
    TextInput,
    ScrollArea,
    useMantineTheme,
} from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';

interface Campaign {
    id: string;
    name: string;
}

interface ReportsSidebarProps {
    campaigns: Campaign[];
    selected: string[];
    onToggle: (id: string) => void;
}
const campaigns = [
    { id: 'campaign1', name: 'Spring Sale 2025' },
    { id: 'campaign2', name: 'Brand Awareness' },
    { id: 'campaign3', name: 'Holiday Promo' },
    { id: 'campaign4', name: 'Lead Gen Q3' },
];

export default function ReportsSidebar({
    onToggle,
}: ReportsSidebarProps) {
    const [selected, setSelected] = useState<string[]>([]);
    const handleToggle = (id: string) => {
        setSelected((prev) => prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
        );
    }
    const theme = useMantineTheme();
    const [filter, setFilter] = useState('');

    const filtered = campaigns.filter((c) =>
        c.name.toLowerCase().includes(filter.toLowerCase())
    );

    return (
        <Box
            style={{
                width: 180,
                minHeight: '100vh',

                borderRight: `1px solid ${theme.colors.gray[3]}`,
                padding: theme.spacing.md,
                zIndex: 100,
            }}
        >
            {/* Search */}
            <TextInput
                size="sm"
                placeholder="Search campaigns..."
                leftSection={<IconSearch size={16} />}
                mb="sm"
                value={filter}
                onChange={(e) => setFilter(e.currentTarget.value)}
            />

            {/* List */}
            <ScrollArea style={{ height: 'calc(100vh - 72px)' }}>
                <Stack gap="xs">
                    {filtered.map((c) => (
                        <Checkbox
                            key={c.id}
                            label={c.name}
                            size="sm"
                            checked={selected.includes(c.id)}
                            onChange={() => onToggle(c.id)}
                            styles={{
                                label: { fontSize: theme.fontSizes.sm, color: theme.colors.gray[9] },
                                body: { padding: '4px 0' },
                            }}
                        />
                    ))}
                    {filtered.length === 0 && (
                        <Text size="sm" c="dimmed" ta="center">
                            No campaigns found
                        </Text>
                    )}
                </Stack>
            </ScrollArea>
        </Box>
    );
}
