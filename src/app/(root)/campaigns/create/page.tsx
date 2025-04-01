'use client';

import CreateCampaign from "@/components/campaigns/create/CreateCampaign";
import { CampaignFormProvider } from "@/hooks/context/CampaignFormProvider";



export default function CampaignCreatePage() {
  return (
    <CampaignFormProvider>
      <CreateCampaign />
    </CampaignFormProvider>
  );
}
