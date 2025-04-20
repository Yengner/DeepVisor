'use client';

import { Switch } from "@headlessui/react";
import { cn } from "@/lib/utils/utils";
import { useRouter } from "next/navigation";
import React from "react";

interface CampaignObjects {
    id: string;
    name: string;
    delivery: boolean;
    type: "AI Auto" | "Manual" | "Semi-Auto";
    status: string;
    objective: string;
    startDate: string;
    endDate: string;
    attribution: string;
    spend?: number;
    results?: string;
    reach?: number;
    clicks?: number;
    impressions?: number;
    frequency?: string;
    costPerResult?: string;
    cpm?: number;
    ctr?: number;
    cpc?: number;
    platform?: string;
}

interface CampaignTableProps {
    campaigns: CampaignObjects[];
    selectedCampaignId?: string;
    onSelectCampaign: (campaignId: string) => void;
    onToggleCampaign: (campaignId: string, newStatus: boolean) => void;
    onDeleteCampaign: (campaignId: string) => void;
}

const getPlatformImage = (platform?: string) => {
    switch ((platform || "meta").toLowerCase()) {
        case "meta":
            return "/images/platforms/logo/meta.png";
        case "tiktok":
            return "/images/tiktok.png";
        // add more cases as needed for other platforms
        default:
            return "/images/default.png";
    }
};


