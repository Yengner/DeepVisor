import type {
  CampaignReuseCreativeMode,
  CampaignReuseSourceType,
  CreateCampaignReuseDraftRequest,
  CreateCampaignReuseDraftResult,
} from '@/lib/shared/types/campaignDrafts';

export type ReuseDraftSourceType = CampaignReuseSourceType;

export type ReuseDraftBudgetType = CreateCampaignReuseDraftRequest['budgetType'];

export type ReuseDraftCreativeMode = CampaignReuseCreativeMode;

export type CreateReuseDraftInput = CreateCampaignReuseDraftRequest;

type CreateReuseDraftSuccess = {
  success: true;
  data: CreateCampaignReuseDraftResult;
};

type CreateReuseDraftFailure = {
  success: false;
  error:
    | string
    | {
        userMessage?: string;
        message?: string;
        details?: {
          fieldErrors?: Record<string, string>;
        };
      };
  fieldErrors?: Record<string, string>;
};

type CreateReuseDraftResponse = CreateReuseDraftSuccess | CreateReuseDraftFailure;

export class ReuseDraftError extends Error {
  readonly fieldErrors: Record<string, string>;

  constructor(message: string, fieldErrors?: Record<string, string>) {
    super(message);
    this.name = 'ReuseDraftError';
    this.fieldErrors = fieldErrors ?? {};
  }
}

export async function createReuseDraft(
  input: CreateReuseDraftInput
): Promise<CreateReuseDraftSuccess['data']> {
  const response = await fetch('/api/campaigns/reuse-draft', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  const body = (await response.json().catch(() => null)) as CreateReuseDraftResponse | null;

  if (!response.ok || !body?.success) {
    const fallbackMessage = 'The draft could not be created. Check your settings and try again.';
    const endpointError = body && !body.success ? body.error : null;
    const message = typeof endpointError === 'string'
      ? endpointError
      : endpointError?.userMessage || endpointError?.message || fallbackMessage;
    const fieldErrors = body && !body.success
      ? body.fieldErrors ?? (typeof body.error === 'object' ? body.error.details?.fieldErrors : undefined)
      : undefined;
    throw new ReuseDraftError(message, fieldErrors);
  }

  if (!body.data || typeof body.data.href !== 'string' || body.data.href.length === 0) {
    throw new ReuseDraftError('The draft was created without a review destination. Refresh and try again.');
  }

  return body.data;
}
