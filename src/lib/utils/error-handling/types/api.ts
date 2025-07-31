export enum ErrorCode {
    UNAUTHORIZED = 'UNAUTHORIZED',
    NOT_FOUND = 'NOT_FOUND',
    VALIDATION_ERROR = 'VALIDATION_ERROR',
    INTEGRATION_ERROR = 'INTEGRATION_ERROR',
    DATABASE_ERROR = 'DATABASE_ERROR',
    EXTERNAL_API_ERROR = 'EXTERNAL_API_ERROR',
    RATE_LIMITED = 'RATE_LIMITED',
    UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export interface ErrorDetails {
    code: ErrorCode;
    message: string;         // Technical message
    userMessage: string;     // User-friendly message
    details?: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
}

export type ApiResponse<T> = {
    success: true;
    data: T;
} | {
    success: false;
    error: ErrorDetails;
};