'use client';

import { handleFreeEstimate } from '@/lib/actions/user.actions';
import React, { useState } from 'react';
import { FaFacebookF, FaTwitter, FaLinkedin, FaInstagram, FaEnvelope, FaPhoneAlt, FaMapMarkerAlt, FaUser } from 'react-icons/fa';

const FreeEstimate = () => {
    const [formData, setFormData] = useState({
        name: '',
        company: '',
        email: '',
        phone: '',
        budget: '',
        projectDetails: '',
        timeline: '',
        preferredContact: 'email',
        isFreeOption: false,
        estimatedIncome: '',
        termsAgreed: false,
    });

    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
    ) => {
        const { name, value, type } = e.target;

        if (type === 'checkbox') {
            // Handle checkboxes
            const checked = (e.target as HTMLInputElement).checked;
            setFormData({ ...formData, [name]: checked });
        } else {
            setFormData({ ...formData, [name]: value });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (formData.isFreeOption && (!formData.estimatedIncome || !formData.termsAgreed)) {
            alert('Please complete all fields required for the free option.');
            return;
        }

        setIsLoading(true);

        try {
            const result = await handleFreeEstimate(formData);

            if (result.success) {
                setIsSubmitted(true);
            } else {
                alert(`Error: ${result.error}`);
            }
        } catch (error) {
            console.error('Submission error:', error);
            alert('An error occurred while submitting the form. Please try again later.');
        } finally {
            setIsLoading(false);
        }
    };

    if (isSubmitted) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <div className="max-w-lg w-full bg-hero-background rounded-lg shadow-lg p-8 text-center">
                    <h1 className="text-3xl font-bold text-gray-900 mb-4">Request Submitted</h1>
                    <p className="text-gray-600 mb-8">
                        Thank you for submitting your request. We will review your information and contact you
                        as soon as possible.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white flex items-center justify-center relative pb-10 pt-28 md:pt-36 px-5">
            <div className="flex flex-col md:flex-row max-w-6xl w-full bg-gray-100 rounded-lg shadow-lg">

                {/* Left Column: Contact Information */}
                <div className="w-full md:w-1/3 bg-primary-accent p-8 rounded-l-lg flex flex-col justify-between">
                    <div>
                        <h1 className="text-4xl font-bold text-white mb-16 mt-5 text-center">Contact Us!</h1>

                        <div className="mb-6">
                            <h2 className="text-2xl font-bold text-white flex items-center mb-2">
                                <FaEnvelope className="mr-2 text-foreground-accent" /> Email Address
                            </h2>
                            <p className="text-white text-xl">info@deepvisor.com</p>
                        </div>

                        <div className="mb-6">
                            <h2 className="text-2xl font-bold text-white flex items-center mb-2">
                                <FaPhoneAlt className="mr-2 text-foreground-accent" /> Phone Number
                            </h2>
                            <p className="text-white text-xl">(813) 992-0108</p>
                        </div>

                        <div className="mb-6">
                            <h2 className="text-2xl font-bold text-white flex items-center mb-2">
                                <FaMapMarkerAlt className="mr-2 text-foreground-accent" /> Office Location
                            </h2>
                            <p className="text-white text-xl">Tampa, Florida</p>
                        </div>

                        <div className="mb-6">
                            <h2 className="text-2xl font-bold text-white flex items-center mb-2">
                                <FaUser className="mr-2 text-foreground-accent" /> Owner
                            </h2>
                            <p className="text-white text-xl">Yengner E. Bermudez</p>
                        </div>
                        {/* <div>
                            <iframe
                                src="https://www.google.com/maps/embed/v1/place?q=place_id:ChIJ4dG5s4K3wogRY7SWr4kTX6c&key=..."
                                width="100%"
                                height="200"
                                style={{ border: 0 }} // Corrected this line
                                allowFullScreen
                                loading="lazy"
                                referrerPolicy="no-referrer-when-downgrade"
                            ></iframe>
                        </div> */}
                        <div className="mt-6 text-center">
                            <a
                                href="https://calendar.app.google/6ukZKMWvsypeBJiWA"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-block px-6 py-3 bg-foreground-accent text-white font-bold text-lg rounded-lg shadow-md hover:bg-yellow-400 transition"
                            >
                                Schedule an Appointment
                            </a>
                        </div>
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-white mb-5 ">Social Media</h2>
                        <div className="flex space-x-4 mb-28 ">
                            <a href="https://www.facebook.com" target="_blank" rel="noopener noreferrer" className="text-white hover:text-yellow-300 transition">
                                <FaFacebookF className="w-6 h-6" />
                            </a>
                            <a href="https://www.twitter.com" target="_blank" rel="noopener noreferrer" className="text-white hover:text-yellow-300 transition">
                                <FaTwitter className="w-6 h-6" />
                            </a>
                            <a href="https://www.linkedin.com" target="_blank" rel="noopener noreferrer" className="text-white hover:text-yellow-300 transition">
                                <FaLinkedin className="w-6 h-6" />
                            </a>
                            <a href="https://www.instagram.com" target="_blank" rel="noopener noreferrer" className="text-white hover:text-yellow-300 transition">
                                <FaInstagram className="w-6 h-6" />
                            </a>
                        </div>
                    </div>
                </div>

                {/* Right Column: Free Estimate Form */}
                <div className="w-full md:w-2/3 p-8">
                    <h2 className="text-center text-sm font-bold text-blue-600 uppercase mb-2">Contact</h2>
                    <h1 className="text-center text-3xl font-bold text-gray-900 mb-4">Want To Hear From Us Personally?</h1>
                    <p className="text-center text-gray-600 mb-8">
                        Submit your details to receive a customized estimate for your project.
                    </p>
                    <form className="space-y-6" onSubmit={handleSubmit}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Full Name</label>
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    placeholder="Enter your full name"
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring focus:ring-blue-200"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Company/Business Name</label>
                                <input
                                    type="text"
                                    name="company"
                                    value={formData.company}
                                    onChange={handleChange}
                                    placeholder="Company or Business Name (Optional)"
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring focus:ring-blue-200"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Email</label>
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    placeholder="Enter your email"
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring focus:ring-blue-200"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Phone</label>
                                <input
                                    type="text"
                                    name="phone"
                                    value={formData.phone}
                                    onChange={handleChange}
                                    placeholder="Phone number"
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring focus:ring-blue-200"
                                    required
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Budget</label>
                            <p className="text-sm text-gray-500 mb-1">
                                Select the approximate budget for your project.
                            </p>
                            <select
                                name="budget"
                                value={formData.budget}
                                onChange={handleChange}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring focus:ring-blue-200"
                                required
                            >
                                <option value="" disabled>
                                    Select your budget
                                </option>
                                <option value="< $500">Less than $500</option>
                                <option value="$500 - $1,000">$500 - $1,000</option>
                                <option value="$1,000 - $5,000">$1,000 - $5,000</option>
                                <option value="$5,000 - $10,000">$5,000 - $10,000</option>
                                <option value="$10,000 - $25,000">$10,000 - $25,000</option>
                                <option value="$25,000 - $50,000">$25,000 - $50,000</option>
                                <option value="$50,000 - $100,000">$50,000 - $100,000</option>
                                <option value="$100,000+">More than $100,000</option>
                                <option value="Not Sure">Not Sure</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">
                                Project Details
                            </label>
                            <p className="text-sm text-gray-500 mb-1">
                                Share a brief description of your project needs or goals.
                            </p>
                            <textarea
                                name="projectDetails"
                                value={formData.projectDetails}
                                onChange={handleChange}
                                placeholder="e.g. Obtaining more leads or sales, create website, etc."
                                rows={4}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring focus:ring-blue-200"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">
                                Preferred Timeline
                            </label>
                            <p className="text-sm text-gray-500 mb-1">
                                When would you like to start this project?
                            </p>
                            <select
                                name="timeline"
                                value={formData.timeline}
                                onChange={handleChange}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring focus:ring-blue-200"
                            >
                                <option value="" disabled>
                                    Select a timeline
                                </option>
                                <option value="2 weeks">In 2 weeks</option>
                                <option value="1 month">In 1 month</option>
                                <option value="2 months">In 2 months</option>
                                <option value="3+ months">In 3+ months</option>
                            </select>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-700">
                                Preferred Contact Method
                            </p>
                            <p className="text-sm text-gray-500 mb-1">
                                How would you prefer us to contact you?
                            </p>
                            <div className="flex items-center space-x-4">
                                <label className="flex items-center">
                                    <input
                                        type="radio"
                                        name="preferredContact"
                                        value="email"
                                        checked={formData.preferredContact === 'email'}
                                        onChange={handleChange}
                                        className="form-radio"
                                    />
                                    <span className="ml-2 text-gray-700">Email</span>
                                </label>
                                <label className="flex items-center">
                                    <input
                                        type="radio"
                                        name="preferredContact"
                                        value="phone"
                                        checked={formData.preferredContact === 'phone'}
                                        onChange={handleChange}
                                        className="form-radio"
                                    />
                                    <span className="ml-2 text-gray-700">Phone</span>
                                </label>
                                <label className="flex items-center">
                                    <input
                                        type="radio"
                                        name="preferredContact"
                                        value="googleMeet"
                                        checked={formData.preferredContact === 'googleMeet'}
                                        onChange={handleChange}
                                        className="form-radio"
                                    />
                                    <span className="ml-2 text-gray-700">Google Meet</span>
                                </label>
                                <label className="flex items-center">
                                    <input
                                        type="radio"
                                        name="preferredContact"
                                        value="zoom"
                                        checked={formData.preferredContact === 'zoom'}
                                        onChange={handleChange}
                                        className="form-radio"
                                    />
                                    <span className="ml-2 text-gray-700">Zoom</span>
                                </label>
                                <label className="flex items-center">
                                    <input
                                        type="radio"
                                        name="preferredContact"
                                        value="microsoftTeams"
                                        checked={formData.preferredContact === 'microsoftTeams'}
                                        onChange={handleChange}
                                        className="form-radio"
                                    />
                                    <span className="ml-2 text-gray-700">Microsoft Teams</span>
                                </label>
                            </div>
                        </div>
                        <button
                            type="submit"
                            className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg font-semibold text-lg hover:bg-blue-700 focus:outline-none focus:ring focus:ring-blue-200 transition duration-150"
                        >
                            {isLoading ? 'Submitting...' : 'Submit Request'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default FreeEstimate;