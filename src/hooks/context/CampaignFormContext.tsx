'use client';

import { createContext, useContext } from 'react';

export interface CreateCampaignForm {
  type: 'AI Auto' | 'Semi-Auto' | 'Manual' | null;
  objective: string;
  leadType: string;
  name: string;
  startDate: string;
  endDate: string;
  budget: number;
  location: string;
  targeting: string;
  creativeType: 'AI' | 'Manual';
  selectedCreativeId?: string;
  caption?: string;
  mediaUrl?: string;
}

export interface CampaignFormContextType {
  formData: CreateCampaignForm;
  updateFormData: (values: Partial<CreateCampaignForm>) => void;
  currentStep: number;
  goToNextStep: () => void;
  goToPreviousStep: () => void;
  setStep: (step: number) => void;
}

export const CampaignFormContext = createContext<CampaignFormContextType | null>(null);

export const useCreateCampaignForm = () => {
  const context = useContext(CampaignFormContext);
  if (!context) throw new Error("useCreateCampaignForm must be used within CampaignFormProvider");
  return context;
};
