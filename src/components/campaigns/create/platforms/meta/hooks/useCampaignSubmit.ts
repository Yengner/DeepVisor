import { useState } from 'react';
import { CampaignFormValues } from '@/lib/server/actions/meta/types';

/**
 * Submit step of the "Add ad set" and "Add ad" builders.
 *
 * `/api/meta/create-campaign` does not exist, so these builders are hidden
 * (`META_CHILD_CREATION_AVAILABLE`). A real implementation plugs in here, either by saving
 * a draft in DeepVisor or by calling an approved, server-authorized publish path.
 */
export function useCampaignSubmit() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const submitCampaign = async (form: CampaignFormValues): Promise<void> => {
    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);

    try {
      const res = await fetch('/api/meta/create-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const result = await res.json();
      if (!result.success) {
        setSubmitError(result.error || 'Failed to create campaign');
        return;
      }
      setSubmitSuccess(true);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return { submitCampaign, isSubmitting, submitError, submitSuccess };
}
