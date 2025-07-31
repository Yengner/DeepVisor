import dagre from '@dagrejs/dagre';
import { Node, Edge, Position } from '@xyflow/react';

const dagreGraph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
const nodeWidth = 172;
const nodeHeight = 36;
//: { nodes: NodeType[]; edges: EdgeType[] } 

export function getLayoutedElements(
    nodes: Node[],
    edges: Edge[],
    direction: 'LR' | 'TB' = 'LR'
) {
    const isHorizontal = direction === 'LR';
    dagreGraph.setGraph({ rankdir: direction });

    nodes.forEach((node) => {
        dagreGraph.setNode(node.id, { width: node.width, height: node.height || node.initialHeight });
    });

    edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    const newNodes = nodes.map((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);
        const newNode = {
            ...node,
            targetPosition: isHorizontal ? Position.Left : Position.Top,
            sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
            // We are shifting the dagre node position (anchor=center center) to the top left
            // so it matches the React Flow node anchor point (top left).
            position: {
                x: nodeWithPosition.x - (node.width ?? nodeWidth) / 2,
                y: nodeWithPosition.y - (node.initialHeight ?? nodeHeight) / 2,
            },
        };
        console.log('new node', newNode);
        return newNode;
    });

    return { nodes: newNodes, edges };
}
