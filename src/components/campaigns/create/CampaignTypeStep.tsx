'use client';

import { useCreateCampaignForm } from "@/hooks/context/CampaignFormContext";
import { CheckCircleIcon } from "lucide-react";
import { useState } from "react";

type CampaignType = 'AI Auto' | 'Semi-Auto' | 'Manual';

interface CampaignOption {
  label: string;
  value: CampaignType;
  description: string;
  features: string[];
}

export default function CampaignTypeStep() {
    const { formData, updateFormData, goToNextStep } = useCreateCampaignForm();
    const [selected, setSelected] = useState<typeof campaignOptions[0] | null>(null);


    const campaignOptions: CampaignOption[] = [
        {
          label: "AI Auto",
          value: "AI Auto",
          description: "Let AI select, test, and rotate creatives. Fully automated.",
          features: [
            "Auto-select best post",
            "30-day creative optimization",
            "A/B testing enabled",
            "No manual effort"
          ]
        },
        {
          label: "Semi-Auto",
          value: "Semi-Auto",
          description: "AI helps you pick the best post, but you manage creatives manually.",
          features: [
            "AI creative suggestions",
            "Manual final approval",
            "No auto-rotation"
          ]
        },
        {
          label: "Manual",
          value: "Manual",
          description: "You have full control over all settings and creatives.",
          features: [
            "Manual post selection",
            "No AI assistance",
            "Full customization"
          ]
        }
      ];

    const handleSelect = (option: typeof campaignOptions[0]) => {
        setSelected(option);
        updateFormData({ type: option.value });
      };
    return (
        <div className="flex flex-col lg:flex-row gap-6">
            {/* Left: Selectable Options */}
            <div className="flex-1 space-y-4">
                <h2 className="text-xl font-semibold">Choose Campaign Type</h2>
                {campaignOptions.map((option) => (
                    <div
                        key={option.value}
                        onClick={() => handleSelect(option)}
                        className={`border rounded-lg p-4 cursor-pointer transition hover:shadow-md ${selected?.value === option.value
                            ? 'border-emerald-600 bg-emerald-50'
                            : 'border-gray-300'
                            }`}
                    >
                        <h3 className="text-lg font-semibold">{option.label}</h3>
                        <p className="text-sm text-gray-600">{option.description}</p>
                    </div>
                ))}
            </div>

            {/* Right: Description */}
            <div className="flex-1">
                {selected ? (
                    <div className="p-4 border rounded-lg bg-gray-50">
                        <h3 className="text-lg font-semibold mb-2">{selected.label} Features</h3>
                        <ul className="space-y-2">
                            {selected.features.map((feature, idx) => (
                                <li key={idx} className="flex items-center gap-2 text-sm text-gray-700">
                                    <CheckCircleIcon className="w-5 h-5 text-emerald-600" />
                                    {feature}
                                </li>
                            ))}
                        </ul>

                        <button
                            onClick={goToNextStep}
                            className="mt-6 bg-emerald-600 text-white px-6 py-2 rounded hover:bg-emerald-700"
                        >
                            Continue →
                        </button>
                    </div>
                ) : (
                    <div className="p-4 border rounded-lg bg-gray-50 text-gray-600 text-sm">
                        Select a campaign type to view features and continue.
                    </div>
                )}
            </div>
        </div>
    );
}