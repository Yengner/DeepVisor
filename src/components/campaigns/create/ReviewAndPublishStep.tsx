import { useCreateCampaignForm } from "@/hooks/context/CampaignFormContext";
import { createMetaCampaign } from "@/lib/actions/createMetaCampaign";
import { useState } from "react";

export default function ReviewAndPublishStep() {
    const { formData, goToPreviousStep } = useCreateCampaignForm();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handlePublish = async () => {
        setLoading(true);
        setError(null);

        const res = await createMetaCampaign();

        if (res.success) {
            // Optional: save campaign ID in DB or state if needed
            window.location.href = '/campaigns?status=created&id=';
        } else {
            setError('Failed to publish campaign.');
            setLoading(false);
        }
    };

    return (
        <div>
            <h2 className="text-xl font-semibold mb-4">Review and Publish</h2>
            <pre className="bg-gray-100 p-4 rounded text-sm">{JSON.stringify(formData, null, 2)}</pre>

            {error && <p className="text-red-600 mt-4">{error}</p>}
            {loading && <p className="text-gray-500 mt-2">Publishing your campaign...</p>}

            <div className="flex justify-between mt-6">
                <button onClick={goToPreviousStep} className="text-emerald-600 hover:underline">
                    ← Back
                </button>
                <button
                    onClick={handlePublish}
                    disabled={loading}
                    className="bg-emerald-700 text-white px-6 py-2 rounded disabled:opacity-60"
                >
                    {loading ? 'Publishing...' : 'Publish Campaign'}
                </button>
            </div>
        </div>
    );
}
