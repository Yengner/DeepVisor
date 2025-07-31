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
                width: 180,
                minHeight: '100vh',
                borderRight: `1px solid ${theme.colors.gray[3]}`,
                padding: theme.spacing.xs,
                zIndex: 100,
            }}
        >
            {/* Back Button */}
            <Button
                variant="light"
                size="xs"
                mb="sm"
                fullWidth
                onClick={handleBack}
                disabled={!selectedId}
            >
                Back
            </Button>

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
                    {filtered.map((item) => (
                        <Tooltip label={item.name} withArrow key={item.id} position="right">
                            <Box
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '4px 8px',
                                    borderRadius: 6,
                                    background: selectedId === item.id
                                        ? theme.colors.blue[0]
                                        : theme.colors.gray[1],
                                    transition: 'background 0.15s',
                                    cursor: 'pointer',
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
