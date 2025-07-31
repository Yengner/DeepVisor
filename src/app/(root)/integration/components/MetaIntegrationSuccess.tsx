'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/utils/supabase/clients/browser';

interface AdAccount {
    id: string;
    name: string;
    account_status: number;
}

interface Industry {
    id: number;
    name: string;
}

const MetaIntegrationSuccess = () => {
    const [stage, setStage] = useState<'loading' | 'displayAccounts' | 'verifying' | 'success'>('loading');
    const [adAccounts, setAdAccounts] = useState<AdAccount[]>([]);
    const [industries, setIndustries] = useState<Industry[]>([]);
    const [selectedIndustries, setSelectedIndustries] = useState<Record<string, number>>({});
    const router = useRouter();
    const searchParams = useSearchParams();
    const supabase = createClient();

    useEffect(() => {
        const fetchIndustries = async () => {
            try {
                const { data, error } = await supabase.from('industry').select('id, name');
                if (error) throw error;
                setIndustries(data || []);
            } catch (error) {
                console.error('Error fetching industries:', (error as Error).message);
            }
        };

        fetchIndustries();

        // Parse ad accounts from search params
        let accounts = [];
        try {
            const adAccountsParam = searchParams.get('adAccounts') || '[]';
            accounts = JSON.parse(decodeURIComponent(adAccountsParam));
        } catch (error) {
            console.error('Failed to parse ad accounts:', error);
        }
        setAdAccounts(accounts);

        setStage('displayAccounts');
    }, [searchParams, supabase]);

    const handleIndustryChange = (accountId: string, industryId: number) => {
        setSelectedIndustries((prev) => ({
            ...prev,
            [accountId]: industryId,
        }));
    };

    const verifyIndustryUpdates = async () => {
        const failedAccounts = [];
        for (const account of adAccounts) {
            const { data, error } = await supabase
                .from('ad_accounts')
                .select('industry_id')
                .eq('ad_account_id', account.id)
                .single();

            if (error || !data || data.industry_id !== selectedIndustries[account.id]) {
                failedAccounts.push(account.id);
            }
        }
        return failedAccounts.length === 0;
    };

    const handleSubmit = async () => {
        try {
            await Promise.all(
                adAccounts.map((account) => {
                    const industryId = selectedIndustries[account.id];
                    if (industryId) {
                        console.log(`Updating industry for ad account: ${account.id} to ${industryId}`);
                        return supabase
                            .from('ad_accounts')
                            .update({ industry_id: industryId })
                            .eq('ad_account_id', account.id);
                    }
                })
            );

            setStage('verifying');

            const allUpdated = await verifyIndustryUpdates();
            if (allUpdated) {
                setStage('success');
                setTimeout(() => {
                    router.push('/integration');
                }, 2000);
            } else {
                alert('Failed to update some accounts. Please try again.');
                setStage('displayAccounts');
            }
        } catch (error) {
            console.error('Error updating industries:', error);
            setStage('displayAccounts');
        }
    };

    const getStatusDescription = (status: number) => {
        switch (status) {
            case 1:
                return 'Active';
            case 2:
                return 'Disabled';
            case 3:
                return 'Pending Review';
            case 7:
                return 'Inactive';
            default:
                return 'Unknown';
        }
    };

    return (
        <div className="flex items-center justify-center bg-gray-50 px-4">
            {stage === 'loading' && (
                <div className="text-center">
                    <p className="text-xl font-semibold mb-4">Fetching data...</p>
                </div>
            )}
            {stage === 'displayAccounts' && (
                <div className="w-full max-w-lg">
                    <p className="text-xl font-semibold mb-4 text-center">Ad Accounts Found:</p>
                    <ul className="space-y-6">
                        {adAccounts.map((account) => (
                            <li key={account.id} className="bg-white p-4 rounded-md shadow-md">
                                <p className="font-bold text-lg">{account.name}</p>
                                <p>Status: {getStatusDescription(account.account_status)}</p>
                                <select
                                    value={selectedIndustries[account.id] || ''}
                                    onChange={(e) => handleIndustryChange(account.id, Number(e.target.value))}
                                >
                                    <option value="" disabled>
                                        Choose an industry
                                    </option>
                                    {industries.map((industry) => (
                                        <option key={industry.id} value={industry.id}>
                                            {industry.name}
                                        </option>
                                    ))}
                                </select>
                            </li>
                        ))}
                    </ul>
                    <button onClick={handleSubmit}>Save and Continue</button>
                </div>
            )}
            {stage === 'verifying' && <p>Verifying...</p>}
            {stage === 'success' && <p>Integration Successful!</p>}
        </div>
    );
};

export default MetaIntegrationSuccess;
