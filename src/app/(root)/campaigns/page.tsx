import CampaignTable from "@/components/campaigns/CampaignTable";

const dummyCampaigns = [
  {
    id: '1',
    name: 'Test – AlexaStyles | Tailored Leads | Whatsapp',
    delivery: false,
    type: 'Manual' as const,
    status: 'PAUSED',
    objective: 'MESSAGES',
    startDate: '2025-01-10T13:00:00-0500',
    endDate: '2025-02-10T13:00:00-0500',
    attribution: '7-day click or view',
    results: '23 Conversations',
    reach: 1200,
    views: 300,
    impressions: 2000,
    deal: 8,
    nodeal: 15,
    frequency: 1.67,
    costPerResult: '$4.32',
  },
  {
    id: '2',
    name: 'AI Campaign – DeepVisor Monthly Leads',
    delivery: true,
    type: 'AI Auto' as const,
    status: 'ACTIVE',
    objective: 'LEAD_GENERATION',
    startDate: '2025-03-01T00:00:00-0500',
    endDate: null,
    attribution: '7-day click or view',
    results: '58 Leads',
    reach: 3400,
    views: 920,
    impressions: 6400,
    deal: 22,
    nodeal: 36,
    frequency: 1.88,
    costPerResult: '$2.19',
  },
  {
    id: '3',
    name: 'Semi-Auto – Promo Campaign for Spring',
    delivery: true,
    type: 'Semi-Auto' as const,
    status: 'ACTIVE',
    objective: 'CONVERSIONS',
    startDate: '2025-03-12T08:00:00-0500',
    endDate: '2025-04-12T08:00:00-0500',
    attribution: '1-day click',
    results: '12 Purchases',
    reach: 800,
    views: 210,
    impressions: 1400,
    deal: 5,
    nodeal: 7,
    frequency: 1.75,
    costPerResult: '$7.89',
  }
];


export default function CampaignPage() {
  return <CampaignTable campaigns={dummyCampaigns} />;
}
