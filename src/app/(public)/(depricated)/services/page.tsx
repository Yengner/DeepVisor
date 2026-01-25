import React from "react";
import Image from "next/image";

const mainServices = [
  {
    title: "Paid Lead Generation",
    description:
      "Launch high-converting Meta ad campaigns tailored to your objectives—whether it’s generating leads, messages, or website traffic.",
    image: "/images/services/paid-ads.png",
  },
  {
    title: "Quick Website Builds",
    description:
      "Get a conversion-focused landing page or mini-site (up to 5 pages) built in days—perfect for your ad campaigns or new launches.",
    image: "/images/services/website-build.png",
  },
];

const addOnServices = [
  {
    title: "Social Media Page Setup",
    description:
      "We’ll set up or optimize your Facebook, Instagram, or TikTok business profiles for consistent branding and maximum reach.",
    image: "/images/services/social-setup.png",
  },
  {
    title: "Automated Lead Follow-Up",
    description:
      "Streamline your lead nurture with custom workflows: form captures, email/SMS follow-ups, and CRM sync using n8n.",
    image: "/images/services/automation.png",
  },
  {
    title: "Mini Content Package",
    description:
      "Receive 3–5 on-brand posts or reels each month to fuel your social channels and ad creative library.",
    image: "/images/services/content-package.png",
  },
];

export default function Services() {
  const Card: React.FC<{ title: string; description: string; image: string }> = ({ title, description, image }) => (
    <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 overflow-hidden">
      <div className="relative w-full h-96">
        <Image
          src={image}
          alt={title}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          style={{ objectFit: "cover" }}
        />
      </div>
      <div className="p-6">
        <h3 className="text-xl font-semibold">{title}</h3>
        <p className="text-gray-700 mt-2">{description}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-white px-8 lg:px-24 text-black space-y-16 pb-14">
      {/* Core Services */}
      <section>
        <h2 className="text-sm uppercase font-semibold tracking-wider text-gray-600">
          Our Core Services
        </h2>
        <h1 className="text-3xl lg:text-4xl font-bold mt-2">Main Services</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
          {mainServices.map((svc, i) => (
            <Card key={i} {...svc} />
          ))}
        </div>
      </section>

      {/* Add-On Services */}
      <section>
        <h2 className="text-sm uppercase font-semibold tracking-wider text-gray-600">
          Additional Add-Ons
        </h2>
        <h1 className="text-3xl lg:text-4xl font-bold mt-2">
          Enhance Your Package
        </h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mt-8">
          {addOnServices.map((svc, i) => (
            <Card key={i} {...svc} />
          ))}
        </div>
      </section>
    </div>
  );
}
