"use client";

import { useState } from "react";
import QrCodeReader from "./QrCodeReader";

export default function DiscountForm({ userId } : { userId: string} ) {
    const [type] = useState("coupon");
    const [businessName, setBusinessName] = useState("");
    const [discountDetails, setDiscountDetails] = useState("");
    const [discountUrl, setDiscountUrl] = useState("");
    const [expirationDate, setExpirationDate] = useState("");
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [logo, setLogo] = useState<File | null>(null);
    const [foregroundColorHex, setForegroundColorHex] = useState("#FFFFFF");
    const [backgroundColorHex, setBackgroundColorHex] = useState("#CE8C35");
    const [latitude, setLatitude] = useState("");
    const [longitude, setLongitude] = useState("");
    const [loading, setLoading] = useState(false);
    const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!businessName || !discountDetails /*|| !discountUrl */) { // Come back to fix this
            alert("Please fill in all required fields.");
            return;
        }

        setLoading(true)

        const requestBody = {
            type,
            businessName,
            discountDetails,
            // discountUrl,
            // expirationDate,
            foregroundColorHex,
            backgroundColorHex,
            // locations: latitude && longitude ? [{ latitude: parseFloat(latitude), longitude: parseFloat(longitude) }] : undefined,
            passId: userId
        };

        try {
            const response = await fetch("/api/wallets/deeppass", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
                throw new Error("Failed to generate pass.");
            }

            const data = await response.json();
            setQrCodeUrl(data.passUrl);
            alert(`Pass Created! Scan QR to add: ${data.passUrl}`);
        } catch (error) {
            console.error(error);
            alert("Error generating pass.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <form className="w-full max-w-lg bg-white shadow-lg p-6 rounded-lg" onSubmit={handleSubmit}>
            <label className="block mb-2 font-semibold">Business Name</label>
            <input
                type="text"
                className="w-full p-2 border rounded mb-4"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                required
            />

            <label className="block mb-2 font-semibold">Discount Details</label>
            <input
                type="text"
                className="w-full p-2 border rounded mb-4"
                value={discountDetails}
                onChange={(e) => setDiscountDetails(e.target.value)}
                required
            />

            <label className="block mb-2 font-semibold">Upload QR Code (or Enter Link Below)</label>
            <QrCodeReader setDiscountUrl={setDiscountUrl} />

            <label className="block mb-2 font-semibold">Discount URL (Manually Enter if Needed)</label>
            <input
                type="text"
                className="w-full p-2 border rounded mb-4"
                value={discountUrl}
                onChange={(e) => setDiscountUrl(e.target.value)}
                // required
            />

            <label className="block mb-2 font-semibold">Expiration Date (Optional)</label>
            <input
                type="date"
                className="w-full p-2 border rounded mb-4"
                value={expirationDate}
                onChange={(e) => setExpirationDate(e.target.value)}
            />

            {/* Color Pickers with Preview */}
            <div className="flex items-center gap-4">
                <div>
                    <label className="block mb-2 font-semibold">Foreground Color (Text Color)</label>
                    <input
                        type="color"
                        className="w-full p-2 border rounded"
                        value={foregroundColorHex}
                        onChange={(e) => setForegroundColorHex(e.target.value)}
                    />
                </div>
                <div>
                    <label className="block mb-2 font-semibold">Background Color</label>
                    <input
                        type="color"
                        className="w-full p-2 border rounded"
                        value={backgroundColorHex}
                        onChange={(e) => setBackgroundColorHex(e.target.value)}
                    />
                </div>
            </div>

            {/* Live Color Preview */}
            <div
                className="w-full mt-4 p-4 text-center rounded shadow-lg"
                style={{
                    backgroundColor: backgroundColorHex,
                    color: foregroundColorHex,
                }}
            >
                <p className="text-lg font-bold">Preview: {businessName}</p>
                <p>{discountDetails}</p>
            </div>

            <label className="block mb-2 font-semibold mt-4">Business Location (Optional)</label>
            <div className="flex gap-2">
                <input
                    type="text"
                    placeholder="Latitude"
                    className="w-1/2 p-2 border rounded mb-4"
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                />
                <input
                    type="text"
                    placeholder="Longitude"
                    className="w-1/2 p-2 border rounded mb-4"
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                />
            </div>

            <label className="block mb-2 font-semibold">Business Location (Optional)</label>
            <div className="flex gap-2">
                <input
                    type="text"
                    placeholder="Latitude"
                    className="w-1/2 p-2 border rounded mb-4"
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                />
                <input
                    type="text"
                    placeholder="Longitude"
                    className="w-1/2 p-2 border rounded mb-4"
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                />
            </div>

            <label className="block mb-2 font-semibold">Upload Business Logo (Optional)</label>
            <input
                type="file"
                accept="image/*"
                className="w-full p-2 border rounded mb-4"
                onChange={(e) => setLogo(e.target.files?.[0] || null)}
            />

            <button
                type="submit"
                className="w-full bg-blue-500 text-white font-bold py-2 px-4 rounded hover:bg-blue-600"
                disabled={loading}
            >
                {loading ? "Generating..." : "Generate Pass"}
            </button>

            {qrCodeUrl && (
                <div className="mt-4 text-center">
                    <p className="font-semibold">Scan to Add to Apple Wallet:</p>
                    <img src={`https://api.qrserver.com/v1/create-qr-code/?data=${qrCodeUrl}&size=200x200`} alt="QR Code" className="mx-auto mt-2" />
                    <a href={qrCodeUrl} className="text-blue-500 underline block mt-2" target="_blank">
                        Click here if QR doesn&apos;t work
                    </a>
                </div>
            )}
        </form>
    );
}
