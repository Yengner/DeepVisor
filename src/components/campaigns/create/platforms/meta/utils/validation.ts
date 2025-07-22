import { CampaignFormValues } from '@/lib/actions/meta/types';
import { UseFormReturnType } from '@mantine/form';


type ValidateFormFields = (fields: string[]) => boolean;
type ShowError = (message: string) => void;

/**
 * Validates the current step for Meta campaigns
 * 
 * @param activeStep - Current step index
 * @param form - The form object from useCampaignForm
 * @param validateFormFields - Helper function to validate required fields
 * @param showError - Function to display error messages
 * @returns boolean - Whether validation passed
 */
/**
 * 
export function validateMetaStep(
    activeStep: number,
    form: UseFormReturnType<CampaignFormValues>,
    validateFormFields: ValidateFormFields,
    showError: ShowError
): boolean {
 */

export function validateMetaStep(
    activeStep: number,
    form: UseFormReturnType<any>,
    validateFormFields: ValidateFormFields,
    showError: ShowError
): boolean {
    switch (activeStep) {
        case 0: // Objective step
            if (!validateFormFields(['objective'])) {
                showError('Please select a campaign objective');
                return false;
            }
            return true;

        case 1: // Campaign details
            if (!validateFormFields(['campaignName'])) {
                showError('Please fill in all required campaign details');
                return false;
            }
            if (!form.values.budget) {
                showError('Please set your budget');
                form.setFieldError('budget', 'Please set your budget');
                return false;
            }
            return true;

        case 2: // Adset details
            if (!validateFormFields(['optimization_goal'])) {
                showError('Please Select an optimization goal');
                form.setFieldError('optimization_goal', 'Optimization goal is required');
                return false;
            }


        // case 3: // Ad Set
        //     // Add validation for Ad Set step
        //     return true;

        // case 4: // Creative assets
        //     if (form.values.contentSource === 'upload') {
        //         const hasFiles = Array.isArray(form.values.uploadedFiles) &&
        //             form.values.uploadedFiles.length > 0;

        //         if (!hasFiles) {
        //             showError('Please upload at least one creative asset');
        //             return false;
        //         }

        //         if (!form.values.headline || !form.values.primaryText) {
        //             showError('Please provide headline and primary text for your ad');
        //             !form.values.headline && form.setFieldError('headline', 'Headline is required');
        //             !form.values.primaryText && form.setFieldError('primaryText', 'Primary text is required');
        //             return false;
        //         }
        //     } else if (form.values.contentSource === 'existing' &&
        //         (!form.values.existingCreativeIds || form.values.existingCreativeIds.length === 0)) {
        //         showError('Please select at least one existing creative');
        //         return false;
        //     }
        //     return true;

        default:
            // For any other step, default to valid
            return true;
    }
}