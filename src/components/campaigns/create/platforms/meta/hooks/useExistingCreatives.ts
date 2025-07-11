import { fetchExistingCreatives, MetaCreative } from '@/lib/actions/meta/creatives/actions';
import { useState, useEffect, useCallback } from 'react'; // Add useCallback
import { ErrorDetails } from '@/lib/types/api';
import { handleApiPromise } from '@/lib/utils/toasts/toast-handlers';

// Preview types supported by Meta


// Options for the hook
export interface UseExistingCreativesOptions {
  // Required parameters
  platformId: string;
  adAccountId: string;

  // Control parameters
  enabled?: boolean;
  limit?: number;
  thumbnailWidth?: number;
  thumbnailHeight?: number;
}

/**
 * Return type for useExistingCreatives hook
 */
export interface UseExistingCreativesReturn {
  creatives: MetaCreative[];
  loading: boolean;
  error: string | null;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  goToNextPage: () => void;
  goToPreviousPage: () => void;
  reset: () => void;
}

/**
 * Hook for fetching existing Meta ad creatives
 */
export function useExistingCreatives({
  platformId,
  adAccountId,
  enabled = true,
  limit = 25, // Set default to 25
  thumbnailWidth = 300,
  thumbnailHeight = 225
}: UseExistingCreativesOptions): UseExistingCreativesReturn {
  const [creatives, setCreatives] = useState<MetaCreative[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState<boolean>(false);

  // Cursor state
  const [afterCursor, setAfterCursor] = useState<string | null>(null);
  const [beforeCursor, setBeforeCursor] = useState<string | null>(null);
  const [hasNextPage, setHasNextPage] = useState<boolean>(false);
  const [hasPreviousPage, setHasPreviousPage] = useState<boolean>(false);

  // Track current request cursors
  const [currentAfter, setCurrentAfter] = useState<string | null>(null);
  const [currentBefore, setCurrentBefore] = useState<string | null>(null);

  // Function to load creatives using cursor
  const loadCreatives = useCallback(async (after: string | null = null, before: string | null = null) => {
    setLoading(true);
    setError(null);

    setCurrentAfter(after);
    setCurrentBefore(before);

    try {
      await handleApiPromise(
        fetchExistingCreatives({
          platformId,
          adAccountId,
          limit, // Add the limit parameter here
          after,
          before,
          thumbnailWidth,
          thumbnailHeight
        }),
        {
          onSuccess: (data) => {
            setCreatives(data.creatives);
            setAfterCursor(data.cursors.after);
            setBeforeCursor(data.cursors.before);
            setHasNextPage(data.hasNextPage);
            setHasPreviousPage(data.hasPreviousPage);
          },
          onError: (error: ErrorDetails) => {
            console.log("Error loading creatives:", error);
            setError(error.userMessage);
          },
          showSuccessToast: false
        }
      );
    } catch (err) {
      console.error("Unexpected error loading creatives:", err);
      setError("An unexpected error occurred while loading creatives.");
    } finally {
      setLoading(false);
    }
  }, [platformId, adAccountId, limit, thumbnailWidth, thumbnailHeight]); // Include all dependencies

  // Wrap reset with useCallback to prevent recreation on every render
  const reset = useCallback(() => {
    loadCreatives(null, null);
  }, [loadCreatives]);

  useEffect(() => {
    // Only fetch if enabled and we have an adAccountId
    if (!enabled || !adAccountId || !platformId) {
      return;
    }
    // Reset pagination when dependencies change
    loadCreatives(null, null);
  }, [platformId, adAccountId, enabled, loadCreatives]);

  // Navigation functions - also wrap these with useCallback
  const goToNextPage = useCallback(() => {
    if (hasNextPage && afterCursor) {
      loadCreatives(afterCursor, null);
    }
  }, [hasNextPage, afterCursor, loadCreatives]);

  const goToPreviousPage = useCallback(() => {
    if (hasPreviousPage && beforeCursor) {
      loadCreatives(null, beforeCursor);
    }
  }, [hasPreviousPage, beforeCursor, loadCreatives]);

  return {
    creatives,
    loading,
    error,
    hasNextPage,
    hasPreviousPage,
    goToNextPage,
    goToPreviousPage,
    reset
  };
}