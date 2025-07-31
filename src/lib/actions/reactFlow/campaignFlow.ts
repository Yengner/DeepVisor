import { Node, Edge } from "@xyflow/react";

export function generateCampaignFlow(
    form: any // eslint-disable-line @typescript-eslint/no-explicit-any
): { nodes: Node[]; edges: Edge[] } {


    const nodes: Node[] = [];
    const edges: Edge[] = [];

    nodes.push({
        id: "campaign",
        type: "customNode",
        position: { x: 250, y: 0 },
        width: 200,
        initialHeight: 100,
        data: { type: "input", label: "Campaign", step: "campaign" },
    });

    // For each ad set
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    form.adSets.forEach((adSet: any, i: any) => {
        const adSetId = `adset-${i}`;
        nodes.push({
            id: adSetId,
            type: "customNode",
            position: { x: 100, y: (i + 1) * 150 },
            width: 200,
            initialHeight: 100,
            data: { type: "default", label: `Ad Set ${i + 1}: ${adSet.adSetName || "Untitled"}`, step: adSetId },
        });
        edges.push({
            id: `e-campaign-${adSetId}`,
            source: "campaign",
            target: adSetId,
            animated: true,
            type: "smoothstep",
        });

        // For each creative in ad set
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        adSet.creatives.forEach((creative: any, j: any) => {
            const creativeId = `creative-${i}-${j}`;
            nodes.push({
                id: creativeId,
                type: "customNode",
                position: { x: 400, y: (i + 1) * 150 + j * 80 },
                width: 160,
                initialHeight: 100,

                data: { type: "default", label: `Creative ${j + 1}`, step: creativeId },
            });
            edges.push({
                id: `e-${adSetId}-${creativeId}`,
                source: adSetId,
                target: creativeId,
                animated: true,
                type: "smoothstep",
            });

            // Ad node
            const adId = `ad-${i}-${j}`;
            nodes.push({
                id: adId,
                type: "customNode",
                position: { x: 650, y: (i + 1) * 150 + j * 80 },
                width: 120,
                initialHeight: 100,

                data: { type: "output", label: `Ad ${j + 1}`, step: adId },
            });
            edges.push({
                id: `e-${creativeId}-${adId}`,
                source: creativeId,
                target: adId,
                animated: true,
                type: "smoothstep",
            });
        });
    });

    return { nodes, edges };
}
