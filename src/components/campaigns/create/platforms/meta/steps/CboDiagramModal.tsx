import { Modal, Text, Group, ThemeIcon, Stack, SegmentedControl } from '@mantine/core';
import { IconHierarchy3 } from '@tabler/icons-react';
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
