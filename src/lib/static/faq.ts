import { IFAQ } from "@/lib/static/types";
import { siteDetails } from "./siteDetails";

export const faqs: IFAQ[] = [
  {
    question: `What services does ${siteDetails.siteName} offer?`,
    answer: `${siteDetails.siteName} specializes in two core services: high-converting paid advertising (primarily on Meta/Facebook) and quick-launch websites for small businesses. We also offer optional add-ons like social media setup, branding assets, and automation tools.`,
  },
  {
    question: `How fast can I get my website live with ${siteDetails.siteName}?`,
    answer: `Our Website Quick-Build service is designed to deliver modern, responsive landing pages or 5-page sites in as little as 3–5 days after kickoff. It’s a fast-track way to look professional without delays.`,
  },
  {
    question: `Can ${siteDetails.siteName} handle everything for me?`,
    answer: `Yes — from ad setup, targeting, and creative testing to landing page design and basic automation like lead follow-up, ${siteDetails.siteName} can manage your entire digital funnel for you.`,
  },
  {
    question: `What if I need automation or forms to capture leads?`,
    answer: `${siteDetails.siteName} can integrate smart automations using tools like n8n to connect forms, CRMs, email follow-ups, and more — saving you time while improving conversions. We use it for ourselves so we know it works.`,
  },
  {
    question: `Do I get to keep my website and assets if I stop working with you?`,
    answer: `Absolutely. Everything we build — from your website to your ad creative — is yours to keep. We believe in ownership and transparency.`,
  },
  {
    question: `What’s included in the paid ads service?`,
    answer: `We handle full Meta ad campaign setup, targeting, audience testing, budget allocation, and performance tracking. You’ll get detailed reports and we’ll make ongoing adjustments to improve ROI.`,
  },
];
