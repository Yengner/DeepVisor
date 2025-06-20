import { Suspense } from 'react';
import { Container, Card, Skeleton } from '@mantine/core';
import SelectAccountForm from './components/SelectAccountForm';

// Loading component to show while SelectAccountForm is loading 
function SelectAccountLoading() {
    return (
        <Container size="sm" py="xl">
            <Card shadow="sm" p="lg" radius="md" withBorder>
                <Skeleton height={30} mb="lg" width="50%" />
                <Skeleton height={100} mb="xl" />
                <Skeleton height={20} mb="sm" width="30%" />
                <Skeleton height={16} mb="xl" width="70%" />

                {/* Radio options skeleton */}
                <div>
                    <Skeleton height={50} mb="md" />
                    <Skeleton height={50} mb="md" />
                    <Skeleton height={50} mb="md" />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                    <Skeleton height={36} width={100} />
                    <Skeleton height={36} width={150} />
                </div>
            </Card>
        </Container>
    );
}

export default function SelectAccountPage() {
    return (
        <Suspense fallback={<SelectAccountLoading />}>
            <SelectAccountForm />
        </Suspense>
    );
}