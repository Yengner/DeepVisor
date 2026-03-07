'use client';

import { Suspense } from 'react';
import { Loader, Center } from '@mantine/core';
import VerifyEmailContent from './components/VerifyEmailContent';

export default function VerifyEmailPage() {
    return (
        <Suspense fallback={
            <div className="flex justify-center items-center min-h-screen bg-gray-50 p-4">
                <Center>
                    <Loader size="xl" color="blue" />
                </Center>
            </div>
        }>
            <VerifyEmailContent />
        </Suspense>
    );
}