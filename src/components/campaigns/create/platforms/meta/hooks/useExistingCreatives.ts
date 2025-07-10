import { fetchExistingCreatives, MetaCreative } from '@/lib/actions/meta/creatives/actions';
import { fetchCreativePreviews } from '@/lib/actions/meta/creatives/previews';
import { useState, useEffect } from 'react';
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
  page?: number;
  limit?: number;
}

/**
 * Return type for useExistingCreatives hook
 */
export interface UseExistingCreativesReturn {
  /** List of available creatives */
  creatives: MetaCreative[];
  /** Whether creatives are currently being loaded */
  loading: boolean;
  /** Error message if creatives failed to load, null otherwise */
  error: string | null;
  /** Total number of pages available */
  totalPages: number;
  /** Current page number */
  currentPage: number;
  /** Whether creatives have been loaded at least once */
  hasLoaded: boolean;
}

/**
 * Hook for fetching existing Meta ad creatives
 */
export function useExistingCreatives({
  platformId,
  adAccountId,
  enabled = true,
  page = 1,
  limit = 9
}: UseExistingCreativesOptions): UseExistingCreativesReturn {
  const [creatives, setCreatives] = useState<MetaCreative[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [hasLoaded, setHasLoaded] = useState<boolean>(false);

  useEffect(() => {
    // Only fetch if enabled and we have an adAccountId
    if (!enabled || !adAccountId || !platformId) {
      return;
    }

    async function loadCreatives(): Promise<void> {
      setLoading(true);
      setError(null);

      try {
        await handleApiPromise(
          fetchExistingCreatives({
            platformId,
            adAccountId,
            page,
            limit
          }),
          {
            onSuccess: (data) => {
              setCreatives(data.creatives);
              setTotalPages(data.totalPages);
              setHasLoaded(true);
            },
            // Custom error handler to capture the error message
            onError: (error: ErrorDetails) => {
              console.log("Error loading Meta creatives:", error);
              setError(error.userMessage);
            },
            // Disable toast for background loading
            showSuccessToast: false
          }
        );
      } catch (err) {
        console.error("Unexpected error loading creatives:", err);
        setError("An unexpected error occurred while loading Meta creatives.");
      } finally {
        setLoading(false);
      }
    }

    loadCreatives();
  }, [platformId, adAccountId, enabled, page, limit]);

  return {
    creatives,
    loading,
    error,
    totalPages,
    currentPage: page,
    hasLoaded
  };
}