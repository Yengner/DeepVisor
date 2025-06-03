
import ProposalClient from '@/components/proposal/ProposalClient';
import { createSupabaseClient } from '@/lib/utils/supabase/clients/server';


interface PageProps {
    params: { token: string };
    searchParams: { status?: string };
}

export default async function ProposalPage({ params, searchParams }: PageProps) {
    const { token } = await params;
    const supabase = await createSupabaseClient();

    // 1) Fetch the session row from Supabase
    const { data: session, error } = await supabase
        .from('proposal_sessions')
        .select('*')
        .eq('token', token)
        .single();

    if (error || !session) {
        // If no session is found, show Next.js 404
        // return notFound();
        // For now just show a simple error message
        return (
            <div className="min-h-screen flex items-center justify-center">
                <h1 className="text-2xl font-bold text-red-600">Proposal not found</h1>
            </div>
        );
    }

    let status = session.status;
    if (searchParams.status === 'accepted') {
        status = 'accepted';
    } else if (searchParams.status === 'revision_requested') {
        status = 'revision_requested';
    }

    return (
        <div className="min-h-screen bg-gray-50 p-4 pt-36">
            <div className="w-full mx-auto bg-white rounded-lg shadow p-6">
                <ProposalClient
                    token={token}
                    firstName={session.first_name}
                    lastName={session.last_name}
                    businessName={session.business_name}
                    email={session.email}
                    phoneNumber={session.phone_number}
                    address={session.address}
                    serviceType={session.service_type}
                    addOnServices={session.add_on_services}
                    startDate={session.start_date}
                    docId={session.doc_Id}
                    totalPrice={session.total_pricing}
                    adSpend={session.ad_spend}
                    serviceFee={session.service_fee}
                    note={session.notes}
                    status={status}

                />
            </div>
        </div>
    );
}