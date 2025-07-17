'use client';

import Link from 'next/link';

interface AdAccount {
    ad_account_id: string;
    name: string;
    account_status: string;
    industry: string;
}

interface AdAccountsTableProps {
    adAccountsData: AdAccount[];
    platform: string; // Platform parameter for dynamic routing
    isReportsSidebarOpen: boolean;
}

const getStatusLabel = (status: string): string => {
    switch (status) {
        case '1':
            return 'Active';
        case '2':
            return 'Disabled';
        case '3':
            return 'Pending Review';
        case '4':
            return 'Inactive';
        default:
            return 'Unknown';
    }
};

const AdAccountsTable: React.FC<AdAccountsTableProps> = ({ adAccountsData, platform, isReportsSidebarOpen }) => {
    return (
        <div
            className={`transition-all duration-300 bg-white shadow-lg p-6 rounded-lg ${isReportsSidebarOpen ? 'w-[calc(90%-4rem)]' : 'w-[calc(100%-4rem)]'
                }`}
        >
            <h3 className="text-lg font-bold">Ad Accounts</h3>
            <p className="text-sm text-gray-500 mb-2">
                Click on an Ad Account to view detailed statistics and performance metrics.
            </p>
            <div className="overflow-y-auto" style={{ maxHeight: '225px' }}>
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr>
                            <th className="border-b py-2">Ad Account Name</th>
                            <th className="border-b py-2">Ad Account ID</th>
                            <th className="border-b py-2">Status</th>
                            <th className="border-b py-2">Industry</th>
                        </tr>
                    </thead>
                    <tbody>
                        {adAccountsData.length > 0 ? (
                            adAccountsData.map((account) => {
                                const { ad_account_id, name, account_status, industry } = account;

                                return (
                                    <tr key={ad_account_id} className="hover:bg-gray-100 dark:hover:bg-gray-700">
                                        <td className="border-b py-3">
                                            <Link
                                                href={`/reports/platforms/${platform}/${ad_account_id}`}
                                                className="inline-block px-3 py-1 bg-blue-100 text-blue-600 rounded-full hover:bg-blue-200 hover:text-blue-700 transition-all truncate max-w-[225px]"
                                                style={{ textDecoration: 'none' }}
                                            >
                                                {name}
                                            </Link>
                                        </td>
                                        <td className="border-b py-3 truncate max-w-[150px]">{ad_account_id}</td>
                                        <td className="border-b py-3">
                                            <span
                                                className={`px-2 py-1 rounded text-sm ${account_status === '1'
                                                    ? 'bg-green-100 text-green-600'
                                                    : account_status === '2'
                                                        ? 'bg-red-100 text-red-600'
                                                        : account_status === '3'
                                                            ? 'bg-yellow-100 text-yellow-600'
                                                            : 'bg-gray-100 text-gray-600'
                                                    }`}
                                            >
                                                {getStatusLabel(account_status)}
                                            </span>
                                        </td>
                                        <td className="border-b py-3">{industry}</td>
                                    </tr>
                                );
                            })
                        ) : (
                            <tr>
                                <td colSpan={4} className="text-center text-gray-500 py-4">
                                    No ad account data available.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AdAccountsTable;
