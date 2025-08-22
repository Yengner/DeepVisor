"use client";

import React from "react";
import {
    Container,
    Paper,
    Group,
    Skeleton,
    Box,
    SimpleGrid,
    ScrollArea,
    Table,
} from "@mantine/core";

export default function CampaignClientFallback() {
    const METRIC_CARDS = 5;
    const TABLE_ROWS = 7;

    return (
        <Container size="xl" py="md" style={{ position: "relative", minHeight: "100vh" }}>
            {/* Header (avatar + title + count + actions) */}
            <Paper p="md" radius="md" withBorder mb="xs">
                <Group justify="apart" mb="xs">
                    <Group>
                        <Skeleton height={36} width={36} circle />
                        <Box>
                            <Group gap="xs" align="center">
                                <Skeleton height={24} width={220} radius="sm" />
                                <Skeleton height={18} width={40} radius="sm" />
                            </Group>
                            <Skeleton height={12} width={140} mt={6} />
                        </Box>
                    </Group>
                    <Group>
                        <Skeleton height={36} width={160} radius="xl" />
                        <Skeleton height={36} width={36} circle />
                    </Group>
                </Group>

                {/* Metrics row (like CampaignStats) */}
                <Group align="flex-start" mt="sm">
                    <SimpleGrid cols={METRIC_CARDS} spacing="md" style={{ flex: 1, width: "100%" }}>
                        {Array.from({ length: METRIC_CARDS }).map((_, i) => (
                            <Paper key={i} withBorder p="sm" radius="lg">
                                <Skeleton height={16} width={90} mb={8} />
                                <Skeleton height={22} width={70} />
                            </Paper>
                        ))}
                    </SimpleGrid>
                </Group>
            </Paper>

            {/* Filters */}
            <Paper p="xs" radius="md" withBorder mb="xs">
                <Group justify="apart">
                    <Skeleton height={14} width={70} />
                    <Skeleton height={22} width={22} circle />
                </Group>
                <Group mt="xs">
                    <Skeleton height={32} style={{ flex: 1 }} radius="sm" />
                    <Skeleton height={32} width={120} radius="sm" />
                    <Skeleton height={32} width={120} radius="sm" />
                </Group>
            </Paper>

            {/* Tabs + Table skeleton */}
            <Paper p="xs" radius="md" withBorder>
                {/* Tabs header skeleton */}
                <Group mb="sm">
                    <Skeleton height={28} width={100} radius="xl" />
                    <Skeleton height={28} width={90} radius="xl" />
                    <Skeleton height={28} width={70} radius="xl" />
                </Group>

                <ScrollArea type="always" offsetScrollbars>
                    <Table withColumnBorders striped stickyHeader style={{ minWidth: 1200 }}>
                        <Table.Thead>
                            <Table.Tr>
                                <Table.Th style={{ width: 40 }}>
                                    <Skeleton height={12} width={20} />
                                </Table.Th>
                                <Table.Th style={{ width: 320, maxWidth: 320 }}>
                                    <Skeleton height={12} width={120} />
                                </Table.Th>
                                {[
                                    "Status",
                                    "Objective",
                                    "Start",
                                    "End",
                                    "Spend",
                                    "Results",
                                    "CTR",
                                    "CPC",
                                    "CPM",
                                    "Reach",
                                    "Impressions",
                                    "Clicks",
                                    "Link Clicks",
                                    "Leads",
                                    "Messages",
                                    "Freq",
                                    "CPL",
                                    "Cost/Msg",
                                ].map((h) => (
                                    <Table.Th key={h}>
                                        <Skeleton height={12} width={80} />
                                    </Table.Th>
                                ))}
                                <Table.Th style={{ width: 24 }}>
                                    <Skeleton height={12} width={12} />
                                </Table.Th>
                            </Table.Tr>
                        </Table.Thead>

                        <Table.Tbody>
                            {Array.from({ length: TABLE_ROWS }).map((_, i) => (
                                <Table.Tr key={i}>
                                    <Table.Td>
                                        <Skeleton height={20} width={20} circle />
                                    </Table.Td>
                                    <Table.Td>
                                        <Skeleton height={14} width={220} mb={6} />
                                        <Skeleton height={10} width={140} />
                                    </Table.Td>

                                    {/* Repeat lightweight cells */}
                                    {Array.from({ length: 17 }).map((__, j) => (
                                        <Table.Td key={j}>
                                            <Skeleton height={12} width={70} />
                                        </Table.Td>
                                    ))}

                                    <Table.Td>
                                        <Skeleton height={24} width={24} circle />
                                    </Table.Td>
                                </Table.Tr>
                            ))}
                        </Table.Tbody>
                    </Table>
                </ScrollArea>
            </Paper>
        </Container>
    );
}
