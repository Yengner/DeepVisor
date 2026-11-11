'use client';
import { ErrorState } from '@/components/ui/states/ErrorState';

/** Fallback for signed-in routes without their own boundary. Copy reuses existing app strings. */
export default function AppError({ reset }: { reset: () => void }) {
  return (
    <ErrorState
      message="Your account or saved data could not be loaded."
      primaryAction={{ label: 'Manage connections', href: '/integration' }}
      secondaryAction={{ label: 'Try again', href: '', onClick: reset }}
    />
  );
}
