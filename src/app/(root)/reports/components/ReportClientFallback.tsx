"use client";

import React from "react";
import {
    Container,
    Box,
    Group,
    Card,
    Skeleton,
    SimpleGrid,
    ActionIcon,
} from "@mantine/core";
import { IconChevronLeft } from "@tabler/icons-react";

export default function ReportsClientFallback() {
    return (
        <Container size="xl" py="md" style={{ position: "relative", minHeight: "100vh" }}>
            {/* Header Skeleton */}
            <Box mb="md">
                <Skeleton height={38} width={260} radius="md" mb="xs" />
                <Skeleton height={18} width={180} radius="md" />
            </Box>

            <Box style={{ display: "flex", flexDirection: "row", minHeight: "calc(100vh - 60px)" }}>
                {/* Sidebar Skeleton */}
                <Box
                    style={{
                        width: 180,
                        minWidth: 90,
                        maxWidth: 260,
                        borderRight: "1px solid #e9ecef",
                        position: "relative",
                        height: "calc(100vh - 80px)",
                    }}
                >
                    <Box
                        style={{
                            position: "absolute",
                            top: 24,
                            right: -23,
                            zIndex: 10,
                        }}
                    >
                        <ActionIcon
                            variant="light"
                            size={36}
                            radius="xl"
                            style={{
                                boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
                                border: "1px solid #e9ecef",
                                background: "#f8f9fa",
                            }}
                            aria-label="Collapse sidebar"
                        >
                            <IconChevronLeft size={22} />
                        </ActionIcon>
                    </Box>
                    <Box p="xs">
                        <Skeleton height={32} width="100%" mb="sm" />
                        {[...Array(7)].map((_, i) => (
                            <Skeleton key={i} height={24} width="90%" mb="xs" radius="sm" />
                        ))}
                    </Box>
                </Box>

                {/* Main Content Skeleton */}
                <Box style={{ flex: 1, padding: "25px 0 0 25px", minHeight: "100%" }}>
                    <Group align="flex-start" mb="xl" style={{ width: "100%" }}>
                        <SimpleGrid cols={5} spacing="md" style={{ flex: 1, width: "100%" }}>
                            {[...Array(5)].map((_, i) => (
                                <Card withBorder p={10} key={i} style={{ borderRadius: 16 }}>
                                    <Skeleton height={32} width={80} mb={8} />
                                    <Skeleton height={24} width={60} />
                                </Card>
                            ))}
                        </SimpleGrid>
                    </Group>
                    <Skeleton height={220} width="100%" radius="md" mb="lg" />
                    <Skeleton height={220} width="100%" radius="md" />
                </Box>
            </Box>
        </Container>
    );
}