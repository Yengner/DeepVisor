'use client';

import { useState } from 'react';
import { useCreateCampaignForm } from "@/hooks/context/CampaignFormContext";

const objectiveOptions = [
  {
    label: 'Leads',
    value: 'Leads',
    description: 'Generate leads through Messenger, Forms, WhatsApp, or Calls.',
  },
  {
    label: 'Reach',
    value: 'Reach',
    description: 'Show your ads to the maximum number of people in your audience.',
  },
  {
    label: 'Engagement',
    value: 'Engagement',
    description: 'Get more likes, comments, shares, or post saves.',
  },
  {
    label: 'Website Traffic',
    value: 'Website Traffic',
    description: 'Drive users to your website using strong CTAs.',
  }
];

const leadMethods = ['Messenger', 'Forms', 'WhatsApp', 'Calls'];

export default function ObjectiveStep() {
  const { formData, updateFormData, goToNextStep, goToPreviousStep } = useCreateCampaignForm();
  const [selected, setSelected] = useState(formData.objective || '');
  const [leadOption, setLeadOption] = useState(formData.leadType || '');

  const handleSelect = (objective: string) => {
    setSelected(objective);
    updateFormData({ objective });

    // Reset lead option if switching objectives
    if (objective !== 'Leads') {
      updateFormData({ leadType: undefined });
      setLeadOption('');
    }
  };

  const handleLeadOption = (option: string) => {
    setLeadOption(option);
    updateFormData({ leadType: option as any });
  };

  const canContinue = selected === 'Leads' ? !!leadOption : !!selected;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <h2 className="text-xl font-semibold mb-4">Choose Objective</h2>
        <div className="grid gap-4">
          {objectiveOptions.map((obj) => (
            <button
              key={obj.value}
              className={`text-left px-4 py-3 border rounded transition
                ${selected === obj.value
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white hover:bg-gray-100 text-black border-gray-300'}
              `}
              onClick={() => handleSelect(obj.value)}
            >
              {obj.label}
            </button>
          ))}
        </div>

        <button
          onClick={goToPreviousStep}
          className="mt-4 text-emerald-600 hover:underline"
        >
          ← Back
        </button>
      </div>

      <div className="bg-gray-50 p-4 rounded border">
        <h3 className="font-semibold text-lg mb-2">Objective Details</h3>
        <p className="text-gray-700 mb-4">
          {
            objectiveOptions.find((o) => o.value === selected)?.description ||
            'Select an objective to see more info.'
          }
        </p>

        {selected === 'Leads' && (
          <>
            <h4 className="font-medium text-sm mb-2">How do you want to collect leads?</h4>
            <div className="flex flex-wrap gap-2">
              {leadMethods.map((method) => (
                <button
                  key={method}
                  className={`px-3 py-1 rounded border text-sm ${
                    leadOption === method
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white border-gray-300 hover:bg-gray-100'
                  }`}
                  onClick={() => handleLeadOption(method)}
                >
                  {method}
                </button>
              ))}
            </div>
          </>
        )}

        {canContinue && (
          <button
            onClick={goToNextStep}
            className="mt-6 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded"
          >
            Next →
          </button>
        )}
      </div>
    </div>
  );
}
