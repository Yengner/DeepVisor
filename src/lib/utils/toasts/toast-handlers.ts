import { ApiResponse, ErrorCode, ErrorDetails } from "@/lib/types/api";
import { showError, showSuccess } from "../toasts";
import { DEFAULT_ERROR_MESSAGES } from "../error-handling/constants";

interface ToastOptions {
    successTitle?: string;
    errorTitle?: string;
}

/**
 * Get appropriate error title based on error code
 */
function getErrorTitle(errorCode: ErrorCode): string {
    switch (errorCode) {
        case ErrorCode.VALIDATION_ERROR:
            return 'Invalid Input';
        case ErrorCode.UNAUTHORIZED:
            return 'Authentication Error';
        case ErrorCode.DATABASE_ERROR:
            return 'Database Error';
        case ErrorCode.EXTERNAL_API_ERROR:
            return 'Connection Error';
        default:
            return 'Error';
    }
}

/**
 * Handle promises that return API responses with appropriate toasts
 */
export async function handleApiPromise<T>(
    promise: Promise<ApiResponse<T>>,
    options: ToastOptions & {
        onSuccess?: (data: T) => void,
        onError?: (error: ErrorDetails) => void,
        successMessage?: string,
        showSuccessToast?: boolean,
        showErrorToast?: boolean
    }
): Promise<T | null> {
    try {
        const response = await promise;

        if (response.success) {
            // Handle success case
            if (options.onSuccess) {
                options.onSuccess(response.data);
            }

            // Show success toast if enabled and we have a message
            if (options.showSuccessToast !== false && options.successMessage) {
                showSuccess(options.successMessage, options.successTitle);
            }

            return response.data;
        } else {
            // Handle error case
            console.error("API error:", response.error);

            // Call onError callback if provided
            if (options.onError) {
                options.onError(response.error);
            }

            // Show error toast if enabled (default: true)
            if (options.showErrorToast !== false) {
                showError(
                    response.error.userMessage,
                    options.errorTitle || getErrorTitle(response.error.code)
                );
            }

            return null;
        }
    } catch (err) {
        console.error('Unexpected error in API call:', err);

        if (options.showErrorToast !== false) {
            showError(
                'Something went wrong with your request',
                options.errorTitle || 'Error'
            );
        }

        return null;
    }
}