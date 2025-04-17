"use client";

import React, { useState, useCallback } from 'react';
import { GoogleMap, Marker, Circle, useJsApiLoader, Autocomplete } from '@react-google-maps/api';

interface LocationData {
    markerPosition: google.maps.LatLngLiteral | null;
    radius: number;
}

interface GoogleMapSelectorProps {
    onLocationSelect: (location: LocationData) => void;
}

const containerStyle = {
    width: '100%',
    height: '400px'
};

const defaultCenter = {
    lat: 39.8283,  // Center of the U.S.
    lng: -98.5795
};

const mapOptions = {
    disableDefaultUI: false,
    zoomControl: true,
};

export default function GoogleMapSelector({ onLocationSelect }: GoogleMapSelectorProps) {
    const { isLoaded } = useJsApiLoader({
        googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
        libraries: ['places']
    });

    const [map, setMap] = useState<google.maps.Map | null>(null);
    const [markerPosition, setMarkerPosition] = useState<google.maps.LatLngLiteral | null>(null);
    const [radius, setRadius] = useState<number>(5); // default 5 miles
    const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);

    const onMapLoad = useCallback((mapInstance: google.maps.Map) => {
        setMap(mapInstance);
    }, []);

    const onMapUnmount = useCallback(() => {
        setMap(null);
    }, []);

    const onPlaceChanged = () => {
        if (autocomplete !== null) {
            const place = autocomplete.getPlace();
            if (place.geometry && place.geometry.location) {
                const location = {
                    lat: place.geometry.location.lat(),
                    lng: place.geometry.location.lng(),
                };
                setMarkerPosition(location);
                map?.panTo(location);
            }
        } else {
            console.log("Autocomplete is not loaded yet!");
        }
    };

    if (!isLoaded) {
        return <div>Loading Map...</div>;
    }

    return (
        <div>
            {/* Search box using Places Autocomplete */}
            <div style={{ marginBottom: '1rem' }}>
                <Autocomplete
                    onLoad={setAutocomplete}
                    onPlaceChanged={onPlaceChanged}
                    options={{ types: ['(cities)'], componentRestrictions: { country: 'us' } }}
                >
                    <input
                        type="text"
                        placeholder="Search for a U.S. city"
                        style={{
                            width: '240px',
                            height: '32px',
                            padding: '0 12px',
                            borderRadius: '3px',
                            border: '1px solid #ccc',
                            fontSize: '14px'
                        }}
                    />
                </Autocomplete>
            </div>

            <GoogleMap
                mapContainerStyle={containerStyle}
                center={markerPosition || defaultCenter}
                zoom={markerPosition ? 12 : 4}
                onLoad={onMapLoad}
                onUnmount={onMapUnmount}
                options={mapOptions}
            >
                {markerPosition && <Marker position={markerPosition} />}
                {markerPosition && (
                    <Circle
                        center={markerPosition}
                        radius={radius * 1609.34} // Converts miles to meters
                        options={{
                            fillColor: "#blue",
                            fillOpacity: 0.2,
                            strokeColor: "#blue",
                            strokeOpacity: 1,
                            strokeWeight: 1,
                        }}
                    />
                )}
            </GoogleMap>

            {/* Radius selection */}
            <div style={{ marginTop: '1rem' }}>
                <label className="block mb-1 font-medium">Radius (miles):</label>
                <input
                    type="range"
                    min="1"
                    max="50"
                    value={radius}
                    onChange={(e) => setRadius(Number(e.target.value))}
                    className="w-full"
                />
                <div className="text-center">{radius} miles</div>
            </div>

            {/* Confirm Button */}
            <div className="mt-4 text-center">
                <button
                    onClick={() => onLocationSelect({ markerPosition, radius })}
                    className="bg-emerald-600 text-white px-4 py-2 rounded-md hover:bg-emerald-700"
                    disabled={!markerPosition}
                >
                    Confirm Location
                </button>
            </div>
        </div>
    );
}
