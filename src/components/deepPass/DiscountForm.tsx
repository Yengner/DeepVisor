"use client";

import { useState } from "react";
import QrCodeReader from "./QrCodeReader";

export default function DiscountForm() {
    const [businessName, setBusinessName] = useState("");
    const [discountDetails, setDiscountDetails] = useState("");
    const [discountUrl, setDiscountUrl] = useState(""); 
    const [expirationDate, setExpirationDate] = useState("");
    const [logo, setLogo] = useState<File | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!businessName || !discountDetails || !discountUrl) {
            alert("Please fill in all required fields.");
            return;
        }

        const formData = new FormData();
        formData.append("businessName", businessName);
        formData.append("discountDetails", discountDetails);
        formData.append("discountUrl", discountUrl);
        if (expirationDate) formData.append("expirationDate", expirationDate);
        if (logo) formData.append("logo", logo);

        try {
            const response = await fetch("/api/generate-pass", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                throw new Error("Failed to generate pass.");
            }

            const data = await response.json();
            alert(`Pass Created! Download QR: ${data.qrCodeUrl}`);
        } catch (error) {
            console.error(error);
            alert("Error generating pass.");
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
                required
            />

            <label className="block mb-2 font-semibold">Expiration Date (Optional)</label>
            <input
                type="date"
                className="w-full p-2 border rounded mb-4"
                value={expirationDate}
                onChange={(e) => setExpirationDate(e.target.value)}
            />

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
            >
                Generate Pass
            </button>
        </form>
    );
}
