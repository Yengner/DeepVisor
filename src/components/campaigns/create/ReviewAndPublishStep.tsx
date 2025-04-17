import { useCreateCampaignForm } from "@/hooks/context/CampaignFormContext";
import { createMetaCampaign } from "@/lib/actions/createMetaCampaign";
import { getLoggedInUser } from "@/lib/actions/user.actions";
import { useState } from "react";

export default function ReviewAndPublishStep() {
    const { formData, goToPreviousStep } = useCreateCampaignForm();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handlePublish = async () => {
        const loggedIn = await getLoggedInUser();
        const userId = loggedIn?.id;
        setLoading(true);
        setError(null);

        const res = await createMetaCampaign(formData);

        const response = await fetch('/api/campaign/refreshCampaignData', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ userId }),
        });
        if (!response.ok) {
            throw new Error('Failed to refresh campaigns data');
        }


        if (res.success) {
            window.location.href = '/campaigns';
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
