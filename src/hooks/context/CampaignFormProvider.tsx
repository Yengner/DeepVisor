'use client';

import { useState } from 'react';
import { CampaignFormContext, CreateCampaignForm } from './CampaignFormContext';

export function CampaignFormProvider({ children }: { children: React.ReactNode }) {
  const [formData, setFormData] = useState<CreateCampaignForm>({
    type: null,

    // Campaign Fields
    campaignName: '',
    objective: '',
    budget: 0,
    
    // Ad Set Fields
    adsetName: '',
    optimization_goal: '',
    billing_event: '', // Billing event for the ad set, e.g., 'IMPRESSIONS', 'CLICKS'
    destination_type: '', // Destination type for the ad set, e.g., 'WEBSITE', 'APP', 'MESSENGER'
    startDate: '',
    endDate: '',
    city: '',
    location: {
      markerPosition: {
        lat: 0,
        lng: 0,
      },
      radius: 0, // Default radius in miles
    },

    
    // Audience targeting and creative details
    customTargeting: '',
    creativeType: 'AI',
    caption: '',
    mediaUrl: '',
  });

  const [currentStep, setCurrentStep] = useState(0);

  const updateFormData = (values: Partial<CreateCampaignForm>) => {
    setFormData((prev) => ({ ...prev, ...values }));
  };

  const goToNextStep = () => setCurrentStep((prev) => prev + 1);
  const goToPreviousStep = () => setCurrentStep((prev) => Math.max(prev - 1, 0));

  return (
    <CampaignFormContext.Provider
      value={{
        formData,
        updateFormData,
        currentStep,
        goToNextStep,
        goToPreviousStep,
        setStep: setCurrentStep,
      }}
    >
      {children}
    </CampaignFormContext.Provider>
  );
}
