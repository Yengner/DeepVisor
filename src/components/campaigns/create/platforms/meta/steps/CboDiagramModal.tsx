import { Modal, Text, Group, ThemeIcon, Stack, Paper, SegmentedControl, Box } from '@mantine/core';
import { IconHierarchy3, IconInfoCircle } from '@tabler/icons-react';
import { useState } from 'react';
import React from 'react';
import {
    ReactFlow,
    Background,
    Controls,
    MiniMap,
    Node,
    Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

const nodes: Node[] = [
    { id: 'campaign', data: { label: 'Campaign' }, position: { x: 180, y: 10 }, style: { background: '#22c55e', color: '#fff' } },
    { id: 'ad1', data: { label: 'Ad Set 1' }, position: { x: 20, y: 100 }, style: { background: '#2563eb', color: '#fff' } },
    { id: 'ad2', data: { label: 'Ad Set 2' }, position: { x: 180, y: 100 }, style: { background: '#2563eb', color: '#fff' } },
    { id: 'ad3', data: { label: 'Ad Set 3' }, position: { x: 340, y: 100 }, style: { background: '#2563eb', color: '#fff' } },
];

const edges: Edge[] = [
    { id: 'e1', source: 'campaign', target: 'ad1', animated: true, label: 'Best' },
    { id: 'e2', source: 'campaign', target: 'ad2', animated: true, label: 'Avg' },
    { id: 'e3', source: 'campaign', target: 'ad3', animated: true, label: 'Low' },
];
interface CboDiagramModalProps {
    opened: boolean;
    onClose: () => void;
}

function CboDiagram({ mode }: { mode: 'on' | 'off' }) {
    // Simple SVG diagram for CBO ON/OFF
    if (mode === 'on') {
        // CBO ON: Campaign box above 3 ad sets, arrows from campaign to each ad set, with "Budget" label on campaign, and "Performance-based" arrows
        return (
            <Box style={{ width: '100%', display: 'flex', justifyContent: 'center', margin: '24px 0' }}>
                <svg width="420" height="200" viewBox="0 0 420 200">
                    {/* Campaign box */}
                    <rect x="160" y="10" width="100" height="40" rx="8" fill="#22c55e" />
                    <text x="210" y="35" textAnchor="middle" fill="#fff" fontWeight="bold" fontSize="16">Campaign</text>
                    {/* Budget label */}
                    <text x="210" y="55" textAnchor="middle" fill="#22c55e" fontSize="12">Budget: $500</text>
                    {/* Arrows to ad sets */}
                    <g>
                        <line x1="210" y1="50" x2="90" y2="100" stroke="#22c55e" strokeWidth="2" markerEnd="url(#arrow)" />
                        <line x1="210" y1="50" x2="210" y2="100" stroke="#22c55e" strokeWidth="2" markerEnd="url(#arrow)" />
                        <line x1="210" y1="50" x2="330" y2="100" stroke="#22c55e" strokeWidth="2" markerEnd="url(#arrow)" />
                        {/* Performance-based labels */}
                        <text x="120" y="85" fill="#888" fontSize="11" textAnchor="middle">Best</text>
                        <text x="210" y="85" fill="#888" fontSize="11" textAnchor="middle">Avg</text>
                        <text x="300" y="85" fill="#888" fontSize="11" textAnchor="middle">Low</text>
                    </g>
                    {/* Ad Set boxes */}
                    <rect x="50" y="100" width="80" height="40" rx="8" fill="#2563eb" />
                    <rect x="170" y="100" width="80" height="40" rx="8" fill="#2563eb" />
                    <rect x="290" y="100" width="80" height="40" rx="8" fill="#2563eb" />
                    {/* Ad Set labels */}
                    <text x="90" y="125" textAnchor="middle" fill="#fff" fontWeight="bold" fontSize="14">Ad Set 1</text>
                    <text x="210" y="125" textAnchor="middle" fill="#fff" fontWeight="bold" fontSize="14">Ad Set 2</text>
                    <text x="330" y="125" textAnchor="middle" fill="#fff" fontWeight="bold" fontSize="14">Ad Set 3</text>
                    {/* Budget allocation arrows */}
                    <text x="90" y="155" textAnchor="middle" fill="#22c55e" fontSize="12">More $</text>
                    <text x="210" y="155" textAnchor="middle" fill="#22c55e" fontSize="12">Some $</text>
                    <text x="330" y="155" textAnchor="middle" fill="#22c55e" fontSize="12">Less $</text>
                    <defs>
                        <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto" markerUnits="strokeWidth">
                            <path d="M0,0 L8,4 L0,8 Z" fill="#22c55e" />
                        </marker>
                    </defs>
                </svg>
            </Box>
        );
    } else {
        // CBO OFF: 3 ad sets, each with its own budget, no campaign box above
        return (
            <Box style={{ width: '100%', display: 'flex', justifyContent: 'center', margin: '24px 0' }}>
                <svg width="420" height="120" viewBox="0 0 420 120">
                    {/* Ad Set boxes */}
                    <rect x="50" y="30" width="80" height="40" rx="8" fill="#2563eb" />
                    <rect x="170" y="30" width="80" height="40" rx="8" fill="#2563eb" />
                    <rect x="290" y="30" width="80" height="40" rx="8" fill="#2563eb" />
                    {/* Ad Set labels */}
                    <text x="90" y="55" textAnchor="middle" fill="#fff" fontWeight="bold" fontSize="14">Ad Set 1</text>
                    <text x="210" y="55" textAnchor="middle" fill="#fff" fontWeight="bold" fontSize="14">Ad Set 2</text>
                    <text x="330" y="55" textAnchor="middle" fill="#fff" fontWeight="bold" fontSize="14">Ad Set 3</text>
                    {/* Individual budgets */}
                    <text x="90" y="80" textAnchor="middle" fill="#22c55e" fontSize="12">Budget: $200</text>
                    <text x="210" y="80" textAnchor="middle" fill="#22c55e" fontSize="12">Budget: $150</text>
                    <text x="330" y="80" textAnchor="middle" fill="#22c55e" fontSize="12">Budget: $150</text>
                </svg>
            </Box>
        );
    }
}

export default function CboDiagramModal({ opened, onClose }: CboDiagramModalProps) {
    const [mode, setMode] = useState<'on' | 'off'>('on');

    return (
        <Modal
            opened={opened}
            onClose={onClose}
            title={
                <Group>
                    <ThemeIcon color="green" variant="filled" radius="md">
                        <IconHierarchy3 size={18} />
                    </ThemeIcon>
                    <Text fw={600}>How Campaign Budget Optimization Works</Text>
                </Group>
            }
            size="lg"
            centered
        >
            <Stack>
                <SegmentedControl
                    value={mode}
                    onChange={v => setMode(v as 'on' | 'off')}
                    data={[
                        { label: 'CBO On', value: 'on' },
                        { label: 'CBO Off', value: 'off' }
                    ]}
                    fullWidth
                    mb={8}
                />


                <div style={{ width: '100%', height: 300 }}>
                    <ReactFlow nodes={nodes} edges={edges}>
                        <MiniMap />
                        <Controls />
                        <Background gap={16} />
                    </ReactFlow>
                </div>
            </Stack>
        </Modal>
    );
}
