'use client';

import { useCreateCampaignForm } from "@/hooks/context/CampaignFormContext";


export default function AdCreativeStep() {
    const { formData, updateFormData, goToNextStep, goToPreviousStep } = useCreateCampaignForm();

    return (
        <div>
            <h2 className="text-xl font-semibold mb-4">Ad Creative</h2>
            <div className="space-y-4">
                <label className="block">
                    <span>Ad Caption</span>
                    <textarea
                        rows={3}
                        className="w-full p-2 border rounded mt-1"
                        value={formData.caption || ''}
                        onChange={(e) => updateFormData({ caption: e.target.value })}
                    />
                </label>
                <label className="block">
                    <span>Media URL (Optional for manual)</span>
                    <input
                        type="text"
                        className="w-full p-2 border rounded mt-1"
                        value={formData.mediaUrl || ''}
                        onChange={(e) => updateFormData({ mediaUrl: e.target.value })}
                    />
                </label>
            </div>

            <div className="flex justify-between mt-6">
                <button onClick={goToPreviousStep} className="text-emerald-600 hover:underline">← Back</button>
                <button onClick={goToNextStep} className="bg-emerald-600 text-white px-4 py-2 rounded">Next →</button>
            </div>
        </div>
    );
}
