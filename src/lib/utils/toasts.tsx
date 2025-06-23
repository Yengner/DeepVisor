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

// For handling errors from API calls or other operations
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const handleError = (error: any) => {
  const message = error?.message || 'Something went wrong. Please try again.';
  return showError(message);
};