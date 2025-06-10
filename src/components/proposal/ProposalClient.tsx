'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface ProposalClientProps {
    token: string;
    firstName: string;
    lastName: string;
    businessName: string;
    email: string;
    phoneNumber: string;
    address: string;
    serviceType: string;
    addOnServices?: string;
    startDate: string;
    dealId: string;
    docId: string;
    totalPrice: number;
    adSpend: number;
    serviceFee: number;
    note?: string;
    status: 'sent' | 'accepted' | 'revision_requested';
}

export default function ProposalClient({
    token,
    firstName,
    lastName,
    email,
    businessName,
    phoneNumber,
    address,
    serviceType,
    addOnServices,
    startDate,
    dealId,
    docId,
    totalPrice,
    adSpend,
    serviceFee,
    note,
    status,
}: ProposalClientProps) {
    const router = useRouter();
    const [submitting, setSubmitting] = useState(false);
    const [revisionText, setRevisionText] = useState('');
    const [showRevisionBox, setShowRevisionBox] = useState(false);

    useEffect(() => {
        if (token) {
            localStorage.setItem('proposalToken', token);
        }
    }, [token]);

    useEffect(() => {
        const storedToken = localStorage.getItem('proposalToken');
        if (storedToken) {
            console.log('Retrieved token from localStorage:', storedToken);
        }
    }, []);

    const handleAccept = async () => {
        setSubmitting(true);
        try {
            await fetch('/api/proposal/respond', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, action: 'accept', email, phoneNumber, address, serviceType, addOnServices, businessName, dealId }),
            });
            router.replace(`/proposal/${token}?status=accepted`);
        } catch (error) {
            console.error('Error accepting proposal', error);
            setSubmitting(false);
        }
    };

    const handleRevision = async () => {
        if (!revisionText.trim()) {
            alert("Please describe what you'd like changed in the proposal.");
            return;
        }
        setSubmitting(true);
        try {
            await fetch('/api/proposal/respond', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, action: 'revision', notes: revisionText }),
            });
            router.replace(`/proposal/${token}?status=revision_requested`);
        } catch (error) {
            console.error('Error requesting revision', error);
            setSubmitting(false);
        }
    };

    if (status === 'accepted') {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-8">
                <div className="bg-white rounded-lg shadow-lg p-8 max-w-lg text-center">
                    <div className="text-green-600 mb-4">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-16 w-16 mx-auto"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                        </svg>
                    </div>
                    <h1 className="text-3xl font-bold text-green-700 mb-4">🎉 Proposal Accepted</h1>
                    <p className="text-gray-700 mb-6">
                        Thank you, <span className="font-semibold">{firstName}</span>. We have received your acceptance. Our team will be in touch with you very soon to proceed further.
                    </p>
                    <button
                        onClick={() => window.open('https://deepvisor.com/contact-us', '_blank')}
                        className="bg-green-600 hover:bg-green-700 text-white py-3 px-6 rounded-lg text-lg font-medium shadow-md transition duration-200"
                    >
                        📧 Contact Us for Questions
                    </button>
                </div>
            </div>
        );
    }

    if (status === 'revision_requested') {
        return (
            <div className="text-center p-8">
                <h1 className="text-3xl font-bold text-yellow-700 mb-4">✏️ Revision Requested</h1>
                <p>
                    Hi {firstName}, we got your feedback. We&apos;ll revise the proposal and send you an updated link as soon as it&apos;s ready.
                </p>
            </div>
        );
    }

    const fullName = `${firstName} ${lastName}`;

    return (
        <div className="space-y-8">
            {/* Responsive Layout */}
            <div className="flex flex-col md:flex-row md:space-x-8">
                {/* Quick Review Section */}
                <div className="bg-white rounded-lg shadow p-6 md:w-1/2">
                    <h1 className="text-2xl font-semibold mb-4">Quick Review</h1>
                    <ul className="list-disc list-inside text-gray-700 space-y-2">
                        <li><strong>Full Name:</strong> {fullName}</li>
                        <li><strong>Email:</strong> {email}</li>
                        <li><strong>Business Name:</strong> {businessName}</li>
                        <li><strong>Phone Number:</strong> {phoneNumber}</li>
                        <li><strong>Address:</strong> {address}</li>
                        <li><strong>Service Type:</strong> {serviceType}</li>
                        <li><strong>Add-On Services:</strong> {addOnServices || 'None'}</li>
                        <li><strong>Start Date:</strong> {startDate}</li>
                        <li><strong>Ad Spend:</strong> ${adSpend}</li>
                        <li><strong>Service Fee:</strong> ${serviceFee}</li>
                        <li><strong>Total Price:</strong> ${totalPrice}/Month</li>
                        {note && <li><strong>Notes:</strong>{note}</li>}
                    </ul>
                </div>

                {/* Google Doc Embed Section */}
                <div className="bg-gray-50 rounded-lg shadow p-6 md:w-1/2">
                    <h2 className="text-xl font-semibold mb-4">Detailed Proposal</h2>
                    <iframe
                        src={`https://docs.google.com/document/d/${docId}/preview`}
                        width="100%"
                        height="500px"
                        className="border rounded"
                        title="Proposal Preview"
                    ></iframe>
                    <div className="flex justify-center space-x-4 mt-4">
                        <button
                            onClick={() =>
                                navigator.clipboard.writeText(`https://docs.google.com/document/d/${docId}/edit`)
                            }
                            className="bg-blue-600 text-white py-2 px-4 rounded text-sm font-medium"
                        >
                            📋 Copy Link
                        </button>
                        <button
                            onClick={() =>
                                window.open(`https://docs.google.com/document/d/${docId}/edit`, '_blank')
                            }
                            className="bg-gray-800 text-white py-2 px-4 rounded text-sm font-medium"
                        >
                            🔍 View Fullscreen
                        </button>
                    </div>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="bg-white rounded-lg shadow p-6 space-y-4">
                <button
                    onClick={handleAccept}
                    disabled={submitting}
                    className="w-full bg-emerald-600 text-white py-3 rounded text-lg font-medium disabled:opacity-50"
                >
                    ✅ Accept Proposal
                </button>

                {!showRevisionBox && (
                    <button
                        onClick={() => setShowRevisionBox(true)}
                        disabled={submitting}
                        className="w-full bg-yellow-600 text-white py-3 rounded text-lg font-medium disabled:opacity-50"
                    >
                        ✏️ Request Revision
                    </button>
                )}

                {showRevisionBox && (
                    <div className="space-y-2">
                        <textarea
                            rows={4}
                            placeholder="Please let us know what changes you’d like…"
                            value={revisionText}
                            onChange={(e) => setRevisionText(e.target.value)}
                            className="w-full border rounded p-2"
                        />
                        <button
                            onClick={handleRevision}
                            disabled={submitting}
                            className="w-full bg-yellow-700 text-white py-3 rounded text-lg font-medium disabled:opacity-50"
                        >
                            📩 Submit Revision Request
                        </button>
                    </div>
                )}

                <button
                    onClick={() =>
                        window.open(
                            `mailto:info@deepvisor.com?subject=Need%20Help%20with%20Proposal`,
                            '_blank'
                        )
                    }
                    className="w-full bg-gray-200 text-gray-800 py-2 rounded text-base"
                >
                    📞 Need Help? Email Us
                </button>
            </div>
        </div>
    );
}
