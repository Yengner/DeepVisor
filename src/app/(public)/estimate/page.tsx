"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { createClient } from "@/lib/utils/supabase/clients/browser";

// Supabase Config
const supabase = createClient();

// ✅ Form Validation Schema using Zod
const formSchema = z.object({
    name: z.string().min(2, "Name is required"),
    email: z.string().email("Invalid email"),
    phone: z.string().optional(),
    company_name: z.string().min(2, "Company name is required"),
    business_stage: z.string(),
    budget: z.string(),
    industry: z.string(),
    other_industry: z.string().optional(),
    service_type: z.string(),
    creatives_option: z.string().optional(),
    growth_plan_agreement: z.boolean().optional(),
    acknowledges_service_terms: z.boolean().refine((val) => val === true, {
        message: "You must acknowledge the service terms before proceeding.",
    }),
});


export default function EstimateForm() {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);

    const {
        register,
        handleSubmit,
        setValue,
        watch,
        formState: { errors, isValid },
    } = useForm({
        resolver: zodResolver(formSchema),
        mode: "onChange", // ✅ Enables real-time validation
        defaultValues: {
            name: "",
            email: "",
            phone: "",
            company_name: "",
            business_stage: "Startup",
            budget: "",
            industry: "",
            other_industry: "",
            service_type: "",
            creatives_option: "",
            growth_plan_agreement: false,
            acknowledges_service_terms: false,
        },
    });

    const onSubmit = async (data: any) => {
        setLoading(true);

        const { adSpend, serviceCharge, total } = calculateEstimate();

        const leadData = {
            ...data,
            budget: parseInt(data.budget.replace(/\D/g, ""), 10) || 0,
            ad_spend: adSpend,
            service_charge: serviceCharge,
            total_monthly_cost: total,
        };

        const { error } = await supabase.from("leads").insert([leadData]);

        setLoading(false);

        if (error) {
            console.error("Error submitting form:", error);
        } else {
            alert("Form submitted successfully!");
            setStep(1); // Reset form
        }
    };


    const steps = [
        "Business Info",
        "Budget & Industry",
        "Business Stage",
        "Service",
        "Review & Submit",
    ];

    const validateStep = () => {
        switch (step) {
            case 1:
                return watch("name") && watch("email") && watch("company_name");
            case 2:
                return (
                    (watch("budget")) && watch("industry") &&
                    (watch("industry") !== "Other" || watch("other_industry"))
                );
            case 3:
                return watch("business_stage");
            case 4:
                return watch("acknowledges_service_terms");
            default:
                return true;
        }
    };

    // Estimate Calculation Logic
    const calculateEstimate = () => {
        const industry = watch("industry");
        const budgetInput = watch("budget");

        // Extract numerical budget
        let budget = parseInt(budgetInput.replace(/\D/g, ""), 10) || 0;

        // If no budget was provided, assume a reasonable starting budget
        if (!budget) budget = 1000;

        // Industry Classification
        const highTicketIndustries = ["Finance", "Real Estate", "Medical Devices", "Legal Services", "Luxury Goods"];
        const midTicketIndustries = ["Technology", "Construction", "Marketing", "Consulting", "Architecture"];
        const lowTicketIndustries = ["Retail", "E-commerce", "Beauty & Personal Care", "Fitness & Wellness", "Nail Salon"];

        const isHighTicket = highTicketIndustries.includes(industry);
        const isMidTicket = midTicketIndustries.includes(industry);
        const isLowTicket = lowTicketIndustries.includes(industry);

        // Define minimums
        let minAdSpend = isHighTicket ? 1000 : 500;
        let minServiceCharge = isHighTicket ? 400 : 250; // Higher base for high-ticket

        let adSpend, serviceCharge;

        if (budget < 1000) {
            // If budget is under $1,000, enforce minimums
            adSpend = Math.max(minAdSpend, budget * 0.6);
            serviceCharge = Math.max(minServiceCharge, budget * 0.4);
        } else {
            // Budget-based scaling
            if (isHighTicket) {
                adSpend = budget * 0.5; // 50% of the budget
                serviceCharge = budget * 0.4; // 40% of the budget
            } else if (isMidTicket) {
                adSpend = budget * 0.55; // 55% of the budget
                serviceCharge = budget * 0.35; // 35% of the budget
            } else {
                // Low-ticket or general industries
                adSpend = budget * 0.6; // 60% of the budget
                serviceCharge = budget * 0.25; // 25% of the budget
            }
        }

        // Ensure total is within 10-20% over budget
        const maxBudget = budget * 1.2;
        if (adSpend + serviceCharge > maxBudget) {
            const scaleFactor = maxBudget / (adSpend + serviceCharge);
            adSpend *= scaleFactor;
            serviceCharge *= scaleFactor;
        }

        // Ensure service charge never exceeds ad spend
        if (serviceCharge > adSpend) {
            serviceCharge = adSpend;
        }

        return {
            adSpend: Math.round(adSpend),
            serviceCharge: Math.round(serviceCharge),
            total: Math.round(adSpend + serviceCharge),
        };
    };



    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
            <div className="w-full max-w-lg bg-white dark:bg-gray-800 shadow-lg rounded-lg p-6">
                <h2 className="text-2xl font-semibold text-center mb-6 text-gray-900 dark:text-white">
                    Free Estimate Request
                </h2>

                {/* ✅ Step Progress Tracker */}
                <div className="flex justify-between mb-6">
                    {steps.map((title, index) => (
                        <div key={index} className="flex flex-col items-center">
                            <div
                                className={`w-8 h-8 flex items-center justify-center rounded-full text-white font-bold ${step > index + 1
                                    ? "bg-green-500"
                                    : step === index + 1
                                        ? "bg-blue-500"
                                        : "bg-gray-300"
                                    }`}
                            >
                                {index + 1}
                            </div>
                            <p
                                className={`text-xs font-medium mt-1 ${step === index + 1 ? "text-blue-500" : "text-gray-500"
                                    }`}
                            >
                                {title}
                            </p>
                        </div>
                    ))}
                </div>

                {/* Step Progress Bar */}
                <Progress
                    value={(step / steps.length) * 100}
                    className="mb-6 transition-all duration-300"
                />

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    {/* Step 1: Business Info */}
                    {step === 1 && (
                        <div className="space-y-4">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
                            <Input {...register("name")} placeholder="Enter your name" />
                            {errors.name && <p className="text-red-500">{errors.name.message}</p>}

                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
                            <Input {...register("email")} placeholder="Enter your email" />
                            {errors.email && <p className="text-red-500">{errors.email.message}</p>}

                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Company Name</label>
                            <Input {...register("company_name")} placeholder="Enter company name" />
                            {errors.company_name && <p className="text-red-500">{errors.company_name.message}</p>}
                        </div>
                    )}

                    {/* Step 2: Budget & Industry */}
                    {step === 2 && (
                        <div className="space-y-4">
                            {/* Budget Section */}
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Monthly Ad Budget (Approximate or Exact)
                            </label>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                If you know your exact monthly budget, enter it below. Otherwise, select a range.
                            </p>

                            {/* Exact Budget Input */}
                            <Input
                                type="number"
                                min="0"
                                step="100"
                                placeholder="Enter approximate budget"
                                {...register("budget")}
                                className="w-full bg-white dark:bg-gray-700"
                            />

                            {/* Industry Selection */}
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Industry
                            </label>
                            <Select onValueChange={(value) => setValue("industry", value)}>
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select your industry" />
                                </SelectTrigger>
                                <SelectContent className="max-h-64 overflow-y-auto">
                                    {/* Technology & Digital Services */}
                                    <div className="px-2 text-gray-500 dark:text-gray-400 text-xs font-semibold mt-5">Technology & Digital Services</div>
                                    <SelectItem value="Technology">Technology</SelectItem>
                                    <SelectItem value="Software Development">Software Development</SelectItem>
                                    <SelectItem value="Cybersecurity">Cybersecurity</SelectItem>
                                    <SelectItem value="AI & Machine Learning">AI & Machine Learning</SelectItem>
                                    <SelectItem value="Web Development">Web Development</SelectItem>
                                    <SelectItem value="IT Services">IT Services</SelectItem>

                                    {/* Healthcare & Wellness */}
                                    <div className="px-2 text-gray-500 dark:text-gray-400 text-xs font-semibold mt-7">Healthcare & Wellness</div>
                                    <SelectItem value="Healthcare">Healthcare</SelectItem>
                                    <SelectItem value="Medical Devices">Medical Devices</SelectItem>
                                    <SelectItem value="Pharmaceuticals">Pharmaceuticals</SelectItem>
                                    <SelectItem value="Fitness & Wellness">Fitness & Wellness</SelectItem>
                                    <SelectItem value="Mental Health Services">Mental Health Services</SelectItem>
                                    <SelectItem value="Dental">Dental</SelectItem>

                                    {/* Finance & Business */}
                                    <div className="px-2 text-gray-500 dark:text-gray-400 text-xs font-semibold mt-7">Finance & Business</div>
                                    <SelectItem value="Finance">Finance</SelectItem>
                                    <SelectItem value="Banking">Banking</SelectItem>
                                    <SelectItem value="Insurance">Insurance</SelectItem>
                                    <SelectItem value="Accounting">Accounting</SelectItem>
                                    <SelectItem value="Consulting">Consulting</SelectItem>

                                    {/* Retail & E-commerce */}
                                    <div className="px-2 text-gray-500 dark:text-gray-400 text-xs font-semibold mt-7">Retail & E-commerce</div>
                                    <SelectItem value="Retail">Retail</SelectItem>
                                    <SelectItem value="E-commerce">E-commerce</SelectItem>
                                    <SelectItem value="Luxury Goods">Luxury Goods</SelectItem>
                                    <SelectItem value="Clothing & Fashion">Clothing & Fashion</SelectItem>
                                    <SelectItem value="Automotive Sales">Automotive Sales</SelectItem>

                                    {/* Beauty & Personal Care */}
                                    <div className="px-2 text-gray-500 dark:text-gray-400 text-xs font-semibold mt-7">Beauty & Personal Care</div>
                                    <SelectItem value="Spa & Wellness">Spa & Wellness</SelectItem>
                                    <SelectItem value="Hair Salon">Hair Salon</SelectItem>
                                    <SelectItem value="Cosmetics & Skincare">Cosmetics & Skincare</SelectItem>
                                    <SelectItem value="Nail Salon">Nail Salon</SelectItem>
                                    <SelectItem value="Barbershop">Barbershop</SelectItem>
                                    <SelectItem value="Tattoo & Piercing">Tattoo & Piercing</SelectItem>

                                    {/* Real Estate & Construction */}
                                    <div className="px-2 text-gray-500 dark:text-gray-400 text-xs font-semibold mt-7">Real Estate & Construction</div>
                                    <SelectItem value="Real Estate">Real Estate</SelectItem>
                                    <SelectItem value="Property Management">Property Management</SelectItem>
                                    <SelectItem value="Construction">Construction</SelectItem>
                                    <SelectItem value="Architecture">Architecture</SelectItem>
                                    <SelectItem value="Interior Design">Interior Design</SelectItem>

                                    {/* Other Industries */}
                                    <div className="px-2 text-gray-500 dark:text-gray-400 text-xs font-semibold mt-7">Other Industries</div>
                                    <SelectItem value="Non-Profit & Charity">Non-Profit & Charity</SelectItem>
                                    <SelectItem value="Legal Services">Legal Services</SelectItem>
                                    <SelectItem value="Transportation & Logistics">Transportation & Logistics</SelectItem>
                                    <SelectItem value="Energy & Sustainability">Energy & Sustainability</SelectItem>
                                    <SelectItem value="Other">Other</SelectItem>
                                </SelectContent>
                            </Select>

                            {/* Other Industry Input (Only Shows if "Other" is Selected) */}
                            {watch("industry") === "Other" && (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                        Please Specify Your Industry
                                    </label>
                                    <Input
                                        {...register("other_industry")}
                                        placeholder="Enter your industry"
                                        className="w-full bg-white dark:bg-gray-700"
                                    />
                                </div>
                            )}
                        </div>

                    )}

                    {/* Step 3: Business Stage */}
                    {step === 3 && (
                        <div className="space-y-4">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                What stage is your business in?
                            </label>
                            <Select onValueChange={(value) => setValue("business_stage", value)}>
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select your business stage" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Startup">Startup (Less than 1 year)</SelectItem>
                                    <SelectItem value="Growing">Growing Business (1-5 years)</SelectItem>
                                    <SelectItem value="Established">Established Business (5+ years)</SelectItem>
                                </SelectContent>
                            </Select>
                            {errors.business_stage && <p className="text-red-500">{errors.business_stage.message}</p>}
                        </div>
                    )}

                    {/* Step 4: Service Acknowledgment */}
                    {step === 4 && (
                        <div className="space-y-4">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Acknowledgment
                            </label>
                            <div className="flex items-center space-x-3">
                                <Checkbox
                                    id="acknowledge-checkbox"
                                    checked={Boolean(watch("acknowledges_service_terms"))}
                                    onCheckedChange={(checked) => setValue("acknowledges_service_terms", !!checked)}
                                    className="border-gray-400 text-green-500 focus:ring-green-500"
                                />
                                <label htmlFor="acknowledge-checkbox" className="text-gray-700 dark:text-gray-300 text-sm">
                                    I acknowledge that I will provide creatives or post regularly, and DeepVisor will manage ads accordingly.
                                </label>
                            </div>
                            {errors.acknowledges_service_terms && (
                                <p className="text-red-500 text-sm">{errors.acknowledges_service_terms.message}</p>
                            )}
                        </div>
                    )}
                    {step === 5 && (
                        <div className="space-y-6">
                            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Review Your Information</h3>

                            <div className="space-y-2 p-4 bg-gray-100 dark:bg-gray-700 rounded-md">
                                <p><strong>Name:</strong> {watch("name")}</p>
                                <p><strong>Email:</strong> {watch("email")}</p>
                                <p><strong>Company:</strong> {watch("company_name")}</p>
                                <p><strong>Business Stage:</strong> {watch("business_stage")}</p>
                                <p><strong>Budget:</strong> {watch("budget")}</p>
                                <p><strong>Industry:</strong> {watch("industry") === "Other" ? watch("other_industry") : watch("industry")}</p>
                                <p><strong>Service Agreement:</strong> {watch("acknowledges_service_terms") ? "Accepted" : "Not Accepted"}</p>
                            </div>

                        </div>
                    )}

                    {step === 6 && (
                        <div className="text-center">
                            {loading ? (
                                <div className="flex flex-col items-center space-y-4">
                                    <svg className="animate-spin h-8 w-8 text-blue-500" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 118 8V12z"></path>
                                    </svg>
                                    <p className="text-gray-500 dark:text-gray-300">Generating your free estimate...</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300">Your Free Monthly Estimate</h3>
                                    <p className="text-lg font-bold text-green-500">
                                        Total Monthly Budget: ${calculateEstimate().total}
                                    </p>
                                    <p className="text-md text-gray-500">
                                        <strong>Monthly Ad Spend:</strong> ${calculateEstimate().adSpend}
                                    </p>
                                    <p className="text-md text-gray-500">
                                        <strong>Service Charge:</strong> ${calculateEstimate().serviceCharge}
                                    </p>
                                    <p className="text-sm text-gray-500">This is an estimated monthly cost based on your business details.</p>
                                    <Button
                                        className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold"
                                        type="button"
                                        onClick={() => setStep(1)}
                                    >
                                        Start New Estimate
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}


                    {/* Navigation Buttons */}
                    <div className="flex justify-between">
                        {step > 1 && (
                            <Button className=" bg-primary-accent hover:bg-blue-100" type="button" onClick={() => setStep(step - 1)}>
                                Back
                            </Button>
                        )}
                        {step < 6 ? (
                            <Button
                                className=" bg-primary-accent hover:bg-blue-100"
                                type="button"
                                onClick={() => validateStep() && setStep(step + 1)}
                                disabled={!validateStep()}
                            >
                                Next
                            </Button>
                        ) : (
                            <Button
                                className="bg-green-500 hover:bg-green-600 text-white font-bold"
                                type="button"
                                onClick={() => setStep(6)}
                            >
                                Confirm & Get Estimate
                            </Button>
                        )}
                        {step == 6 ? (
                            <Button className=" bg-primary-accent hover:bg-blue-100" type="submit" disabled={loading}>
                                {loading ? "Submitting..." : "Submit"}
                            </Button>
                        ) : null}
                    </div>
                </form>
            </div>
        </div>
    );
}
