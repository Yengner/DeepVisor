'use client';

import { useCreateCampaignForm } from "@/hooks/context/CampaignFormContext";


export default function ReviewAndPublishStep() {
    const { formData, goToPreviousStep } = useCreateCampaignForm();

    const handlePublish = () => {

    };

    return (
        <div>
            <h2 className="text-xl font-semibold mb-4">Review and Publish</h2>
            <pre className="bg-gray-100 p-4 rounded text-sm">{JSON.stringify(formData, null, 2)}</pre>

            <div className="flex justify-between mt-6">
                <button onClick={goToPreviousStep} className="text-emerald-600 hover:underline">← Back</button>
                <button onClick={handlePublish} className="bg-emerald-700 text-white px-6 py-2 rounded">
                    Publish Campaign
                </button>
            </div>
        </div>
    );
}
