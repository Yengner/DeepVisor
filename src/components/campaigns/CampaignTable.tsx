'use client';

import { useState } from 'react';
import { Switch } from '@headlessui/react';
import { cn } from '@/lib/utils/utils';
import { useRouter } from 'next/navigation';

interface Campaign {
    id: string;
    name: string;
    delivery: boolean;
    type: 'AI Auto' | 'Manual' | 'Semi-Auto';
    status: string;
    objective: string;
    startDate: string;
    endDate: string;
    attribution: string;
    results: string;
    reach: number;
    views: number;
    impressions: number;
    frequency: number;
    costPerResult: string;
}


export default function CampaignTable({ campaigns }: { campaigns: Campaign[] }) {
    const [campaignData, setCampaignData] = useState(campaigns);

    const router = useRouter();

    const toggleCampaign = (id: string) => {
        setCampaignData((prev) =>
            prev.map((c) => (c.id === id ? { ...c, delivery: !c.delivery } : c))
        );
    };

    const handleCreate = () => {
        router.push('/campaigns/create'); // ⬅️ redirect to create page
    };


    return (

        <div className="w-full bg-white border rounded-xl shadow-sm">
            <div className="flex items-center justify-between px-4 py-3 border-b">
                <h2 className="text-lg font-semibold">Campaigns</h2>
                <button className="bg-emerald-600 text-white px-4 py-2 rounded-md hover:bg-emerald-700"
                    onClick={handleCreate}>
                    + Create
                </button>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-[1200px] w-full text-sm text-left">
                    <thead className="bg-gray-100 text-gray-600">
                        <tr>
                            <th className="px-4 py-2 font-medium">Off / On</th>
                            <th className="px-4 py-2 font-medium">Campaign</th>
                            <th className="px-4 py-2 font-medium">Type</th>
                            <th className="px-4 py-2 font-medium">Status</th>
                            <th className="px-4 py-2 font-medium">Objective</th>
                            <th className="px-4 py-2 font-medium">Start Date</th>
                            <th className="px-4 py-2 font-medium">End Date</th>
                            <th className="px-4 py-2 font-medium">Delivery</th>
                            <th className="px-4 py-2 font-medium">Attribution</th>
                            <th className="px-4 py-2 font-medium">Results</th>
                            <th className="px-4 py-2 font-medium">Reach</th>
                            <th className="px-4 py-2 font-medium">Views</th>
                            <th className="px-4 py-2 font-medium">Impressions</th>
                            <th className="px-4 py-2 font-medium">Frequency</th>
                            <th className="px-4 py-2 font-medium">Cost / Result</th>
                        </tr>
                    </thead>
                    <tbody>
                        {campaignData.map((campaign) => (
                            <tr key={campaign.id} className="border-b hover:bg-gray-50">
                                <td className="px-4 py-2">
                                    <Switch
                                        checked={campaign.delivery}
                                        onChange={() => toggleCampaign(campaign.id)}
                                        className={cn(
                                            campaign.delivery ? 'bg-emerald-600' : 'bg-gray-300',
                                            'relative inline-flex h-5 w-9 items-center rounded-full transition'
                                        )}
                                    >
                                        <span className="sr-only">Enable Campaign</span>
                                        <span
                                            className={cn(
                                                campaign.delivery ? 'translate-x-5' : 'translate-x-1',
                                                'inline-block h-3 w-3 transform rounded-full bg-white transition'
                                            )}
                                        />
                                    </Switch>
                                </td>
                                <td className="px-4 py-2 font-medium truncate max-w-[350px] text-emerald-700 hover:underline cursor-pointer">
                                    {campaign.name}
                                </td>
                                <td className="px-4 py-2">{campaign.type}</td>
                                <td className="px-4 py-2">{campaign.status}</td>
                                <td className="px-4 py-2">{campaign.objective}</td>
                                <td className="px-4 py-2">{campaign.startDate}</td>
                                <td className="px-4 py-2">{campaign.endDate ?? '—'}</td>
                                <td className="px-4 py-2">{campaign.delivery ? 'On' : 'Off'}</td>
                                <td className="px-4 py-2">{campaign.attribution}</td>
                                <td className="px-4 py-2">{campaign.results}</td>
                                <td className="px-4 py-2">{campaign.reach}</td>
                                <td className="px-4 py-2">{campaign.views}</td>
                                <td className="px-4 py-2">{campaign.impressions}</td>
                                <td className="px-4 py-2">{campaign.frequency}</td>
                                <td className="px-4 py-2">{campaign.costPerResult}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
