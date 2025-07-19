import { ApiResponse, ErrorCode, ErrorDetails } from "@/lib/utils/error-handling/types/api";
import { DEFAULT_ERROR_MESSAGES } from "./constants";
import { NextResponse } from "next/server";

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

/**
 * Handle redirection after Meta OAuth connection
 */
export function redirectWithError(request: Request, isOnboarding: boolean, error: string) {
    if (isOnboarding) {
        return NextResponse.redirect(
            new URL(`${process.env.NEXT_PUBLIC_BASE_URL}/onboarding?platform=meta&status=error&error=${error}`, request.url)
        );
    } else {
        return NextResponse.redirect(
            `${process.env.NEXT_PUBLIC_BASE_URL}/integration/meta/unsuccessful?error=${error}`
        );
    }
}
