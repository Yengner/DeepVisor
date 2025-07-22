import { useCallback, useRef, useEffect } from 'react';
import { UseFormReturnType } from '@mantine/form';
import { CampaignFormValues } from '@/lib/actions/meta/types';
import { getDefaultOptimizationGoal, getValidDestinationTypes } from '../utils/objectiveMappings';

/**
 * Return type for useObjectiveMapping hook
 */
interface UseObjectiveMappingReturn {
    /** Handler for objective changes, updates related form fields */
    handleObjectiveChange: (value: string) => void;
    /** Handler for destination type changes, updates optimization goals */
    handleDestinationChange: (value: string) => void;
}

/**
 * Hook for managing the relationships between campaign objective,
 * destination type, and optimization goals
 *
 * @param form - The form object from useCampaignForm
 * @returns Object with handlers for objective and destination changes
 *
 * @example
 * ```tsx
 * const { handleObjectiveChange, handleDestinationChange } = useObjectiveMapping(form);
 *
 * // Use in components
 * <ObjectiveStep form={form} handleObjectiveChange={handleObjectiveChange} />
 * <DestinationStep form={form} handleDestinationChange={handleDestinationChange} />
 * ```
 */
//UseFormReturnType<CampaignFormValues>
//UseObjectiveMappingReturn
export function useObjectiveMapping(form: any) {
    // // Use a ref to avoid dependency on the entire form object
    // const formRef = useRef(form);

    // // Update the ref when form changes
    // useEffect(() => {
    //     formRef.current = form;
    // }, [form]);

    /**
     * Updates destination type based on new objective
     * and ensures a valid destination is selected
     */
    const handleDestinationChange = useCallback((value: string): void => {
        const currentForm = form.values;

        // Update the destination type in form
        currentForm.setFieldValue('campaign.destinationType', value);

        // Update optimization goal based on objective + destination combination
        if (currentForm.objective) {
            const defaultOptimization = getDefaultOptimizationGoal(
                currentForm.campaign.objective,
                value
            );
            currentForm.setFieldValue('adSets.optimization_goal', defaultOptimization);
        }
    }, []);

    // /**
    //  * Updates objective and ensures compatible destination type and optimization goal
    //  */
    // const handleObjectiveChange = useCallback((value: string): void => {
    //     const currentForm = form;

    //     // Update the objective in form
    //     currentForm.setFieldValue('objective', value);

    // }, []);

    return { handleDestinationChange };
}