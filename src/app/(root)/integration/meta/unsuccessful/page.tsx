'use client';

import { useRouter } from 'next/navigation';

const IntegrationUnsuccessful = () => { // Make this into a component
    const router = useRouter();

    const handleRetry = () => {
        router.push('/integration'); // Redirect to retry the integration
    };

    return (
        <div className="flex items-center justify-center bg-gray-50">
            <div className="bg-white p-8 rounded-lg shadow-md text-center max-w-lg">
                <h1 className="text-3xl font-bold text-red-600 mb-4">Integration Failed</h1>
                <p className="text-gray-700 mb-6">
                    Unfortunately, something went wrong during the integration process. Please try again or contact support if the issue persists.
                </p>
                <div className="flex justify-center space-x-4">
                    <button
                        onClick={handleRetry}
                        className="px-6 py-2 bg-blue-500 text-white rounded-lg shadow hover:bg-blue-600 transition"
                    >
                        Retry Integration
                    </button>
                    <button
                        onClick={() => router.push('/help')}
                        className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg shadow hover:bg-gray-300 transition"
                    >
                        Get Help
                    </button>
                </div>
            </div>
        </div>
    );
};

export default IntegrationUnsuccessful;

