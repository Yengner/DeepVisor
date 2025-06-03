'use client';

import SectionHeader from '@/components/public/SectionHeader';
import SingleFeature from '@/components/public/Features/SingleFeature';
import featuresData from '@/components/public/Features/featuresData';
import { FaEnvelope, FaPhoneAlt } from 'react-icons/fa';
import { motion } from "framer-motion";
import Image from "next/image";

export default function InvestorPage() {
    return (
        <div className="min-h-screen bg-white pt-28 p-20">
            {/* Hero Section */}
            <section className="py-20 lg:py-25 xl:py-30">
                <div className='mx-auto max-w-c-1315 px-4 md:px-8 xl:px-0'>
                    <SectionHeader
                        headerInfo={{
                            title: "WHY INVEST IN DEEPVISOR?",
                            subtitle: "Revolutionizing Marketing",
                            description: `DeepVisor is bridging the gap between innovative marketing strategies and
                            powerful SaaS solutions. With a focus on simplifying multi-platform integration, actionable
                            analytics, and AI-driven insights, we are set to transform how businesses manage their
                            digital marketing efforts. Join us in shaping the future of advertising.`,
                        }}
                    />
                    <div className="mt-12 grid grid-cols-1 gap-10 md:grid-cols-2 lg:mt-15 lg:grid-cols-3 xl:mt-20 xl:gap-12">
                        {/* <!-- Features item Start --> */}

                        {featuresData.map((feature, key) => (
                            <SingleFeature feature={feature} key={key} />
                        ))}
                        {/* <!-- Features item End --> */}
                    </div>
                </div>
            </section>

            {/* Vision and Mission */}
            <section className="overflow-hidden pb-20 lg:pb-25 xl:pb-30">
                <div className="mx-auto max-w-c-1235 px-4 md:px-8 xl:px-0">
                    <div className="flex items-center gap-8 lg:gap-32.5">
                        <motion.div
                            variants={{
                                hidden: {
                                    opacity: 0,
                                    x: -20,
                                },

                                visible: {
                                    opacity: 1,
                                    x: 0,
                                },
                            }}
                            initial="hidden"
                            whileInView="visible"
                            transition={{ duration: 0.5, delay: 0.1 }}
                            viewport={{ once: true }}
                            className="animate_left relative mx-auto hidden aspect-[588/526.5] md:block md:w-1/2"
                        >
                            <Image
                                src="/images/about/about-light-01.png"
                                alt="About"
                                fill
                            />

                        </motion.div>
                        <motion.div
                            variants={{
                                hidden: {
                                    opacity: 0,
                                    x: 20,
                                },

                                visible: {
                                    opacity: 1,
                                    x: 0,
                                },
                            }}
                            initial="hidden"
                            whileInView="visible"
                            transition={{ duration: 0.5, delay: 0.1 }}
                            viewport={{ once: true }}
                            className="animate_right md:w-1/2"
                        >
                            <span className="font-medium uppercase text-black">
                                <span className="mb-4 mr-4 inline-flex rounded-full bg-meta px-4 py-1 text-metatitle uppercase text-white ">
                                    New
                                </span>{" "}
                                A Complete Solution for
                            </span>
                            <h2 className="relative mb-6 text-3xl font-bold text-black xl:text-hero">
                                Simplifying Digital Marketing
                            </h2>
                            <p>
                                DeepVisor revolutionizes how businesses and agencies manage advertising with AI-powered recommendations, multi-platform integrations, and unparalleled transparency.
                            </p>
                        </motion.div>
                    </div>
                </div>
            </section>
            {/* <!-- ===== About End ===== --> */}

            {/* <!-- ===== About Two Start ===== --> */}
            <section>
                <div className="mx-auto max-w-c-1235 overflow-hidden px-4 md:px-8 2xl:px-0">
                    <div className="flex items-center gap-8 lg:gap-32.5">
                        <motion.div
                            variants={{
                                hidden: {
                                    opacity: 0,
                                    x: -20,
                                },
                                visible: {
                                    opacity: 1,
                                    x: 0,
                                },
                            }}
                            initial="hidden"
                            whileInView="visible"
                            transition={{ duration: 1, delay: 0.1 }}
                            viewport={{ once: true }}
                            className="animate_left md:w-1/2"
                        >
                            <h4 className="font-medium uppercase text-black ">
                                Empower Your Marketing Strategy
                            </h4>
                            <h2 className="relative mb-6 text-3xl font-bold text-black xl:text-hero">
                                Packed with {" "}
                                <span className="relative inline-block before:absolute before:bottom-2.5 before:left-0 before:-z-1 before:h-3 before:w-full before:bg-titlebg2 dark:before:bg-titlebgdark">
                                    Advanced Features
                                </span>
                            </h2>
                            <p>
                                DeepVisor provides the tools businesses need to excel in digital marketing. From multi-platform integrations and AI-driven insights to real-time analytics, our SaaS platform is designed to drive measurable results and simplify campaign management.
                            </p>

                        </motion.div>
                        <motion.div
                            variants={{
                                hidden: {
                                    opacity: 0,
                                    x: 20,
                                },
                                visible: {
                                    opacity: 1,
                                    x: 0,
                                },
                            }}
                            initial="hidden"
                            whileInView="visible"
                            transition={{ duration: 1, delay: 0.1 }}
                            viewport={{ once: true }}
                            className="animate_right relative mx-auto hidden aspect-[588/526.5] md:block md:w-1/2"
                        >
                            <Image
                                src="./images/about/about-light-02.svg"
                                alt="DeepVisor SaaS"
                                fill
                            />

                        </motion.div>
                    </div>
                </div>
            </section>

            {/* Marketing Agency */}
            <section className="px-6 py-16 max-w-5xl mx-auto">
                <h2 className="text-4xl font-bold text-center mb-8">Our Marketing Agency</h2>
                <p className="text-lg text-gray-700 leading-relaxed">
                    Our agency complements the SaaS platform by offering tailored marketing services
                    for businesses looking to enhance their online presence. We specialize in lead
                    generation, content optimization, and cross-platform campaign management.
                </p>
            </section>

            {/* Contact Section */}
            <section id="contact" className="px-6 py-16 max-w-5xl mx-auto text-center">
                <h2 className="text-4xl font-bold mb-8">Contact Us</h2>
                <p className="text-lg text-gray-700 mb-6">
                    Ready to discuss investment opportunities? Reach out to us today!
                </p>
                <div className="flex justify-center space-x-6">
                    <a
                        href="mailto:Deepvisormarketing@gmail.com"
                        className="flex items-center space-x-2 text-lg text-primary hover:underline"
                    >
                        <FaEnvelope />
                        <span>yengnerb@deepvisor.com</span>
                    </a>
                    <a
                        href="tel:+18139920108"
                        className="flex items-center space-x-2 text-lg text-primary hover:underline"
                    >
                        <FaPhoneAlt />
                        <span>(813) 992-0108</span>
                    </a>
                </div>
                <a
                    href="https://calendar.app.google/6ukZKMWvsypeBJiWA" // Update with your link
                    className="mt-8 inline-block px-8 py-3 bg-primary-accent text-white font-semibold rounded-md shadow hover:bg-secondary-dark transition"
                >
                    Schedule a Meeting
                </a>
            </section>
        </div>
    );
}
