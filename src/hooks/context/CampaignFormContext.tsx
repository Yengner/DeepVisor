'use client';

import { createContext, useContext } from 'react';

export interface CreateCampaignForm {
  type: 'AI Auto' | 'Semi-Auto' | 'Manual' | null;
  campaignName: string;
  objective: string;
  optimization_goal?: string;
  adsetName?: string; // Optional for AI Auto, or Semi-Auto
  startDate: string;
  endDate: string;
  budget: number;
  city?: string; // City for location targeting unless custom location is used
  location: number;
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
