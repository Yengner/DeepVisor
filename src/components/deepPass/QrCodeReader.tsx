"use client";

import { useState } from "react";
import QrScanner from "qr-scanner";

export default function QrCodeReader({ setDiscountUrl }: { setDiscountUrl: (url: string) => void }) {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [scanning, setScanning] = useState(false);
    const [error, setError] = useState("");

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setSelectedFile(file);
        setScanning(true);
        setError("");

        try {
            const result = await QrScanner.scanImage(file);
            if (result) {
                setDiscountUrl(result);
            } else {
                setError("No QR code found in image.");
            }
        } catch (err) {
            setError("Failed to read QR code.");
        } finally {
            setScanning(false);
        }
    };

    return (
        <div className="mb-4">
            <input type="file" accept="image/*" className="w-full p-2 border rounded" onChange={handleFileChange} />
            {scanning && <p className="text-gray-500 text-sm mt-2">Scanning QR code...</p>}
            {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
        </div>
    );
}
