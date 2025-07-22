import { useEffect, useMemo, useState } from "react";
import { ReactFlow, Background, Controls, MiniMap, Node, Edge, Position } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

interface MetaCampaignFlowPreviewProps {
    campaign: { name: string; budget: number; budgetType: string } | null;
    adSets: { name: string; budget?: number }[];
    creatives: { name: string }[];
}

export default function MetaCampaignFlowPreview({
    campaign,
    adSets,
    creatives,
}: MetaCampaignFlowPreviewProps) {
    // Animate budget distribution
    const [budgetProgress, setBudgetProgress] = useState(0);

    useEffect(() => {
        setBudgetProgress(0);
        if (adSets.length > 0) {
            const interval = setInterval(() => {
                setBudgetProgress((p) => (p < 100 ? p + 10 : 100));
            }, 100);
            return () => clearInterval(interval);
        }
    }, [adSets.length, campaign?.budget]);

    // Build nodes and edges based on form state
    const { nodes, edges } = useMemo(() => {
        const nodes: Node[] = [];
        const edges: Edge[] = [];

        if (campaign) {
            nodes.push({
                id: "campaign",
                type: "input",
                position: { x: 250, y: 20 },
                data: {
                    label: (
                        <div style={{ textAlign: "center" }}>
                            <b>{campaign.name || "Campaign"}</b>
                            <div style={{ fontSize: 12, color: "#22c55e" }}>
                                {campaign.budgetType === "lifetime"
                                    ? `Lifetime Budget: $${campaign.budget.amount}`
                                    : `Daily Budget: $${campaign.budget.amount}`}
                            </div>
                        </div>
                    ),
                },
                style: { border: "2px solid #22c55e", borderRadius: 8, background: "#e6f9ed" },
            });
        }

        adSets.forEach((adset, i) => {
            nodes.push({
                id: `adset-${i}`,
                type: "default",
                position: { x: 100 + i * 200, y: 150 },
                data: {
                    label: (
                        <div style={{ textAlign: "center" }}>
                            <b>{adset.name || `Ad Set ${i + 1}`}</b>
                            {/* <div style={{ fontSize: 12, color: "#2563eb" }}>
                {campaign?.budgetType === "lifetime"
                  ? `Budget: $${Math.round((campaign.budget.amount / adSets.length) * (budgetProgress / 100))}`
                  : `Budget: $${Math.round((campaign.budget.amount / adSets.length) * (budgetProgress / 100))} / day`}
              </div> */}
                        </div>
                    ),
                },
                style: { border: "2px solid #2563eb", borderRadius: 8, background: "#e6f0fa" },
            });
            if (campaign) {
                edges.push({
                    id: `e-campaign-adset-${i}`,
                    source: "campaign",
                    target: `adset-${i}`,
                    animated: true,
                    style: { stroke: "#22c55e", strokeWidth: 2, opacity: budgetProgress / 100 },
                });
            }
        });

        creatives.forEach((creative, i) => {
            nodes.push({
                id: `creative-${i}`,
                type: "output",
                position: { x: 100 + i * 200, y: 280 },
                data: {
                    label: (
                        <div style={{ textAlign: "center" }}>
                            <b>{creative.name || `Creative ${i + 1}`}</b>
                        </div>
                    ),
                },
                style: { border: "2px solid #f59e42", borderRadius: 8, background: "#fff7ed" },
            });
            // Connect each creative to its ad set (simple: 1:1 mapping)
            if (adSets[i]) {
                edges.push({
                    id: `e-adset-${i}-creative-${i}`,
                    source: `adset-${i}`,
                    target: `creative-${i}`,
                    style: { stroke: "#f59e42", strokeWidth: 2 },
                });
            }
        });

        return { nodes, edges };
    }, [campaign, adSets, creatives, budgetProgress]);

    if (!campaign) {
        return (
            <div style={{ textAlign: "center", color: "#888", padding: 32 }}>
                <b>Fill out campaign details to see a live preview</b>
            </div>
        );
    }

    return (
        <div style={{ width: "100%", height: 340, background: "#f8fafc", borderRadius: 12 }}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                fitView
                panOnDrag={false}
                zoomOnScroll={false}
                zoomOnPinch={false}
                panOnScroll={false}
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable={false}
                proOptions={{ hideAttribution: true }}
            >
                <Background color="#e0e7ef" gap={24} />
            </ReactFlow>
        </div>
    );
}
