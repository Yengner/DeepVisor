import React, { useCallback } from 'react';
import {
    Background,
    ReactFlow,
    addEdge,
    ConnectionLineType,
    Panel,
    useNodesState,
    useEdgesState,
    useReactFlow,
    MiniMap,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { getLayoutedElements } from '../utils/layout';
import TransformNodesAndEdges from './Transform';
import Sidebar from './Sidebar';





export default function FlowWithProvider({ rawData }: any) {
    // const { nodes: layoutedNodes, edges: layoutedEdges } = TransformNodesAndEdges(rawData)

    const { layoutedNodes, layoutedEdges } = TransformNodesAndEdges(rawData);


    const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges);
    const reactFlowInstance = useReactFlow();

    const onConnect = useCallback(
        (params: any) =>
            setEdges((eds) =>
                addEdge({ ...params, type: ConnectionLineType.SmoothStep, animated: true }, eds),
            ),
        [],
    );
    const onLayout = useCallback(
        (direction: any) => {
            const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
                nodes,
                edges,
                direction,
            );

            setNodes([...layoutedNodes]);
            setEdges([...layoutedEdges]);
            setTimeout(() => {
                reactFlowInstance.fitView({ padding: 0.2 });
            }, 0);
        },
        [nodes, edges, setNodes, setEdges, reactFlowInstance],
    );

    return (

                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    connectionLineType={ConnectionLineType.SmoothStep}
                    fitView
                >
                    <Panel position="top-right">
                        <button
                            className="inline-flex items-center justify-center h-10 px-4 rounded-full border border-pink-600 bg-white text-pink-600 font-medium shadow transition hover:bg-pink-50 active:bg-pink-100 mr-2"
                            onClick={() => onLayout('TB')}
                        >
                            vertical layout
                        </button>
                        <button
                            className="inline-flex items-center justify-center h-10 px-4 rounded-full border border-pink-600 bg-white text-pink-600 font-medium shadow transition hover:bg-pink-50 active:bg-pink-100"
                            onClick={() => onLayout('LR')}
                        >
                            horizontal layout
                        </button>
                    </Panel>
                    <MiniMap
                        nodeColor={(n) => {
                            if (n.id.startsWith('uc')) return '#0041d0';      // Unified Campaign: blue
                            if (n.id.startsWith('camp')) return '#06b6d4';    // Campaign: cyan
                            if (n.id.startsWith('aset')) return '#22c55e';    // Ad Set: green
                            if (n.id.startsWith('ad')) return '#f59e42';      // Ad: orange
                            return '#ff0072';                                 // Default: pink
                        }}
                        nodeStrokeWidth={2}
                    />
                </ReactFlow>


    );
};
