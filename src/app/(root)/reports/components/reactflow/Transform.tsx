'use client';

import { Node, Edge, Position } from "@xyflow/react";
import { getLayoutedElements } from "../../../../../components/reactFlow/utils/layout";

export default function TransformNodesAndEdges(raw: RawData) {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    // Create a unified campaign node
    // const uId = "uc-1";
    // nodes.push({
    //     id: uId,
    //     data: { label: "Meta Unified Campaign" },
    //     position: { x: 0, y: 0 },
    //     type: 'input',
    //     sourcePosition: Position.Right,
    //     // no targetPosition ⇒ no incoming handle
    // });

    raw.forEach((camp, ci) => {
        const campNodeId = `camp-${camp.id}`;
        // Campaign node
        nodes.push({
            id: campNodeId,
            data: { label: camp.name },
            position: { x: 0, y: ci * 200 },
            sourcePosition: Position.Right,    // only outgoing
        });

        // Edge Unified Campaign→Campaign
        // edges.push({
        //     id: `e-${uId}-${campNodeId}`,
        //     source: uId,
        //     target: campNodeId,
        //     type: 'smoothstep',
        //     animated: true,
        // });

        // Edge: (will fill when ad-sets are added)
        camp.adset_metrics.forEach((aset, ai) => {
            const asetNodeId = `aset-${aset.id}`;
            // AdSet node
            nodes.push({
                id: asetNodeId,
                data: { label: aset.name },
                position: { x: 300, y: ci * 200 + ai * 120 },
                targetPosition: Position.Left,
                sourcePosition: Position.Right,
            });
            // Edge Campaign→AdSet
            edges.push({
                id: `e-${campNodeId}-${asetNodeId}`,
                source: campNodeId,
                target: asetNodeId,
                type: 'smoothstep',
                animated: true,
            });

            aset.ads_metrics.forEach((ad, adi) => {
                const adNodeId = `ad-${ad.id}`;
                // Ad node
                nodes.push({
                    id: adNodeId,
                    data: { label: ad.name },
                    position: { x: 600, y: ci * 200 + ai * 120 + adi * 80 },
                    targetPosition: Position.Left,
                });
                // Edge AdSet→Ad
                edges.push({
                    id: `e-${asetNodeId}-${adNodeId}`,
                    source: asetNodeId,
                    target: adNodeId,
                    type: 'smoothstep',
                    animated: true,
                });
            });
        });
    });
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        nodes,
        edges,
    );

    return { layoutedNodes, layoutedEdges };
}