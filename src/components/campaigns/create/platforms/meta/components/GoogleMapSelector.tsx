"use client";

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { GoogleMap, useJsApiLoader, Autocomplete } from '@react-google-maps/api';
import { TextInput, Slider, Stack, Text, Button, Group } from '@mantine/core';
import { IconSearch, IconMapPin } from '@tabler/icons-react';

interface LocationData { markerPosition: google.maps.LatLngLiteral | null; radius: number; }
interface Props { onLocationSelect: (loc: LocationData) => void; }

const defaultCenter = { lat: 27.9506, lng: -82.4572 };
const containerStyle = { width: '100%', height: '400px' };

export default function GoogleMapSelector({ onLocationSelect }: Props) {
    const { isLoaded, loadError } = useJsApiLoader({
        googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
        libraries: ['places', 'marker'], // include marker library
    });

    const [map, setMap] = useState<google.maps.Map | null>(null);
    const [markerPosition, setMarkerPosition] = useState<google.maps.LatLngLiteral | null>(null);
    const [radius, setRadius] = useState(5);
    const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);
    const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
    const circleRef = useRef<google.maps.Circle | null>(null);

    const onMapLoad = useCallback((m: google.maps.Map) => setMap(m), []);
    const clearMapElements = useCallback(() => {
        if (markerRef.current) markerRef.current.map = null;
        if (circleRef.current) circleRef.current.setMap(null);
        markerRef.current = null;
        circleRef.current = null;
    }, []);

    const handleMapClick = useCallback((e: google.maps.MapMouseEvent) => {
        if (!e.latLng || !map) return;
        const pos = { lat: e.latLng.lat(), lng: e.latLng.lng() };
        clearMapElements();
        setMarkerPosition(pos);
        onLocationSelect({ markerPosition: pos, radius });
    }, [map, radius, onLocationSelect, clearMapElements]);

    useEffect(() => {
        if (!map || !markerPosition) return;
        (async () => {
            const { AdvancedMarkerElement } = await google.maps.importLibrary("marker") as google.maps.MarkerLibrary;
            clearMapElements();
            // create advanced marker
            const marker = new AdvancedMarkerElement({ map, position: markerPosition, gmpDraggable: true });
            marker.addListener('dragend', (e: google.maps.MapMouseEvent) => {
                const ll = (e as google.maps.MapMouseEvent).latLng!;
                const newPos = { lat: ll.lat(), lng: ll.lng() };
                setMarkerPosition(newPos);
                onLocationSelect({ markerPosition: newPos, radius });
            });
            // create circle
            const circle = new google.maps.Circle({
                map, center: markerPosition, radius: radius * 1609.34,
                fillColor: "#4285F4", fillOpacity: .2, strokeColor: "#4285F4",
                clickable: true,
            });
            circle.addListener('click', handleMapClick);
            markerRef.current = marker;
            circleRef.current = circle;
        })();
    }, [map, markerPosition, radius, onLocationSelect, handleMapClick, clearMapElements]);

    // Update circle radius dynamically
    useEffect(() => { if (circleRef.current) circleRef.current.setRadius(radius * 1609.34); }, [radius]);

    if (loadError) return <div>Error loading maps</div>;
    if (!isLoaded) return <div>Loading Maps...</div>;

    return (
        <div>
            <Autocomplete onLoad={setAutocomplete} onPlaceChanged={() => {
                if (autocomplete) {
                    const place = autocomplete.getPlace();
                    if (place.geometry?.location) {
                        const loc = { lat: place.geometry.location.lat(), lng: place.geometry.location.lng() };
                        clearMapElements(); setMarkerPosition(loc); map?.panTo(loc); map?.setZoom(10);
                        onLocationSelect({ markerPosition: loc, radius });
                    }
                }
            }}>
                <TextInput placeholder="Search…" leftSection={<IconSearch size={16} />} mb="md" />
            </Autocomplete>

            <GoogleMap
                mapContainerStyle={containerStyle}
                center={markerPosition || defaultCenter}
                zoom={markerPosition ? 10 : 4}
                onLoad={onMapLoad}
                onClick={handleMapClick}
                options={{
                    mapId: "e4b19e9a05c74e686b3fada0",
                }}
            />

            <Stack mt="md" gap="sm">
                <Text size="sm" fw={500}>Radius (miles):</Text>
                <Slider
                    value={radius}
                    onChange={r => { setRadius(r); if (markerPosition) onLocationSelect({ markerPosition, radius: r }); }}
                    min={1} max={50} label={r => `${r} mi`} labelAlwaysOn size="sm"
                />
            </Stack>

            <Group justify="center" mt="md">
                <Button
                    onClick={() => onLocationSelect({ markerPosition, radius })}
                    disabled={!markerPosition} leftSection={<IconMapPin size={16} />}
                >
                    Confirm Location
                </Button>
            </Group>
        </div>
    );
}
