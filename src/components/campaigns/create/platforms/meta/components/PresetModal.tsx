'use client';

import { useState, useEffect } from 'react';
import {
    Modal,
    Text,
    Tabs,
    SimpleGrid,
    Paper,
    Image,
    Stack,
    Badge,
    Checkbox,
    Group,
    ThemeIcon,
    Button,
    Center,
    Loader,
    Pagination,
    ActionIcon,
    Divider,
    Box,
    AspectRatio
} from '@mantine/core';
import { IconBrandFacebook, IconBrandInstagram, IconAlertCircle, IconPhoto, IconCheck } from '@tabler/icons-react';

interface PresetModalProps {
    opened: boolean;
    onClose: () => void;
    objective: string;
}

export default function PresetModal({
    opened,
    onClose,
    objective,
}: PresetModalProps) {

    return (
        <Modal
            opened={opened}
            onClose={onClose}
            title={<Text fw={600} size="lg">Preset Campaign Settings</Text>}
            size="md"
            centered
        >
            <Stack>
                <Text size="sm">
                    This campaign includes the following preset settings. If you need to change these settings, you can switch to edit this campaign manually.
                </Text>

                <Paper withBorder p="md" radius="md">
                    <Stack gap="xs">
                        <Group justify="space-between">
                            <Text size="sm" fw={500}>Campaign objective</Text>
                            <Text size="sm">{objective}</Text>
                        </Group>

                        <Divider my="xs" />

                        <Group justify="space-between">
                            <Text size="sm" fw={500}>Bid strategy</Text>
                            <Text size="sm">Highest volume</Text>
                        </Group>

                        <Divider my="xs" />

                        <Group justify="space-between">
                            <Text size="sm" fw={500}>Placements</Text>
                            <Text size="sm">Advantage+ placements</Text>
                        </Group>

                        <Divider my="xs" />

                        <Group justify="space-between">
                            <Text size="sm" fw={500}>Optimization for ad delivery</Text>
                            <Text size="sm">{objective}</Text>
                        </Group>
                    </Stack>
                </Paper>

                <Button fullWidth onClick={onClose} mt="md">Close</Button>
            </Stack>
        </Modal>
    );
}