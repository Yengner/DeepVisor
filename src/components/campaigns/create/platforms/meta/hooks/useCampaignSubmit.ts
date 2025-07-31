import { useState } from 'react';
import { CampaignFormValues } from '@/lib/actions/meta/types';
import { Node, Edge } from '@xyflow/react';

/**
 * Response from campaign submission API
 */
interface CampaignSubmitResponse {
  success: boolean;
  error?: string;
  message?: string;
  jobId?: string;
  nodes?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  edges?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

/**
 * Return type for the useCampaignSubmit hook
 */
interface UseCampaignSubmitReturn {
  /** Submit the campaign to the API */
  submitCampaign: (values?: CampaignFormValues) => Promise<CampaignSubmitResponse>;
  /** Whether the campaign is currently being submitted */
  isSubmitting: boolean;
  /** Error message if submission failed */
  submitError: string | null;
  /** Whether submission was successful */
  submitSuccess: boolean;
  /** Reset submission state */
  resetSubmission: () => void;
  /** Job ID for tracking submission progress */
  jobId: string | null;
  /** Show progress modal */
  showProgressModal: boolean;
  /** Function to set the visibility of the progress modal */
  setShowProgressModal: (open: boolean) => void;
  /** Nodes for the progress graph */
  progressNodes: Node[];
  /** Edges for the progress graph */
  progressEdges: Edge[];

}

/**
 * Hook for handling campaign submission to API
 * 
 * Manages submission state, error handling, and success tracking
 * 
 * @returns Object with submission functions and state
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export function useCampaignSubmit(): UseCampaignSubmitReturn {
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<boolean>(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [progressNodes, setProgressNodes] = useState<any[]>([]);
  const [progressEdges, setProgressEdges] = useState<any[]>([]);

  /**
   * Submit campaign data to API
   * 
   * @param form - Form values from useCampaignForm (optional if using test data)
   * @returns Response from API with success status and campaign ID
   */
  const submitCampaign = async (form?: CampaignFormValues): Promise<CampaignSubmitResponse> => {
    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);
    setJobId(null);
    setShowProgressModal(false);

    if (!form) {
      const errorMessage = "No form data provided and no test campaign type selected";
      setSubmitError(errorMessage);
      setIsSubmitting(false);
      return {
        success: false,
        error: errorMessage
      };
    }

    const formData = form;

    try {
      const res = await fetch('/api/meta/create-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await res.json();
      console.log("API response:", result);

      if (!result.success) {
        const errorMessage = result.error || 'Failed to create campaign';
        setSubmitError(errorMessage);
        return {
          success: false,
          error: errorMessage
        };
      }

      // Success
      setSubmitSuccess(true);
      setJobId(result.jobId || null);
      setShowProgressModal(true);
      setProgressNodes(result.nodes || null);
      setProgressEdges(result.edges || null);

      return {
        success: true,
        jobId: result.jobId,
        nodes: result.nodes,
        edges: result.edges,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      setSubmitError(errorMessage);

      return {
        success: false,
        error: errorMessage
      };
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Reset submission state
   */
  const resetSubmission = () => {
    setIsSubmitting(false);
    setSubmitError(null);
    setSubmitSuccess(false);
    setJobId(null);
  };

  return {
    submitCampaign,
    isSubmitting,
    submitError,
    submitSuccess,
    resetSubmission,
    jobId,
    showProgressModal,
    setShowProgressModal,
    progressNodes,
    progressEdges,
  };
}