'use client';

import { Modal } from '@mantine/core';
import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/utils/supabase/clients/browser';
import { ReactFlow, Background, Node, Edge, Panel } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { getLayoutedElements } from '@/components/reactFlow/utils/layout';
import { useRouter } from 'next/navigation';
import { CustomNode } from '@/components/reactFlow/nodes/nodes';

/* eslint-disable */

export interface ProgressEntry {
    id: string;
    job_id: string;
    step: string;
    status: string;
    meta: Record<string, any> | null;
    created_at: string;
}

interface ProgressModalProps {
    jobId: string;
    opened: boolean;
    onClose: () => void;
    nodes: Node[];
    edges: Edge[];
}

function getNodeColor(status: string) {
    switch (status) {
        case "loading": return "#facc15";
        case "completed": return "#22c55e";
        case "failed": return "#ef4444";
        default: return "#e0e7ef";
    }
}


export function ProgressModal({ jobId, opened, onClose, nodes: propNodes, edges: propEdges }: ProgressModalProps) {
    const [progress, setProgress] = useState<ProgressEntry[]>([]);
    const supabase = createClient();
    const router = useRouter();

    const nodeTypes = {
        customNode: CustomNode,
    };


    useEffect(() => {
        if (!opened) return;
        const channel = supabase
            .channel(`campaign-progress-${jobId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'campaign_job_progress',
                    filter: `job_id=eq.${jobId}`,
                },
                (payload) => {
                    const newEntry = payload.new as ProgressEntry;
                    setProgress((prev) => [...prev, newEntry]);
                }
            )
            .subscribe();

        (async () => {
            const { data } = await supabase
                .from('campaign_job_progress')
                .select('*')
                .eq('job_id', jobId)
                .order('created_at', { ascending: true });
            if (data) setProgress(data);
        })();

        return () => {
            supabase.removeChannel(channel);
        };

    }, [jobId, opened]);

    // Always use provided nodes/edges, layout and style them by status
    const flow = useMemo(() => {

        const nodes = (propNodes || []).map((node) => {

            return {
                ...node,
                style: {
                    ...(node.style || {}),

                },
                data: {
                    ...node.data,
                    progress,
                    label: (
                        node.data.label
                    ),
                    type: node.data.type,
                },
            };
        });

        const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(nodes, propEdges, 'TB');
        return { nodes: layoutedNodes, edges: layoutedEdges };
    }, [propNodes, propEdges, progress]);

    const functionDone = progress.some(
        (p) => p.step === 'function' && p.status === 'success'
    );

    return (
        <Modal
            opened={opened}
            onClose={onClose}
            closeOnClickOutside={true}
            centered
            size={'80%'}

        >
            <div style={{ width: "100%", height: 800 }}>
                <ReactFlow
                    nodes={flow.nodes}
                    edges={flow.edges}
                    nodeTypes={nodeTypes}
                    fitView
                    fitViewOptions={{ padding: 0.4 }}
                    panOnDrag={false}
                    panOnScroll={false}
                    nodesDraggable={false}
                    nodesConnectable={false}
                    proOptions={{ hideAttribution: true }}
                >
                    <Background gap={24} />

                    <Panel position="top-right" >
                        <button className="inline-flex items-center justify-center h-10 px-4 rounded-full border border-pink-600 bg-white text-pink-600 font-medium shadow transition hover:bg-pink-50 active:bg-pink-100 mr-2 disabled:opacity-50"
                            onClick={() => router.push(`/campaigns`)}
                            disabled={!functionDone}>
                            Done
                        </button>
                    </Panel>


                </ReactFlow>

            </div>
        </Modal>
    );
}

