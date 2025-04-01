'use client';


import CampaignTypeStep from './CampaignTypeStep';
import ObjectiveStep from './ObjectiveStep';
import CampaignDetailsStep from './CampaignDetailsStep';
import AdSetStep from './AdSetStep';
import AdCreativeStep from './AdCreativeStep';
import ReviewAndPublishStep from './ReviewAndPublishStep';
import { useCreateCampaignForm } from '@/hooks/context/CampaignFormContext';

const steps = [
  'Campaign Type',
  'Objective',
  'Campaign Details',
  'Ad Set',
  'Creative',
  'Review & Publish',
];

export default function CreateCampaign() {
  const { currentStep } = useCreateCampaignForm();

  return (
    <div className="bg-white shadow-sm border rounded-xl p-6">
      <div className="mb-6 text-gray-600 font-medium">
        Step {currentStep + 1}: {steps[currentStep]}
      </div>

      {currentStep === 0 && <CampaignTypeStep />}
      {currentStep === 1 && <ObjectiveStep />}
      {currentStep === 2 && <CampaignDetailsStep />}
      {currentStep === 3 && <AdSetStep />}
      {currentStep === 4 && <AdCreativeStep />}
      {currentStep === 5 && <ReviewAndPublishStep />}
    </div>
  );
}
