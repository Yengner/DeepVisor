import { useEffect, useMemo, useState } from "react";
import { ReactFlow, Background, Node, Edge } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

/* eslint-disable */

interface MetaCampaignFlowPreviewProps {
    campaign: any; // should be the form object or null
    adSets: any[];
    budget?: { amount: number; type: string };
    creatives?: any; // not used, as creatives are inside adSets
}

export default function MetaCampaignFlowPreview({
    campaign,
    adSets,
    budget,
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
    }, [adSets.length, campaign?.values?.budget]);

    // Build nodes and edges based on form state
    const { nodes, edges } = useMemo(() => {
        const nodes: Node[] = [];
        const edges: Edge[] = [];

        if (campaign && campaign.values) {
            const c = campaign.values;
            nodes.push({
                id: "campaign",
                type: "input",
                position: { x: 250, y: 20 },
                data: {
                    label: (
                        <div style={{ textAlign: "center" }}>
                            <b>{c.campaign.campaignName || "Campaign"}</b>
                            <div style={{ fontSize: 12, color: "#22c55e" }}>
                                {c.budget.type === "lifetime"
                                    ? `Lifetime Budget: $${c.budget.amount}`
                                    : `Daily Budget: $${c.budget.amount}`}
                            </div>
                            <div style={{ marginTop: 8 }}>
                                <div style={{
                                    width: 120,
                                    height: 8,
                                    background: '#e0e7ef',
                                    borderRadius: 4,
                                    margin: '0 auto',
                                    overflow: 'hidden',
                                    position: 'relative',
                                }}>
                                    <div style={{
                                        width: `${budgetProgress}%`,
                                        height: '100%',
                                        background: '#22c55e',
                                        transition: 'width 0.2s',
                                    }} />
                                </div>
                                <div style={{ fontSize: 10, color: '#22c55e', marginTop: 2 }}>
                                    Budget Progress: {budgetProgress}%
                                </div>
                            </div>
                        </div>
                    ),
                },
                style: { border: "2px solid #22c55e", borderRadius: 8, background: "#e6f9ed" },
            });
        }

        // Ad Sets and Creatives
        adSets.forEach((adset, i) => {
            nodes.push({
                id: `adset-${i}`,
                type: "default",
                position: { x: 100 + i * 200, y: 150 },
                data: {
                    label: (
                        <div style={{ textAlign: "center" }}>
                            <b>{adset.adSetName || `Ad Set ${i + 1}`}</b>
                        </div>
                    ),
                },
                style: { border: "2px solid #2563eb", borderRadius: 8, background: "#e6f0fa" },
            });
            if (campaign && campaign.values) {
                edges.push({
                    id: `e-campaign-adset-${i}`,
                    source: "campaign",
                    target: `adset-${i}`,
                    animated: true,
                    style: { stroke: "#22c55e", strokeWidth: 2, opacity: budgetProgress / 100 },
                });
            }
            // Creatives for this ad set
            if (Array.isArray(adset.creatives)) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                adset.creatives.forEach((creative: any, j: number) => {
                    const creativeNodeId = `creative-${i}-${j}`;
                    nodes.push({
                        id: creativeNodeId,
                        type: "output",
                        position: { x: 100 + i * 200 + j * 60, y: 280 },
                        data: {
                            label: (
                                <div style={{ textAlign: "center" }}>
                                    <b>{creative.adHeadline || `Creative ${j + 1}`}</b>
                                </div>
                            ),
                        },
                        style: { border: "2px solid #f59e42", borderRadius: 8, background: "#fff7ed" },
                    });
                    edges.push({
                        id: `e-adset-${i}-creative-${j}`,
                        source: `adset-${i}`,
                        target: creativeNodeId,
                        style: { stroke: "#f59e42", strokeWidth: 2 },
                    });
                });
            }
        });

        return { nodes, edges };
    }, [campaign, adSets, budgetProgress]);

    if (!campaign || !campaign.values) {
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
