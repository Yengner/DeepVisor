import { ApiResponse, ErrorCode, ErrorDetails } from "@/lib/shared/types/api";

export function ok<T>(data: T): ApiResponse<T> {
    return { success: true, data };
}

export function fail(
    message: string,
    code: ErrorCode = ErrorCode.UNKNOWN_ERROR,
    opts?: Partial<Pick<ErrorDetails, "userMessage" | "details">>
): ApiResponse<never> {
    console.log(`API Error - Code: ${code}, Message: ${message}`, opts?.details);
    return {
        success: false,
        error: {
            code,
            message,
            userMessage: opts?.userMessage ?? "An error occurred. Please try again later.",
            details: opts?.details,
        },
    };
}