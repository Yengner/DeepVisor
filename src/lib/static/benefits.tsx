import { IBenefit } from "@/types/public/types";
import { FiZap, FiGlobe, FiClipboard, FiMessageSquare, FiCpu, FiTrendingUp, FiTool } from "react-icons/fi";

export const benefits: IBenefit[] = [
    {
        title: "Rapid Ad Campaign Launch",
        description: "Get your paid ads up and running fast — with strategy, creatives, targeting, and optimization handled by DeepVisor.",
        bullets: [
            {
                title: "Full Funnel Setup",
                description: "From audience research to creative testing and pixel tracking — we handle it all.",
                icon: <FiZap size={26} />
            },
            {
                title: "Meta Advertising Experts",
                description: "We specialize in high-converting ads on Facebook and Instagram, built for results.",
                icon: <FiMessageSquare size={26} />
            },
            {
                title: "Real-Time Optimization",
                description: "We monitor and tweak your campaigns to get the best possible performance.",
                icon: <FiTrendingUp size={26} />
            }
        ],
        imageSrc: "/images/paper.png"
    },
    {
        title: "Quick Website Builds",
        description: "Need a site fast? We create clean, conversion-focused websites and landing pages in just days.",
        bullets: [
            {
                title: "Modern & Responsive",
                description: "Every site is mobile-ready, SEO-optimized, and easy to maintain.",
                icon: <FiGlobe size={26} />
            },
            {
                title: "Done-for-You Setup",
                description: "We’ll design, build, and publish your site.",
                icon: <FiTool size={26} />
            },
            {
                title: "Perfect for Ads",
                description: "Landing pages that are designed specifically to convert your paid traffic.",
                icon: <FiClipboard size={26} />
            }
        ],
        imageSrc: "/images/marketing-dashboard.png"
    },
    {
        title: "Smart Automations & Data",
        description: "Save time and scale smarter with automations for lead capture, follow-ups, and insights.",
        bullets: [
            {
                title: "Lead Form Automation",
                description: "Connect your website, ads, and forms to CRMs or emails.",
                icon: <FiCpu size={26} />
            },
            {
                title: "Integrated Payment Tracking",
                description: "Track client information, invoices, and lead cycles from one place.",
                icon: <FiClipboard size={26} />
            },
            {
                title: "Transparent Reports",
                description: "See your results clearly — no fluff. Just the data that drives decisions.",
                icon: <FiTrendingUp size={26} />
            }
        ],
        imageSrc: "/images/automation.svg"
    }
];
