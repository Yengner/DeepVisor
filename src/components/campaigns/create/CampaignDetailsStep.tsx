'use client';

import { useState } from "react";
import { useCreateCampaignForm } from "@/hooks/context/CampaignFormContext";

export default function CampaignDetailsStep() {
    const { formData, updateFormData, goToNextStep, goToPreviousStep } = useCreateCampaignForm();

    const [errors, setErrors] = useState<{ name?: boolean; budget?: boolean;}>({});

    const handleNext = () => {
        const newErrors = {
            name: !formData.campaignName.trim(),
            budget: !formData.budget,
        };

        setErrors(newErrors);

        const hasErrors = Object.values(newErrors).some(Boolean);
        if (!hasErrors) goToNextStep();
    };

    return (
        <div>
            <h2 className="text-xl font-semibold mb-4">Campaign Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <div>
                        <label className="block font-medium text-sm mb-1">Campaign Name</label>
                        <input
                            type="text"
                            placeholder="e.g., Spring Sale Campaign"
                            className={`w-full p-2 border rounded ${errors.name ? 'border-red-500' : ''}`}
                            value={formData.campaignName}
                            onChange={(e) => updateFormData({ campaignName: e.target.value })}
                        />
                        {errors.name && <p className="text-sm text-red-500 mt-1">Campaign name is required.</p>}
                    </div>

                    <div>
                        <label className="block font-medium text-sm mb-1">Budget</label>
                        <input
                            type="number"
                            placeholder="Daily Budget ($)"
                            className={`w-full p-2 border rounded ${errors.budget ? 'border-red-500' : ''}`}
                            value={formData.budget || ''}
                            onChange={(e) => updateFormData({ budget: Number(e.target.value) })}
                        />
                        {errors.budget && <p className="text-sm text-red-500 mt-1">Budget is required.</p>}
                    </div>

                </div>

                {/* Change all of this now to the new campaign details */}
                <div className="bg-gray-50 border p-4 rounded">
                    <h3 className="font-semibold text-lg mb-2">What are campaign details?</h3>
                    <p className="text-sm text-gray-700 mb-2">
                        These details define when your campaign starts, ends, and what it&apos;s called. This is especially helpful when managing multiple ad campaigns or testing different strategies.
                    </p>
                    <ul className="list-disc pl-5 text-sm text-gray-600">
                        <li><strong>Start/End Date:</strong> Controls when the campaign runs.</li>
                        <li><strong>Timezone:</strong> Helps align delivery with your audience&apos;s active times.</li>
                        <li><strong>Campaign Name:</strong> Used to identify this campaign across platforms and reporting.</li>
                    </ul>
                </div>
            </div>

            <div className="flex justify-between mt-8">
                <button onClick={goToPreviousStep} className="text-emerald-600 hover:underline">
                    ← Back
                </button>
                <button
                    onClick={handleNext}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded"
                >
                    Next →
                </button>
            </div>
        </div>
    );
}
