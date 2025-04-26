import React, { useState } from 'react';
import GoogleMapSelector from '@/components/campaigns/create/GoogleMapSelector';

export default function CampaignLocationStep() {
  const [selectedLocation, setSelectedLocation] = useState<{ markerPosition: google.maps.LatLngLiteral | null, radius: number } | null>(null);

  const handleLocationSelect = (location: { markerPosition: google.maps.LatLngLiteral | null, radius: number }) => {
    setSelectedLocation(location);
    
    console.log("Selected Location:", location);
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Choose Your Target Location</h2>
      <GoogleMapSelector onLocationSelect={handleLocationSelect} />
      {selectedLocation && (
        <div className="mt-4">
          <p><strong>Latitude:</strong> {selectedLocation.markerPosition?.lat}</p>
          <p><strong>Longitude:</strong> {selectedLocation.markerPosition?.lng}</p>
          <p><strong>Radius:</strong> {selectedLocation.radius} miles</p>
        </div>
      )}
    </div>
  );
}
