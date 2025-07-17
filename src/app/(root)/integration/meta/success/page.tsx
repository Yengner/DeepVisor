import { Suspense } from 'react';
import MetaIntegrationSuccess from '../../components/MetaIntegrationSuccess';

export default function MetaSuccessPage() {
    return (
        <Suspense fallback={<p>Loading...</p>}>
            <MetaIntegrationSuccess />
        </Suspense>
    );
}
