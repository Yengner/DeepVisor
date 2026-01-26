'use client';

import { useState } from 'react';
import {
    Box,
    Text,
    Checkbox,
    Stack,
    TextInput,
    ScrollArea,
    useMantineTheme,
    Tooltip,
    Button,
} from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import { useRouter, useSearchParams } from 'next/navigation';

interface SidebarItem {
    id: string;
    name: string;
}

interface ReportsSidebarProps {
    items: SidebarItem[];
    paramKey: string;
}

export default function ReportsSidebar({ items = [], paramKey }: ReportsSidebarProps) {
    const theme = useMantineTheme();
    const [filter, setFilter] = useState('');
    const router = useRouter();
    const searchParams = useSearchParams();


    if (!items || !Array.isArray(items)) {
        return null;
    }

    const filtered = items.filter((item) =>
        item.name?.toLowerCase().includes(filter.toLowerCase())
    );

    const selectedId = searchParams.get("campaign_id") || '';

    const handleSelect = (id: string) => {
        const params = new URLSearchParams(searchParams.toString());
        if (selectedId === id) {
            params.delete(paramKey);
        } else {
            params.set(paramKey, id);
        }
        router.push(`?${params.toString()}`);
    };

    // Come back to fix
    const handleBack = () => {
        const params = new URLSearchParams(searchParams.toString());
        params.delete(paramKey);
        router.push(`?${params.toString()}`);
    };


    return (
        <Box
            style={{
                width: 220,
                minHeight: '100vh',
                borderRight: `1px solid ${theme.colors.gray[3]}`,
                padding: theme.spacing.sm,
                zIndex: 100,
                background: 'linear-gradient(180deg, rgba(15,23,42,0.02), rgba(14,165,233,0.04))',
            }}
        >
            {/* Back Button */}
            <Button
                variant="subtle"
                size="sm"
                mb="md"
                fullWidth
                onClick={handleBack}
                disabled={!selectedId}
                radius="md"
            >
                Back
            </Button>

            {/* Search */}
            <TextInput
                size="sm"
                placeholder="Search…"
                leftSection={<IconSearch size={16} />}
                mb="sm"
                value={filter}
                onChange={(e) => setFilter(e.currentTarget.value)}
                radius="md"
            />

            {/* List */}
            <ScrollArea style={{ height: 'calc(100vh - 120px)' }}>
                <Stack gap="xs">
                    {filtered.map((item) => (
                        <Tooltip label={item.name} withArrow key={item.id} position="right">
                            <Box
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '6px 10px',
                                    borderRadius: 10,
                                    background: selectedId === item.id
                                        ? theme.colors.blue[0]
                                        : 'rgba(255,255,255,0.65)',
                                    transition: 'background 0.15s',
                                    cursor: 'pointer',
                                    border: `1px solid ${theme.colors.gray[2]}`,
                                }}
                                onClick={() => handleSelect(item.id)}
                            >
                                <Checkbox
                                    checked={selectedId === item.id}
                                    onChange={() => handleSelect(item.id)}
                                    mr={6}
                                    tabIndex={-1}
                                    style={{ pointerEvents: 'none' }}
                                />
                                <Text
                                    size="sm"
                                    style={{
                                        color: theme.colors.gray[9],
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        flex: 1,
                                    }}
                                >
                                    {item.name}
                                </Text>
                            </Box>
                        </Tooltip>
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