export default function CampaignTable({
    campaigns,
    selectedCampaignId,
    onSelectCampaign,
    onToggleCampaign,
    onDeleteCampaign,
}: CampaignTableProps) {
    const router = useRouter();

    const CheckIcon = () => (
        <svg
            className="w-4 h-4 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
        >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
        </svg>
    );

    return (
        <div className="w-full bg-white border rounded-xl shadow-sm">
            <div className="flex items-center justify-between px-4 py-3 border-b">
                <h2 className="text-lg font-semibold">Campaigns</h2>
                <button
                    disabled
                    className="bg-emerald-600 disabled-button text-white px-4 py-2 rounded-md hover:bg-emerald-700"
                    onClick={() => router.push("/campaigns/create")}
                >
                    + Create
                </button>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-[1200px] w-full text-sm text-left">
                    <thead className="bg-gray-100 text-gray-600">
                        <tr>
                            {/* Select column */}
                            <th className="px-4 py-2 font-medium text-center">Select</th>
                            <th className="px-4 py-2 font-medium">Platform</th>
                            <th className="px-4 py-2 font-medium">Off / On</th>
                            <th className="px-4 py-2 font-medium">Campaign</th>
                            <th className="px-4 py-2 font-medium">Type</th>
                            <th className="px-4 py-2 font-medium">Status</th>
                            <th className="px-4 py-2 font-medium">Objective</th>
                            <th className="px-4 py-2 font-medium">Start Date</th>
                            <th className="px-4 py-2 font-medium">End Date</th>
                            <th className="px-4 py-2 font-medium">Delivery</th>
                            <th className="px-4 py-2 font-medium">Attribution</th>
                            <th className="px-4 py-2 font-medium">Spend</th>
                            <th className="px-4 py-2 font-medium">Results</th>
                            <th className="px-4 py-2 font-medium">Reach</th>
                            <th className="px-4 py-2 font-medium">Clicks</th>
                            <th className="px-4 py-2 font-medium">Impressions</th>
                            <th className="px-4 py-2 font-medium">Frequency</th>
                            <th className="px-4 py-2 font-medium">Cost / Result</th>
                            <th className="px-4 py-2 font-medium">cpm</th>
                            <th className="px-4 py-2 font-medium">ctr</th>
                            <th className="px-4 py-2 font-medium">cpc</th>
                        </tr>
                    </thead>
                    <tbody>
                        {campaigns.map((campaign) => (
                            <React.Fragment key={campaign.id}>

                                <tr
                                    key={campaign.id}
                                    className={cn(
                                        "border-b cursor-pointer hover:bg-gray-50",
                                        selectedCampaignId === campaign.id ? "bg-blue-50" : ""
                                    )}
                                    onClick={() => onSelectCampaign(campaign.id)}
                                >
                                    {/* Select indicator */}
                                    <td className="px-4 py-2 text-center">
                                        {selectedCampaignId === campaign.id ? (
                                            <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                                                <CheckIcon />
                                            </div>
                                        ) : (
                                            <div className="w-5 h-5 rounded-full border border-gray-300" />
                                        )}
                                    </td>

                                    {/* Platform Icon */}
                                    <td className="px-4 py-2">
                                        <img
                                            src={getPlatformImage(campaign.platform)}
                                            alt={campaign.platform || "Meta"}
                                            className="w-8 h-8 rounded-full"
                                        />
                                    </td>

                                    {/* Off / On toggle */}
                                    <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                                        <Switch
                                            checked={campaign.delivery}
                                            onChange={(checked) => onToggleCampaign(campaign.id, checked)}
                                            className={cn(
                                                "relative inline-flex h-5 w-9 items-center rounded-full",
                                                // animate only background‐color, 200ms, ease‑in‑out
                                                campaign.delivery
                                                    ? "bg-emerald-600"
                                                    : "bg-gray-300",
                                                "transition-colors duration-200 ease-in-out"
                                            )}
                                        >
                                            <span className="sr-only">Enable Campaign</span>
                                            <span
                                                className={cn(
                                                    // move from x=1 to x=5
                                                    campaign.delivery ? "translate-x-5" : "translate-x-1",
                                                    // animate only transform, 200ms, ease‑in‑out
                                                    "inline-block h-3 w-3 transform rounded-full bg-white transition-transform duration-200 ease-in-out"
                                                )}
                                            />
                                        </Switch>

                                    </td>

                                    {/* Campaign details */}
                                    <td className="px-4 py-2 font-medium truncate max-w-[350px] text-emerald-700 hover:underline">
                                        {campaign.name}
                                    </td>
                                    <td className="px-4 py-2">{campaign.type}</td>
                                    <td className="px-4 py-2">{campaign.status}</td>
                                    <td className="px-4 py-2">{campaign.objective}</td>
                                    <td className="px-4 py-2 truncate">{campaign.startDate}</td>
                                    <td className="px-4 py-2 truncate">{campaign.endDate ?? "—"}</td>
                                    <td className="px-4 py-2">{campaign.delivery ? "On" : "Off"}</td>
                                    <td className="px-4 py-2">{campaign.attribution}</td>
                                    <td className="px-4 py-2">{campaign.spend}</td>
                                    <td className="px-4 py-2">{campaign.results}</td>
                                    <td className="px-4 py-2">{(campaign.reach)?.toLocaleString()}</td>
                                    <td className="px-4 py-2">{(campaign.clicks)?.toLocaleString()}</td>
                                    <td className="px-4 py-2">{(campaign.impressions)?.toLocaleString()}</td>
                                    <td className="px-4 py-2">{campaign.frequency}</td>
                                    <td className="px-4 py-2">{campaign.costPerResult}</td>
                                    <td className="px-4 py-2">{campaign.cpm}</td>
                                    <td className="px-4 py-2">{campaign.ctr}</td>
                                    <td className="px-4 py-2">{campaign.cpc}</td>
                                </tr>

                                {/* Bottom row for selected campaign */}
                                {selectedCampaignId === campaign.id && (
                                    <tr
                                        className="bg-gray-50">
                                        <td colSpan={21} className="px-4 py-3">
                                            <div className="flex items-center space-x-4">
                                                <div className="text-sm text-gray-600">
                                                    Selected campaign: <span className="font-semibold">{campaign.name}</span>
                                                </div>
                                                <div className="space-x-2">
                                                    <button
                                                        className="px-1 rounded-md text-sm  text-primary-accent hover:text-[#788ebb]"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            // Go to edit page
                                                            router.push(`/campaigns/${campaign.id}/edit`);
                                                        }}
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        className="px-1 rounded-md text-sm text-red-500 hover:text-red-200"
                                                        onClick={async (e) => {
                                                            e.stopPropagation();
                                                            const confirm = window.confirm(`Are you sure you want to delete ${campaign.name}?`);
                                                            if (!confirm) return;
                                                            else {
                                                                onDeleteCampaign?.(campaign.id);
                                                            }
                                                        }}
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </React.Fragment>

                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
