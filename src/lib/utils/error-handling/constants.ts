import { ErrorCode } from "@/lib/utils/error-handling/types/api";

export const DEFAULT_ERROR_MESSAGES: Record<ErrorCode, string> = {
    [ErrorCode.UNAUTHORIZED]: "You don't have permission to perform this action",
    [ErrorCode.NOT_FOUND]: "The requested resource could not be found",
    [ErrorCode.VALIDATION_ERROR]: "Please check your input and try again",
    [ErrorCode.INTEGRATION_ERROR]: "There was an issue with the integration",
    [ErrorCode.DATABASE_ERROR]: "We encountered a problem with our database",
    [ErrorCode.EXTERNAL_API_ERROR]: "We had trouble connecting to an external service",
    [ErrorCode.RATE_LIMITED]: "You've reached the limit of requests. Please try again later",
    [ErrorCode.UNKNOWN_ERROR]: "Something unexpected happened. Please try again"
};