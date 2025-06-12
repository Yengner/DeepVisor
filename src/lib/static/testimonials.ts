import { ITestimonial } from "@/types/public/types";
import { siteDetails } from "./siteDetails";

export const testimonials: ITestimonial[] = [
    {
        name: 'J&J Sunshine Rental LLC',
        role: 'CEO at Company',
        message: `DeepVisor managed our paid ad campaigns across Meta and Google—delivering over $120K in bookings in just two months with a 5:1 ROAS. Their data-driven strategy turned ad spend into real revenue.`,
        avatar: '/images/testimonial-1.png',
    },
    {
        name: "Ada's Secret Salon Inc.",
        role: 'Salon Owner',
        message: `Thanks to ${siteDetails.siteName}, we saw +85 leads and added +$15K in revenue per month—all without additional calls.`,
        avatar: '/images/testimonial-3.png',
    },
    {
        name: 'Alexandra Gonzalez',
        role: 'Individual Hair Stylist',
        message: `The custom automation DeepVisor built for my client intake and follow-up saved me 10+ hours a week and boosted bookings by 30%.`,
        avatar: '/images/testimonial-2.jpg',
    },
];