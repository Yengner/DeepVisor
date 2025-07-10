import { ApiResponse, ErrorCode, ErrorDetails } from "@/lib/types/api";
import { DEFAULT_ERROR_MESSAGES } from "./constants";

export function createErrorResponse(
    code: ErrorCode,
    message: string,
    userMessage?: string,
    details?: Record<string, any>
): ApiResponse<never> {
    return {
        success: false,
        error: {
            code,
            message,
            userMessage: userMessage || DEFAULT_ERROR_MESSAGES[code],
            details
        }
    };
}

export function createSuccessResponse<T>(data: T): ApiResponse<T> {
    return {
        success: true,
        data
    };
}