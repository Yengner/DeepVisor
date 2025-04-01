"use client";

import { useState } from "react";
// import DiscountForm from "@/components/DiscountForm";
// import BusinessCardForm from "@/components/BusinessCardForm";
// import EventTicketForm from "@/components/EventTicketForm";

export default function CreatePass() {
    const [passType, setPassType] = useState("coupon");

    return (
        <div className="p-8">
            <h1 className="text-3xl font-bold mb-4">Create a New Pass</h1>

            <label className="block mb-2 font-semibold">Select Pass Type</label>
            <select
                className="w-full p-2 border rounded mb-4"
                value={passType}
                onChange={(e) => setPassType(e.target.value)}
            >
                <option value="coupon">Coupon</option>
                <option value="business-card">Business Card</option>
                <option value="event-ticket">Event Ticket</option>
            </select>

            {/* Render the correct form based on selection */}
            {/* {passType === "coupon" && <DiscountForm />}
            {passType === "business-card" && <BusinessCardForm />}
            {passType === "event-ticket" && <EventTicketForm />} */}
        </div>
    );
}
