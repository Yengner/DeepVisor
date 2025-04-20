"use client";

import { useState } from "react";
import { useCreateCampaignForm } from "@/hooks/context/CampaignFormContext";
import GoogleMapSelector from "./GoogleMapSelector";

export default function AdSetStep() {
    const {
        formData,
        updateFormData,
        goToNextStep,
        goToPreviousStep,
    } = useCreateCampaignForm();

    // Initialize from context if present
    const [selectedLocation, setSelectedLocation] = useState<{
        markerPosition: { lat: number; lng: number } | null;
        radius: number;
    }>(
        formData.location.markerPosition
            ? {
                markerPosition: formData.location.markerPosition,
                radius: formData.location.radius ?? 1,
            }
            : { markerPosition: null, radius: 1 }
    );

    const handleLocationSelect = (loc: {
        markerPosition: { lat: number; lng: number } | null;
        radius: number;
    }) => {
        setSelectedLocation(loc);
        updateFormData({ location: loc });
    };

    const handleNext = () => {
        // Build the Facebook AdSet payload
        const payload = {
            name: formData.adsetName,
            campaign_id: formData.campaignName, // or actual campaignId stored earlier
            billing_event: formData.billing_event,
            optimization_goal: formData.optimization_goal,
            destination_type: formData.destination_type,
            targeting: {
                ... (formData.customTargeting
                    ? JSON.parse(formData.customTargeting)
                    : {}),
                geo_locations: selectedLocation.markerPosition
                    ? {
                        custom_locations: [
                            {
                                latitude: selectedLocation.markerPosition.lat,
                                longitude: selectedLocation.markerPosition.lng,
                                radius: selectedLocation.radius,
                                distance_unit: "mile",
                                country: "US",
                            },
                        ],
                    }
                    : {},
            },
            status: "PAUSED",
        };

        updateFormData({ adsetPayload: payload });
        goToNextStep();
    };

    return (
        <div className="max-w-4xl mx-auto p-4">
            <h2 className="text-2xl font-bold mb-6">Ad Set Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* ─── Left Column: Inputs ─────────────────────────────── */}
                <div className="space-y-4">
                    {/* Ad Set Name */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Ad Set Name
                        </label>
                        <input
                            type="text"
                            placeholder="e.g. April New York Leads"
                            className="w-full border border-gray-300 rounded-md p-2 focus:ring-emerald-500 focus:border-emerald-500"
                            value={formData.adsetName || ""}
                            onChange={(e) =>
                                updateFormData({ adsetName: e.target.value })
                            }
                        />
                    </div>

                    {/* Optimization Goal */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Optimization Goal
                        </label>
                        <select
                            className="w-full border border-gray-300 rounded-md p-2"
                            value={formData.optimization_goal || ""}
                            onChange={(e) =>
                                updateFormData({ optimization_goal: e.target.value })
                            }
                        >
                            <option value="" disabled>
                                Select goal…
                            </option>
                            <option value="IMPRESSIONS">Impressions</option>
                            <option value="LINK_CLICKS">Link Clicks</option>
                            <option value="OFFSITE_CONVERSIONS">
                                Offsite Conversions
                            </option>
                            <option value="CONVERSIONS">Conversions</option>
                            <option value="LEAD_GENERATION">Lead Generation</option>
                        </select>
                    </div>

                    {/* Billing Event */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Billing Event
                        </label>
                        <select
                            className="w-full border border-gray-300 rounded-md p-2"
                            value={formData.billing_event || ""}
                            onChange={(e) =>
                                updateFormData({ billing_event: e.target.value })
                            }
                        >
                            <option value="" disabled>
                                Select billing event…
                            </option>
                            <option value="IMPRESSIONS">Impressions</option>
                            <option value="LINK_CLICKS">Link Clicks</option>
                        </select>
                    </div>

                    {/* Destination Type */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Destination Type
                        </label>
                        <select
                            className="w-full border border-gray-300 rounded-md p-2"
                            value={formData.destination_type || ""}
                            onChange={(e) =>
                                updateFormData({ destination_type: e.target.value })
                            }
                        >
                            <option value="" disabled>
                                Select destination…
                            </option>
                            <option value="WHATSAPP">WhatsApp</option>
                            <option value="INSTAGRAM">Instagram</option>
                            <option value="MESSENGER">Messenger</option>
                        </select>
                    </div>

                    {/* Custom Targeting */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Custom Targeting JSON (optional)
                        </label>
                        <textarea
                            placeholder='E.g. {"interests":[{"id":6003139266461}]}'
                            className="w-full border border-gray-300 rounded-md p-2 h-20"
                            value={formData.customTargeting || ""}
                            onChange={(e) =>
                                updateFormData({ customTargeting: e.target.value })
                            }
                        />
                        <p className="mt-1 text-xs text-gray-500">
                            Enter a JSON object for any additional targeting fields.
                        </p>
                    </div>

                    {/* Radius Slider */}
                    {selectedLocation.markerPosition && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Radius: {selectedLocation.radius} mile(s)
                            </label>
                            <input
                                type="range"
                                min={1}
                                max={50}
                                step={1}
                                value={selectedLocation.radius}
                                onChange={(e) =>
                                    handleLocationSelect({
                                        ...selectedLocation,
                                        radius: +e.target.value,
                                    })
                                }
                                className="w-full"
                            />
                        </div>
                    )}
                </div>

                {/* ─── Right Column: Map ───────────────────────────────── */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Select Target Location
                    </label>
                    <div className="h-72 border border-gray-300 rounded-md overflow-hidden">
                        <GoogleMapSelector onLocationSelect={handleLocationSelect} />
                    </div>
                    {selectedLocation.markerPosition && (
                        <p className="mt-2 text-sm text-gray-600">
                            📍{" "}
                            {selectedLocation.markerPosition.lat.toFixed(4)},{" "}
                            {selectedLocation.markerPosition.lng.toFixed(4)} within{" "}
                            {selectedLocation.radius} mile(s)
                        </p>
                    )}
                </div>
            </div>

            {/* ─── Navigation Buttons ───────────────────────────────── */}
            <div className="flex justify-between mt-8">
                <button
                    onClick={goToPreviousStep}
                    className="text-emerald-600 hover:underline"
                >
                    ← Back
                </button>
                <button
                    onClick={handleNext}
                    disabled={
                        !formData.adsetName ||
                        !selectedLocation.markerPosition ||
                        selectedLocation.radius < 1 ||
                        !formData.optimization_goal ||
                        !formData.billing_event ||
                        !formData.destination_type
                    }
                    className="bg-emerald-600 text-white px-6 py-2 rounded-md hover:bg-emerald-700 disabled:opacity-50"
                >
                    Next →
                </button>
            </div>
        </div>
    );
}
