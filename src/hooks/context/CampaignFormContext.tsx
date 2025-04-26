'use client';

import { createContext, useContext } from 'react';

export interface CreateCampaignForm {

  // ALgorithm Type 
  type: 'AI Auto' | 'Semi-Auto' | 'Manual' | null;

  // Campaign Fields
  campaignName: string;
  objective: string;
  budget: number;
  
  // Ad Set Fields
  adsetName?: string; // Optional for AI Auto, or Semi-Auto
  optimization_goal?: string;
  billing_event?: string; // Billing event for the ad set, e.g., 'IMPRESSIONS', 'CLICKS'
  destination_type?: string; // Destination type for the ad set, e.g., 'WEBSITE', 'APP', 'MESSENGER'  
  startDate: string;
  endDate: string;
  city?: string; // City for location targeting unless custom location is used
  location: {
    markerPosition: {
      lat: number;
      lng: number;
    } | null;
    radius?: number;
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adsetPayload?: Record<string, any>;

  // Audience targeting and creative details
  customTargeting?: string; // Optional custom targeting for the ad set, e.g., interests, behaviors
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
