'use client';

import { Suspense } from 'react';
import { LoadingState } from '@/components/ui/states/LoadingState';
import PaymentSuccessContent from './components/PaymentSuccessContent';

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<LoadingState message="Loading payment information..." />}>
      <PaymentSuccessContent />
    </Suspense>
  );
}