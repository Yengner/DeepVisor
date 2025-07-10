"use client";
import { useState, useEffect } from "react";
import { useCampaignSubmit } from "@/components/campaigns/create/platforms/meta/hooks/useCampaignSubmit";
import { fetchExistingCreatives } from "@/lib/actions/meta/fetchExistingAds";

export default function TestComponent() {
    const {
        submitTestCampaign,
        isSubmitting,
        submitSuccess,
        submitError,
        campaignId
    } = useCampaignSubmit();

    // State for existing ads and creatives
    const [ads, setAds] = useState<any[]>([]);
    const [creatives, setCreatives] = useState<any[]>([]);
    const [selectedAdId, setSelectedAdId] = useState<string>("");
    const [selectedCreativeId, setSelectedCreativeId] = useState<string>("");
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    // Your Meta ad account ID
    const adAccountId = "782974607026594"; // Replace with your actual ad account ID

    // Fetch existing ads and creatives on component mount
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                const [creativesData] = await Promise.all([
                    // fetchExistingAds(adAccountId),
                    fetchExistingCreatives(adAccountId)
                ]);
                setCreatives(creativesData);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Error fetching data");
                console.error("Error loading Meta data:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [adAccountId]);

    // Run test campaign with existing ad IDs
    const handleTestLeadGenCampaign = async () => {
        const result = await submitTestCampaign('LEAD_GEN');
        console.log('Campaign creation result:', result);
    };

    // const handleTestTrafficCampaign = async () => {
    //     const result = await submitTestCampaign('TRAFFIC');
    //     console.log('Campaign creation result:', result);
    // };

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold mb-6">Meta Campaign Testing</h1>

            {loading && <div className="mb-4 text-blue-600">Loading existing ads and creatives...</div>}
            {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">{error}</div>}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">

                {/* Creative Selection */}
                <div className="border rounded p-4">
                    <h2 className="text-lg font-semibold mb-2">Select Existing Creative</h2>
                    <select
                        className="w-full p-2 border rounded"
                        value={selectedCreativeId}
                        onChange={(e) => setSelectedCreativeId(e.target.value)}
                    >
                        <option value="">-- Select a Creative --</option>
                        {creatives.map(creative => (
                            <option key={creative.id} value={creative.id}>
                                {creative.name || `Creative ${creative.id}`}
                            </option>
                        ))}
                    </select>
                    <div className="mt-2 text-sm text-gray-600">
                        {selectedCreativeId ? `Selected Creative ID: ${selectedCreativeId}` : 'No creative selected'}
                    </div>
                </div>
            </div>

            {/* Action Button */}
            <button
                onClick={handleTestLeadGenCampaign}
                disabled={isSubmitting}
                className="px-6 py-3 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 disabled:opacity-50"
            >
                {isSubmitting ? 'Creating campaign...' : 'Test Lead Gen Campaign with Selected IDs'}
            </button>

            {/* Results */}
            {isSubmitting && <p className="mt-4 text-blue-600">Creating campaign...</p>}
            {submitError && <p className="mt-4 p-3 bg-red-100 text-red-700 rounded">{submitError}</p>}
            {submitSuccess && (
                <div className="mt-4 p-4 bg-green-100 border border-green-400 rounded">
                    <h3 className="font-semibold">Campaign created successfully!</h3>
                    <p className="mt-2">Campaign ID: {campaignId}</p>
                </div>
            )}
        </div>
    );
}