"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/utils/supabase/clients/browser";

const supabase = createClient();

export default function OnboardingPage() {
    const router = useRouter();

    const [userId, setUserId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [step, setStep] = useState(1); // 🔹 Multi-step control

    const [formData, setFormData] = useState({
        business_type: "",
        ad_goal: "",
        monthly_budget: 0,
        social_platforms: [] as string[],
        runs_ads: false,
        completed: false,
    });

    // Fetch user and existing onboarding data
    useEffect(() => {
        async function fetchUser() {
            setLoading(true);
            const { data: { user }, error } = await supabase.auth.getUser();
            
            if (error) {
                console.error("Error fetching user:", error);
                router.replace("/login");
                return;
            }

            if (!user) {
                router.replace("/login");
                return;
            }

            setUserId(user.id);

            try {
                const { data } = await supabase
                    .from("user_onboarding")
                    .select("*")
                    .eq("user_id", user.id)
                    .single();

                if (data) {
                    setFormData(prev => ({
                        ...prev,
                        ...data,
                        monthly_budget: data.monthly_budget || 0 
                    }));

                    if (data.completed) {
                        router.replace("/dashboard");
                    }
                }
            } catch (err) {
                console.error("Unexpected error in fetchUser:", err);
            } finally {
                setLoading(false);
            }
        }
        fetchUser();
    }, [router]);

    // Auto-save to Supabase when `formData` updates
    useEffect(() => {
        if (!userId || loading) return;
        async function saveData() {
            try {
                console.log("Saving formData:", formData);
                const { error } = await supabase
                    .from("user_onboarding")
                    .upsert({ ...formData, user_id: userId });

                if (error) {
                    console.error("Save error:", error.message, error);
                }
            } catch (err) {
                console.error("Unexpected error in saveData:", err);
            }
        }
        saveData();
    }, [formData, userId, loading]);

    // Handle input changes
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value || "",
        }));
    };

    // Handle navigation between steps
    const nextStep = () => setStep(prev => Math.min(prev + 1, 3));
    const prevStep = () => setStep(prev => Math.max(prev - 1, 1));

    // Handle form completion
    const handleSubmit = async () => {
        try {
            const { error } = await supabase
                .from("user_onboarding")
                .update({ completed: true })
                .eq("user_id", userId);

            if (error) {
                console.error("Error updating completion status:", error);
                return;
            }

            router.replace("/dashboard/platforms");
        } catch (err) {
            console.error("Unexpected error in handleSubmit:", err);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <p className="text-lg font-semibold">Loading...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 px-4">
            <div className="bg-white p-10 rounded-lg shadow-lg w-full max-w-2xl">
                <h2 className="text-2xl font-semibold mb-6 text-center">Let&apos;s Get Started</h2>
                <div className="flex justify-between mb-4">
                    <div className={`w-1/3 h-2 rounded ${step >= 1 ? "bg-emerald-500" : "bg-gray-300"}`} />
                    <div className={`w-1/3 h-2 rounded ${step >= 2 ? "bg-emerald-500" : "bg-gray-300"}`} />
                    <div className={`w-1/3 h-2 rounded ${step >= 3 ? "bg-emerald-500" : "bg-gray-300"}`} />
                </div>

                {step === 1 && (
                    <>
                        <h3 className="text-lg font-medium mb-2">Step 1: Business Information</h3>
                        <p className="text-gray-500 text-sm mb-4">
                            Tell us about your business to tailor the ad strategy for your industry.
                        </p>

                        <label className="block mb-2">Business Type</label>
                        <select name="business_type" value={formData.business_type || ""} onChange={handleChange} className="w-full p-2 border rounded">
                            <option value="">Select</option>
                            <option value="salon">Salon</option>
                            <option value="nail_technician">Nail Technician</option>
                        </select>
                    </>
                )}

                {step === 2 && (
                    <>
                        <h3 className="text-lg font-medium mb-2">Step 2: Ad Goals</h3>
                        <p className="text-gray-500 text-sm mb-4">
                            What do you want to achieve with your ads? More bookings? More followers?
                        </p>

                        <label className="block mt-4">What is your main ad goal?</label>
                        <input type="text" name="ad_goal" value={formData.ad_goal || ""} onChange={handleChange} className="w-full p-2 border rounded" />
                    </>
                )}

                {step === 3 && (
                    <>
                        <h3 className="text-lg font-medium mb-2">Step 3: Budget Planning</h3>
                        <p className="text-gray-500 text-sm mb-4">
                            Select how much you plan to spend on ads monthly.
                        </p>

                        <label className="block mt-4">Monthly Ad Budget</label>
                        <input type="number" name="monthly_budget" value={formData.monthly_budget || 0} onChange={handleChange} className="w-full p-2 border rounded" />
                    </>
                )}

                <div className="flex justify-between mt-6">
                    {step > 1 && <button className="px-4 py-2 bg-gray-300 rounded" onClick={prevStep}>Back</button>}
                    {step < 3 && <button className="px-4 py-2 bg-emerald-500 text-white rounded" onClick={nextStep}>Next</button>}
                    {step === 3 && <button className="px-4 py-2 bg-emerald-600 text-white rounded" onClick={handleSubmit}>Finish</button>}
                </div>
            </div>
        </div>
    );
}
