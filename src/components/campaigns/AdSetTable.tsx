'use client';

interface AdSetListProps {
    campaignId: string;
}

export default function AdSetList({ campaignId }: AdSetListProps) {
    // Here you would fetch and display ad sets for the given campaignId.
    // For now, we'll just display a placeholder message.
    return (
        <div>
            <h3 className="font-bold text-lg mb-2">Ad Sets for Campaign {campaignId}</h3>
            {/* Replace this with your ad sets table or list */}
            <p>Ad sets data goes here...</p>
        </div>
    );
}
