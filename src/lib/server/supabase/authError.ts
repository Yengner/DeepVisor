import { ErrorCode, type ApiResponse } from "@/lib/shared";
import { fail } from "@/lib/shared/utils/responses";

type SupabaseAuthErrorLike = {
    message?: string;
    status?: number;
    code?: string;
    name?: string;
}

export function fromSupabaseAuthError(e: unknown): ApiResponse<never> {
    const error = e as SupabaseAuthErrorLike;
    const message = error.message ?? 'Supabase authentication error.';
    const status = error.status;
    const code = error.code;

    // 429 Too many requests
    if (status === 429 || code === "over_request_rate_limit") {
        return fail(message, ErrorCode.RATE_LIMITED, {
            userMessage: 'Too many requests. Please wait and try again later.',
            details: { status, code },
        });
    }

    // 403 Forbidden (feature not available / config)
    if (status === 403 || code === "provider_disabled" || code === "email_provider_disabled") {
        return fail(message, ErrorCode.UNAUTHORIZED, {
            userMessage: "This sign-in method is currently unavailable.",
            details: { status, code },
        });
    }

    // 422 Unprocessable Entity (request valid but cannot be satisfied in current state)
    if (status === 422 || code === "validation_failed" || code === "bad_json") {
        return fail(message, ErrorCode.VALIDATION_ERROR, {
            userMessage: "We couldn't process that request. Double-check your info and try again.",
            details: { status, code },
        });
    }

    // Known auth-specific cases
    switch (code) {
        case "invalid_credentials":
            return fail(message, ErrorCode.UNAUTHORIZED, {
                userMessage: "Incorrect email or password.",
                details: { status, code },
            });

        case "email_not_confirmed":
            return fail(message, ErrorCode.UNAUTHORIZED, {
                userMessage: "Please verify your email before signing in.",
                details: { status, code },
            });

        case "email_exists":
        case "user_already_exists":
        case "phone_exists":
            return fail(message, ErrorCode.VALIDATION_ERROR, {
                userMessage: "An account with that information already exists.",
                details: { status, code },
            });

        case "weak_password":
            return fail(message, ErrorCode.VALIDATION_ERROR, {
                userMessage: "Your password is too weak. Please choose a stronger one.",
                details: { status, code },
            });

        case "otp_expired":
        case "flow_state_expired":
        case "session_expired":
            return fail(message, ErrorCode.UNAUTHORIZED, {
                userMessage: "Your session expired. Please try again.",
                details: { status, code },
            });

        case "request_timeout":
            return fail(message, ErrorCode.EXTERNAL_API_ERROR, {
                userMessage: "Request timed out. Please try again.",
                details: { status, code },
            });

        case "unexpected_failure":
            return fail(message, ErrorCode.EXTERNAL_API_ERROR, {
                userMessage: "Auth service is having trouble right now. Please try again soon.",
                details: { status, code },
            });

        default:
            // 500 / 501 etc: treat as service/config issues
            if (status === 500) {
                return fail(message, ErrorCode.DATABASE_ERROR, {
                    userMessage: "We're having trouble on our side. Please try again soon.",
                    details: { status, code },
                });
            }
            if (status === 501) {
                return fail(message, ErrorCode.INTEGRATION_ERROR, {
                    userMessage: "This feature isn't enabled yet.",
                    details: { status, code },
                });
            }

            return fail(message, ErrorCode.UNKNOWN_ERROR, {
                userMessage: "Something went wrong. Please try again.",
                details: { status, code, name: error?.name },
            });
    }
}
