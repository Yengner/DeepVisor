"use client";

import { useState } from "react";

type DraftRow = {
    id: string;
    status: string;
    step?: string | null;
    version: number;
    payload_json: any; // eslint-disable-line @typescript-eslint/no-explicit-any
};

export default function DraftEditor({ initialDraft }: { initialDraft: DraftRow }) {
    const [draft] = useState<DraftRow>(initialDraft);
    const [payload, setPayload] = useState<any>(initialDraft.payload_json); // eslint-disable-line @typescript-eslint/no-explicit-any
    const draftId = initialDraft.id;

    // useEffect(() => {
    //     const channel = supabase
    //         .channel(`draft-${draftId}`)
    //         .on(
    //             "postgres_changes",
    //             { event: "*", schema: "public", table: "campaign_drafts", filter: `id=eq.${draftId}` },
    //             (msg) => {
    //                 setDraft(msg.new as DraftRow);
    //                 // if payload was changed elsewhere and you want to reflect it:
    //                 if ((msg.new as any)?.payload_json) setPayload((msg.new as any).payload_json);
    //             }
    //         )
    //         .subscribe();

    //     return () => { supabase.removeChannel(channel); };
    // }, [draftId]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const update = (path: string, value: any) => {
        const next = structuredClone(payload);
        const keys = path.split(".");
        let ref = next;
        while (keys.length > 1) ref = ref[keys.shift() as any]; // eslint-disable-line @typescript-eslint/no-explicit-any
        ref[keys[0]] = value;
        setPayload(next);
    };

    const saveEdits = async () => {
        await fetch(`/api/campaign/draft/${draftId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ payload, version: draft.version }) // optimistic concurrency
        });
    };

    const approve = async () => {
        await fetch(`/api/campaign/draft/${draftId}/approve`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ approved: true, payload })
        });
        // Optionally redirect or toast here
    };

    const deny = async () => {
        await fetch(`/api/campaign/draft/${draftId}/deny`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reason: "User declined" })
        });
    };

    return (
        <main className="p-6 max-w-2xl mx-auto space-y-6">
            <header className="flex items-center justify-between">
                <h1 className="text-xl font-semibold">Review Campaign Draft</h1>
                <div className="text-sm text-gray-600">
                    <b>Status:</b> {draft.status} &nbsp;|&nbsp; <b>Step:</b> {draft.step ?? "—"}
                </div>
            </header>

            <section className="space-y-2">
                <label className="block text-sm">Campaign Name</label>
                <input
                    className="border rounded p-2 w-full"
                    value={payload.campaign.campaignName}
                    onChange={(e) => update("campaign.campaignName", e.target.value)}
                />
            </section>

            <section className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm">Budget Amount ($)</label>
                    <input
                        className="border rounded p-2 w-full"
                        type="number"
                        value={payload.budget.amount}
                        onChange={(e) => update("budget.amount", Number(e.target.value))}
                    />
                </div>
                <div>
                    <label className="block text-sm">Budget Type</label>
                    <select
                        className="border rounded p-2 w-full"
                        value={payload.budget.type}
                        onChange={(e) => update("budget.type", e.target.value)}
                    >
                        <option value="daily">daily</option>
                        <option value="lifetime">lifetime</option>
                    </select>
                </div>
            </section>

            {/* Add more fields as needed: schedule start/end, adset name, geo, etc. */}

            <div className="flex gap-3">
                <button onClick={saveEdits} className="px-4 py-2 border rounded">Save</button>
                <button onClick={approve} className="px-4 py-2 bg-green-600 text-white rounded">Approve</button>
                <button onClick={deny} className="px-4 py-2 bg-gray-200 rounded">Deny</button>
            </div>
        </main>
    );
}
