import { useState, useCallback, useEffect } from 'react';
import { showError } from '@/lib/utils/toasts';
import { UseFormReturnType } from '@mantine/form';
import { CampaignFormValues } from '@/lib/actions/meta/types';

interface UseCampaignStepsReturn {
  active: number;
  setActive: (value: number | ((current: number) => number)) => void;
  nextStep: () => void;
  prevStep: () => void;
}

/**
 * Hook for managing campaign creation steps with validation
 * @param form - The form object from useCampaignForm
 * @param totalSteps - Total number of steps in the campaign creation process
 * @returns Object with step state and navigation functions
*/

export function useCampaignSteps(
  form: UseFormReturnType<CampaignFormValues>,
  totalSteps: number = 7
): UseCampaignStepsReturn {
  const [active, setActive] = useState<number>(0);

  // Scroll to top when active step changes

  /* 
  I need to vent really quick on how annoying it was that next.js has this issue where window.scrollTo({ top: 0 }) doesnt work properly
  and will cost you a lot of time to figure out why your scroll is not working. Not only that but the community has given the best approach
  to fix this issue aka some dumb css issue where if you have html: overlflow-x or overflow-y set to hidden it will not work.
  NOT only that but timneutkens decides to close this issue before giving a proper solution or any infact in #Issue 5313 Link: https://github.com/vercel/next.js/issues/5313.
  I mean come on, this is a basic functionality that should work out of the box.
  I had to use document.getElementById('top') and scroll it into view to achieve the same effect.
  This is a workaround but it works and I am not going to waste more time on this.
  I hope next.js team fixes this in the future.
  - Love YB
  */
  useEffect(() => {
    const element = document.getElementById('top');
    element?.scrollIntoView({ behavior: 'smooth' });
  }, [active]);

  // Validation helper function
  const validateFormFields = useCallback((fields: string[]): boolean => {
    let isValid = true;
    const errors: Record<string, boolean> = {};

    fields.forEach(field => {
      if (!form.values[field as keyof CampaignFormValues]) {
        errors[field] = true;
        isValid = false;
      }
    });

    // Only validate the specific fields we're checking
    if (!isValid) {
      Object.keys(errors).forEach(field => {
        form.setFieldError(field, 'This field is required');
      });
    }

    return isValid;
  }, [form]);

  const nextStep = useCallback(() => {
    // Validate current step before proceeding
    switch (active) {
      case 0: // Objective step
        if (!validateFormFields(['objective'])) {
          showError('Please select a campaign objective');
          return;
        }
        break;

      case 1: // Campaign details
        if (!validateFormFields(['campaignName'])) {
          showError('Please fill in all required campaign details');
          return;
        }
        break;

      case 2: // Budget & Schedule
        if (!validateFormFields(['budget', 'budgetType', 'page_id']) || !form.values.startDate) {
          showError('Please set your budget and schedule');
          form.setFieldError('startDate', 'Start date is required');
          return;
        }

        // Additional validation for budget minimum
        if (form.values.budget < 5) {
          form.setFieldError('budget', 'Minimum budget is $5');
          return;
        }
        break;

      // case 3: // Location targeting
      //   if (!form.values.location.markerPosition) {
      //     showError('Please select a location for your campaign');
      //     return;
      //   }
      //   break;

      case 4: // Creative assets
        if (form.values.contentSource === 'upload') {
          const hasFiles = Array.isArray(form.values.uploadedFiles) &&
            form.values.uploadedFiles.length > 0;

          if (!hasFiles) {
            showError('Please upload at least one creative asset');
            return;
          }

          if (!form.values.headline || !form.values.primaryText) {
            showError('Please provide headline and primary text for your ad');
            !form.values.headline && form.setFieldError('headline', 'Headline is required');
            !form.values.primaryText && form.setFieldError('primaryText', 'Primary text is required');
            return;
          }
        } else if (form.values.contentSource === 'existing' &&
          (!form.values.existingPostIds || form.values.existingPostIds.length === 0)) {
          showError('Please select at least one existing post');
          return;
        }
        break;

      case 5: // Advanced targeting
        // Optional fields, no strict validation required
        break;
    }

    // Proceed to next step if validation passed
    setActive((current) => Math.min(current + 1, totalSteps - 1));
  }, [active, form, totalSteps, validateFormFields]);

  const prevStep = useCallback(() => {
    setActive((current) => Math.max(current - 1, 0));
  }, []);

  return { active, setActive, nextStep, prevStep };
}