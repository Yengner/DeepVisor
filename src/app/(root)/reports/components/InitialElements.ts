import { Position, Node } from "@xyflow/react";

const position = { x: 0, y: 0 };

export const initialNodes: Node[] = [
    {
        id: 'uc-1',
        type: 'input',
        data: { label: 'Unified: Leads Campaign' },
        position: position,
        sourcePosition: Position.Right,
    },
    {
        id: 'meta-1',
        data: { label: 'Meta Campaign A' },
        position: position,
        targetPosition: Position.Left,
        sourcePosition: Position.Right,
    },
    {
        id: 'meta-2',
        data: { label: 'Meta Campaign B' },
        position: position,
        targetPosition: Position.Left,
        sourcePosition: Position.Right,
    },
    {
        id: 'meta-3',
        data: { label: 'Meta Campaign C' },
        position: position,
        targetPosition: Position.Left,
        sourcePosition: Position.Right,
    },
    {
        id: 'meta-4',
        data: { label: 'Meta Campaign D' },
        position: position,
        targetPosition: Position.Left,
        sourcePosition: Position.Right,
    },
    {
        id: 'meta-5',
        data: { label: 'Meta Campaign E' },
        position: position,
        targetPosition: Position.Left,
        sourcePosition: Position.Right,
    },
    {
        id: 'meta-6',
        data: { label: 'Meta Campaign F' },
        position: position,
        targetPosition: Position.Left,
        sourcePosition: Position.Right,
    },
    {
        id: 'meta-7',
        data: { label: 'Meta Campaign G' },
        position: position,
        targetPosition: Position.Left,
        sourcePosition: Position.Right,
    }
];

export const initialEdges = [
    {
        id: 'e1',
        source: 'uc-1',
        target: 'meta-1',
        type: 'smoothstep',
        animated: true
    },
    {
        id: 'e2',
        source: 'uc-1',
        target: 'meta-2',
        type: 'smoothstep',
        animated: true
    },
    {
        id: 'e3',
        source: 'uc-1',
        target: 'meta-3',
        type: 'smoothstep',
        animated: true
    },
    {
        id: 'e4',
        source: 'uc-1',
        target: 'meta-4',
        type: 'smoothstep',
        animated: true
    },
    {
        id: 'e5',
        source: 'uc-1',
        target: 'meta-5',
        type: 'smoothstep',
        animated: true
    },
    {
        id: 'e6',
        source: 'uc-1',
        target: 'meta-6',
        type: 'smoothstep',
        animated: true
    },
    {
        id: 'e7',
        source: 'uc-1',
        target: 'meta-7',
        type: 'smoothstep',
        animated: true
    },
];