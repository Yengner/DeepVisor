'use client';

import { useState } from 'react';
import { CampaignFormContext, CreateCampaignForm } from './CampaignFormContext';

export function CampaignFormProvider({ children }: { children: React.ReactNode }) {
  const [formData, setFormData] = useState<CreateCampaignForm>({
    type: null,
    objective: '',
    leadType: '',
    name: '',
    startDate: '',
    endDate: '',
    budget: 0,
    location: '',
    targeting: '',
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
