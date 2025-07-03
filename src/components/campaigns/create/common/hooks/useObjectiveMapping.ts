import { useCallback, useRef, useEffect } from 'react';
import { UseFormReturnType } from '@mantine/form';
import {
    getValidDestinationTypes,
    getDefaultOptimizationGoal,
} from '@/components/campaigns/create/common/utils/objectiveMappings';
import { CampaignFormValues } from '@/lib/actions/meta/types';

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
export function useObjectiveMapping(
    form: UseFormReturnType<CampaignFormValues>
): UseObjectiveMappingReturn {
    // Use a ref to avoid dependency on the entire form object
    const formRef = useRef(form);

    // Update the ref when form changes
    useEffect(() => {
        formRef.current = form;
    }, [form]);

    /**
     * Updates destination type based on new objective
     * and ensures a valid destination is selected
     */
    const handleDestinationChange = useCallback((value: string): void => {
        const currentForm = formRef.current;

        // Update the destination type in form
        currentForm.setFieldValue('destinationType', value);

        // Update optimization goal based on objective + destination combination
        if (currentForm.values.objective) {
            const defaultOptimization = getDefaultOptimizationGoal(
                currentForm.values.objective,
                value
            );
            currentForm.setFieldValue('optimization', defaultOptimization);
        }
    }, []);

    /**
     * Updates objective and ensures compatible destination type and optimization goal
     */
    const handleObjectiveChange = useCallback((value: string): void => {
        const currentForm = formRef.current;

        // Update the objective in form
        currentForm.setFieldValue('objective', value);

        // Get valid destination types for this objective
        const validDestinations = getValidDestinationTypes(value);

        // If current destination is not valid for new objective, reset it to first valid option
        if (
            !validDestinations.includes(currentForm.values.adDestinationType) &&
            validDestinations.length > 0
        ) {
            const newDestination = validDestinations[0];
            // Use the function directly instead of the callback to avoid circular dependency
            currentForm.setFieldValue('destinationType', newDestination);

            // Also update optimization goal
            const defaultOptimization = getDefaultOptimizationGoal(value, newDestination);
            currentForm.setFieldValue('optimization', defaultOptimization);
        } else {
            // Even if destination is valid, we still need to update optimization based on new objective
            const defaultOptimization = getDefaultOptimizationGoal(
                value,
                currentForm.values.adDestinationType
            );
            currentForm.setFieldValue('optimization', defaultOptimization);
        }
    }, []);

    return { handleObjectiveChange, handleDestinationChange };
}