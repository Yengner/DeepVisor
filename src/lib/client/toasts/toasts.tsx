"use client";

import toast from 'react-hot-toast';
import { SuccessToast } from '@/components/ui/toasts/SuccessToast';
import { ErrorToast } from '@/components/ui/toasts/ErrorToast';

// Show success toast with custom message and optional title
export const showSuccess = (message: string, title?: string) => {
  return toast.custom(
    <SuccessToast message={message} title={title} />,
    { duration: 4000 }
  );
};

// Show error toast with custom message and optional title
export const showError = (message: string, title?: string) => {
  return toast.custom(
    <ErrorToast message={message} title={title} />,
    { duration: 6000 }
  );
};
