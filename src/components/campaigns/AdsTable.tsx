'use client';

interface AdsListProps {
  campaignId: string;
}

export default function AdsList({ campaignId }: AdsListProps) {
  // Here you would fetch and display ads for the given campaignId.
  // For now, we'll just display a placeholder message.
  return (
    <div>
      <h3 className="font-bold text-lg mb-2">Ads for Campaign {campaignId}</h3>
      {/* Replace this with your ads table or list */}
      <p>Ads data goes here...</p>
    </div>
  );
}
