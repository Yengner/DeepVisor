'use client';

import React from 'react';
import { FaEnvelope, FaPhoneAlt } from 'react-icons/fa';
import { FiGlobe, FiCpu, FiLayers, FiTrendingUp, FiTarget, FiBarChart2 } from 'react-icons/fi';
import { motion } from 'framer-motion';
import Image from 'next/image';
import SectionHeader from '@/components/public/SectionHeader';

export default function InvestorPage() {
  // Inline features specifically for the SaaS
  const saasFeatures = [
    {
      icon: <FiGlobe size={28} className="text-primary" />,
      title: 'Global Multi-Platform',
      description:
        'One dashboard to create, publish & track paid ads across Meta, Google, TikTok, Reddit—and any future channel.',
    },
    {
      icon: <FiCpu size={28} className="text-primary" />,
      title: 'AI-Powered Automation',
      description:
        'Automatically generate ad creatives, landing page content, and follow-up sequences using your own photos and data.',
    },
    {
      icon: <FiLayers size={28} className="text-primary" />,
      title: 'Fractional Cost',
      description:
        'Enterprise-grade marketing at a fraction of the price—pass our cost savings on to any-sized business.',
    },
    {
      icon: <FiTarget size={28} className="text-primary" />,
      title: 'Smart Audience Targeting',
      description:
        'Leverage AI and real-time data to find and reach your highest-value customers automatically.',
    },
    {
      icon: <FiBarChart2 size={28} className="text-primary" />,
      title: 'Real-Time Analytics',
      description:
        'Monitor performance live, get instant insights, and let the system optimize budgets and bids for you.',
    },
    {
      icon: <FiTrendingUp size={28} className="text-primary" />,
      title: 'Rapid Onboarding',
      description:
        'Get set up in under a week—our engine connects your accounts, syncs data, and starts running ads immediately.',
    },
  ];

  return (
    <div className="min-h-screen bg-white pt-20 px-6 lg:px-24 text-black">
      {/* Hero Section */}
      <section className="py-20">
        <div className="mx-auto max-w-5xl text-center">
          <SectionHeader
            headerInfo={{
              title: 'WHY INVEST IN DEEPVISOR SAAS?',
              subtitle: 'A Global Automated Marketing Platform',
              description: `DeepVisor is building the world’s first 
                fully-automated, AI-driven marketing agency in a box. 
                Manage ads across every major platform, generate content 
                on the fly, and optimize budgets—all at a fraction of traditional costs.`,
            }}
          />
        </div>
      </section>

      {/* Features Grid */}
      <section className="pb-20">
        <div className="mx-auto max-w-6xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
          {saasFeatures.map((feature, idx) => (
            <motion.div
              key={idx}
              className="flex flex-col items-start p-6 bg-gray-50 rounded-lg shadow"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: idx * 0.1 }}
            >
              <div className="mb-4">{feature.icon}</div>
              <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
              <p className="text-gray-700">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Vision & Mission */}
      <section className="overflow-hidden pb-20">
        <div className="mx-auto max-w-5xl flex flex-col md:flex-row items-center gap-12">
          <motion.div
            className="relative w-full md:w-1/2 aspect-video"
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Image
              src="/images/about/about-light-02.svg"
              alt="DeepVisor SaaS"
              fill
              style={{ objectFit: 'cover' }}
            />
          </motion.div>
          <motion.div
            className="md:w-1/2"
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h4 className="text-sm uppercase text-primary font-medium mb-3">
              Our Vision
            </h4>
            <h2 className="text-3xl font-bold mb-5">
              Automate Marketing, Democratize Growth
            </h2>
            <p className="text-gray-700 leading-relaxed">
              We empower any business—big or small—to run world-class paid advertising campaigns 
              without hiring an agency. Our SaaS platform uses AI, smart automations, and 
              multi-channel integrations so you can scale faster and cheaper than ever before.
            </p>
          </motion.div>
        </div>
      </section>

      {/* SaaS + Agency */}
      <section className="py-16 bg-gray-50">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-4xl font-bold mb-6">SaaS & Agency in Harmony</h2>
          <p className="text-lg text-gray-700">
            While our SaaS handles the heavy lifting, our expert agency team 
            is on call for strategy, custom integrations, and premium support. 
            You get the flexibility to “DIY” or have us run everything— 
            all under one subscription.
          </p>
        </div>
      </section>

      {/* Contact / CTA */}
      <section id="contact" className="py-16 text-center">
        <h2 className="text-4xl font-bold mb-6">Get in Touch</h2>
        <p className="text-lg text-gray-700 mb-8">
          We’re raising to scale our platform and onboard early partners. 
          Interested in investing or piloting DeepVisor? Let’s talk.
        </p>
        <div className="flex justify-center space-x-8">
          <a
            href="mailto:yengnerb@deepvisor.com"
            className="flex items-center space-x-2 text-lg text-primary hover:underline"
          >
            <FaEnvelope /> <span>yengnerb@deepvisor.com</span>
          </a>
          <a
            href="tel:+18139920108"
            className="flex items-center space-x-2 text-lg text-primary hover:underline"
          >
            <FaPhoneAlt /> <span>(813) 992-0108</span>
          </a>
        </div>
        <a
          href="https://calendly.com/deepvisor/deepvisor-free-business-consultation-website-ads"
          className="mt-10 inline-block bg-primary-accent px-8 py-3 text-white font-semibold rounded-md shadow hover:bg-primary-dark transition"
        >
          Schedule a Meeting
        </a>
      </section>
    </div>
  );
}
