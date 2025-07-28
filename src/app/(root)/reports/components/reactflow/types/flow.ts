// types/flow.ts
import type {
    Node as RFNodeBase,
    Edge as RFEdgeBase,
    BuiltInNode,
    BuiltInEdge,
} from '@xyflow/react';

// 1.1 Upper Campaign Node
export type UpperNodeData = { label: string };
export type UpperNode = RFNodeBase<UpperNodeData, 'unified'>;

// 1.2 Platform Campaign Node
export type PlatformNodeData = { label: string };
export type PlatformNode = RFNodeBase<PlatformNodeData, 'platform'>;

// 1.3 Ad Set Node
export type AdsetNodeData = { label: string };
export type AdsetNode = RFNodeBase<AdsetNodeData, 'adset'>;

// 1.4 Ad Node
export type AdNodeData = { label: string };
export type AdNode = RFNodeBase<AdNodeData, 'ad'>;

// 1.5 Union of all node types
export type NodeType = UpperNode | PlatformNode | AdsetNode | AdNode | BuiltInNode;

// 1.6 Custom edge type (you can extend this)
export type ReportEdgeData = { type: 'reportLink' };
export type ReportEdge = RFEdgeBase<ReportEdgeData, 'smoothstep'>;

// 1.7 Union of edges
export type EdgeType = ReportEdge | BuiltInEdge;
