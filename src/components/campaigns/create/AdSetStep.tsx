"use client";

import { useState } from "react";
import { useCreateCampaignForm } from "@/hooks/context/CampaignFormContext";
import GoogleMapSelector from "./GoogleMapSelector";

export default function AdSetStep() {
    const { formData, updateFormData, goToNextStep, goToPreviousStep } = useCreateCampaignForm();

    // Local state for the selected location returned from the map component.
    // Expected structure: { markerPosition: { lat: number, lng: number }, radius: number }
    const [selectedLocation, setSelectedLocation] = useState<{ markerPosition: { lat: number; lng: number } | null; radius: number } | null>(null);

    // When the location is confirmed from the map selector:
    const handleLocationSelect = (locationData: { markerPosition: { lat: number; lng: number } | null; radius: number }) => {
        setSelectedLocation(locationData);
        // Save the full location object into the form data so that later you can pass it to Facebook's API
        updateFormData({ location: locationData });
    };

    return (
        <div className="max-w-3xl mx-auto px-4 py-6">
            <h2 className="text-2xl font-bold mb-6">Ad Set Details</h2>

            {/* Audience targeting input (optional) */}
            <div className="mb-6">
                <label htmlFor="targeting" className="block text-sm font-medium text-gray-700 mb-1">
                    Audience Targeting (optional)
                </label>
                <input
                    type="text"
                    id="targeting"
                    placeholder="Enter details for audience targeting..."
                    className="block w-full border border-gray-300 rounded-md p-2 shadow-sm focus:ring-emerald-500 focus:border-emerald-500"
                    value={formData.targeting || ""}
                    onChange={(e) => updateFormData({ targeting: e.target.value })}
                />
            </div>

            {/* Google Map Selector for Location */}
            <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Target Location
                </label>
                <GoogleMapSelector onLocationSelect={handleLocationSelect} />
                {selectedLocation && selectedLocation.markerPosition && (
                    <div className="mt-2 text-sm text-gray-600">
                        Selected Location: Latitude {selectedLocation.markerPosition.lat.toFixed(4)}, Longitude {selectedLocation.markerPosition.lng.toFixed(4)}, within {selectedLocation.radius} mile(s)
                    </div>
                )}
            </div>

            {/* Navigation buttons */}
            <div className="flex justify-between mt-8">
                <button onClick={goToPreviousStep} className="text-emerald-600 hover:underline">
                    ← Back
                </button>
                <button
                    onClick={goToNextStep}
                    disabled={!selectedLocation || !selectedLocation.markerPosition}
                    className="bg-emerald-600 text-white px-6 py-2 rounded-md hover:bg-emerald-700 disabled:opacity-60"
                >
                    Next →
                </button>
            </div>
        </div>
    );
}
