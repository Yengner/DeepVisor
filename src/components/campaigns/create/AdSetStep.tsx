'use client';

import { useCreateCampaignForm } from "@/hooks/context/CampaignFormContext";


export default function AdSetStep() {
    const { formData, updateFormData, goToNextStep, goToPreviousStep } = useCreateCampaignForm();

    return (
        <div>
            <h2 className="text-xl font-semibold mb-4">Ad Set Details</h2>
            <div className="space-y-4">
                <input
                    type="number"
                    placeholder="Daily Budget ($)"
                    className="w-full p-2 border rounded"
                    value={formData.budget || ''}
                    onChange={(e) => updateFormData({ budget: Number(e.target.value) })}
                />
                <input
                    type="text"
                    placeholder="Location (e.g., New York, USA)"
                    className="w-full p-2 border rounded"
                    value={formData.location || ''}
                    onChange={(e) => updateFormData({ location: e.target.value })}
                />
                <input
                    type="text"
                    placeholder="Audience Targeting (optional)"
                    className="w-full p-2 border rounded"
                    value={formData.targeting || ''}
                    onChange={(e) => updateFormData({ targeting: e.target.value })}
                />
            </div>

            <div className="flex justify-between mt-6">
                <button onClick={goToPreviousStep} className="text-emerald-600 hover:underline">← Back</button>
                <button onClick={goToNextStep} className="bg-emerald-600 text-white px-4 py-2 rounded">Next →</button>
            </div>
        </div>
    );
}
