"use client";

import { Card, Text, Table, Tooltip } from "@mantine/core";

function interpolateColor(light: number[], dark: number[], factor: number) {
    const adjusted = Math.pow(factor, 0.5) * 0.5;
    const rgb = light.map((l, i) => Math.round(l + (dark[i] - l) * adjusted));
    return `rgb(${rgb.join(",")})`;
}

interface NumericCol {
    key: string;
    label: string;
    light: number[];
    dark: number[];
    format: (v: any) => string | number;
}

interface PerformanceTableProps {
    title: string;
    rows: any[];
    columns: { key: string; label: string }[];
    numericCols: NumericCol[];
    minMax?: Record<string, { min: number; max: number }>;
}

export default function PerformanceTable({
    title,
    rows,
    columns,
    numericCols,
    minMax: minMaxProp,
}: PerformanceTableProps) {
    // Compute min/max if not provided
    const minMax = minMaxProp || {};
    numericCols.forEach((col) => {
        if (!minMax[col.key]) {
            const values = rows.map((row) => row[col.key]);
            minMax[col.key] = { min: Math.min(...values), max: Math.max(...values) };
        }
    });

    return (
        <Card
            withBorder
            p={16}
            style={{
                borderRadius: 16,
                display: "flex",
                flexDirection: "column",
                width: "100%",
                alignItems: "flex-start",
                marginBottom: 32,
            }}
        >
            <Text fw={700} size="xl" style={{ color: "#22223b", marginBottom: 12 }}>
                {title}
            </Text>
            <Table.ScrollContainer minWidth={200} maxHeight={300} type="native" style={{ width: "100%" }}>
                <Table striped highlightOnHover withColumnBorders>
                    <Table.Thead>
                        <Table.Tr>
                            {columns.map((col) => (
                                <Table.Th key={col.key} style={{ fontWeight: 700 }}>
                                    {col.label}
                                </Table.Th>
                            ))}
                            {numericCols.map((col) => (
                                <Table.Th key={col.key} style={{ fontWeight: 700 }}>
                                    {col.label}
                                </Table.Th>
                            ))}
                        </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                        {rows.map((row, idx) => (
                            <Table.Tr key={row.id || row.name || idx}>
                                {columns.map((col) => (
                                    col.key === "name" ? (
                                        <Table.Td
                                            key={col.key}
                                            style={{
                                                fontWeight: 500,
                                                maxWidth: 130,
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                whiteSpace: "nowrap",
                                            }}
                                        >
                                            <Tooltip label={row[col.key]} withArrow position="right">
                                                <span style={{ cursor: "help" }}>{row[col.key]}</span>
                                            </Tooltip>
                                        </Table.Td>
                                    ) : (
                                        <Table.Td
                                            key={col.key}
                                            style={{
                                                fontWeight: 500,
                                                maxWidth: 130,
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                whiteSpace: "nowrap",
                                            }}
                                        >
                                            {row[col.key]}
                                        </Table.Td>
                                    )
                                ))}
                                {numericCols.map((col) => {
                                    const { min, max } = minMax[col.key];
                                    const factor = min === max ? 0 : (row[col.key] - min) / (max - min);
                                    return (
                                        <Table.Td
                                            key={col.key}
                                            style={{
                                                background: interpolateColor(col.light, col.dark, factor),
                                                color: factor > 0.6 ? "#fff" : "#22223b",
                                                fontWeight: col.key === "spend" || col.key === "cpm" ? 600 : 500,
                                            }}
                                        >
                                            {col.format(row[col.key])}
                                        </Table.Td>
                                    );
                                })}
                            </Table.Tr>
                        ))}
                    </Table.Tbody>
                </Table>
            </Table.ScrollContainer>
        </Card>
    );
}