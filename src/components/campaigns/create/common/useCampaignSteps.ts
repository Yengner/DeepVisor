import { useState, useCallback, useEffect } from 'react';
import { showError } from '@/lib/utils/toasts';
import { validateMetaStep } from '../platforms/meta/utils/validation';

/**
 * Core hook for managing campaign creation steps with platform-specific validation
 * @param form - The form object from useCampaignForm
 * @param totalSteps - Total number of steps in the campaign creation process
 * @returns Object with step state and navigation functions
*/

/**export function useCampaignSteps(
  form: UseFormReturnType<CampaignFormValues>,
  totalSteps: number = 7
): UseCampaignStepsReturn {
*/

/* eslint-disable */

export function useCampaignSteps(
  form: any,
  totalSteps: number = 7
): any {
  const [active, setActive] = useState<number>(0);

  // Scroll to top when active step changes
  useEffect(() => {
    const element = document.getElementById('top');
    element?.scrollIntoView({ behavior: 'smooth' });
  }, [active]);

  // Generic field validation helper (can be used by any platform)
  const validateFormFields = useCallback((fields: string[]): boolean => {
    let isValid = true;
    const errors: Record<string, boolean> = {};

    // fields.forEach(field => {
    //   if (!form.values[field as keyof CampaignFormValues]) {
    //     errors[field] = true;
    //     isValid = false;
    //   }
    // });

    if (!isValid) {
      Object.keys(errors).forEach(field => {
        form.setFieldError(field, 'This field is required');
      });
    }

    return isValid;
  }, [form]);

  const nextStep = useCallback(() => {
    const platform = form.values.platform;
    let isValid = false;

    // Call platform-specific validation based on platform type
    switch (platform) {
      case 'meta':
        isValid = validateMetaStep(active, form, validateFormFields, showError);
        break;

      default:
        showError(`Unsupported platform: ${platform}`);
        return;
    }

    // Only proceed if validation passes
    if (isValid) {
      setActive((current) => Math.min(current + 1, totalSteps - 1));
    }
  }, [active, form, totalSteps, validateFormFields]);

  const prevStep = useCallback(() => {
    setActive((current) => Math.max(current - 1, 0));
  }, []);

  return { active, setActive, nextStep, prevStep };
}