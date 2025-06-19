'use client';

import { Suspense } from 'react';
import { LoadingState } from '@/components/ui/states/LoadingState';
import PaymentSuccessContent from './component/PaymentSuccessContent';

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<LoadingState message="Loading payment information..." />}>
      <PaymentSuccessContent />
    </Suspense>
  );
}