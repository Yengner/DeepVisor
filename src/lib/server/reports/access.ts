/** Distinguishes denied report scopes from database/renderer failures. */
export class ReportScopeError extends Error {}

export function reportExportError(error: unknown) {
  if (error instanceof ReportScopeError) {
    return { status: 403, message: 'Report scope is not authorized.' };
  }
  return { status: 500, message: 'Report export is unavailable. Please try again.' };
}
