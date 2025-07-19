import { MetaCreative } from '@/lib/actions/meta/creatives/actions';
import { useState, useEffect, useCallback } from 'react';
import { ErrorDetails } from '@/lib/utils/error-handling/types/api';
import { handleApiPromise } from '@/lib/utils/toasts/toast-handlers';

export interface UseExistingCreativesOptions {
  platformId: string;
  adAccountId: string;
  enabled?: boolean;
  limit?: number;
  thumbnailWidth?: number;
  thumbnailHeight?: number;
}

export interface UseExistingCreativesReturn {
  creatives: MetaCreative[];
  loading: boolean;
  error: string | null;
  hasLoaded: boolean;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  goToNextPage: () => void;
  goToPreviousPage: () => void;
  reset: () => void;
}

export function useExistingCreatives({
  platformId,
  adAccountId,
  enabled = true,
  limit = 10,
  thumbnailWidth = 300,
  thumbnailHeight = 225
}: UseExistingCreativesOptions): UseExistingCreativesReturn {
  const [creatives, setCreatives] = useState<MetaCreative[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState<boolean>(false);

  // Pagination state
  const [afterCursor, setAfterCursor] = useState<string | null>(null);
  const [beforeCursor, setBeforeCursor] = useState<string | null>(null);
  const [hasNextPage, setHasNextPage] = useState<boolean>(false);
  const [hasPreviousPage, setHasPreviousPage] = useState<boolean>(false);

  // Internal: track last loaded params to avoid unnecessary fetches
  const [lastParams, setLastParams] = useState<{ after: string | null; before: string | null } | null>(null);

  // Function to load creatives using cursor
  const loadCreatives = useCallback(async (after: string | null = null, before: string | null = null, force = false) => {
    // Avoid refetching if already loaded and not forced
    if (hasLoaded && !force && lastParams && lastParams.after === after && lastParams.before === before) {
      return;
    }

    setLoading(true);
    setError(null);

    setLastParams({ after, before });

    try {
      const params = new URLSearchParams({
        platformId,
        adAccountId,
        limit: String(limit),
        ...(after ? { after } : {}),
        ...(before ? { before } : {}),
        ...(thumbnailWidth ? { thumbnailWidth: String(thumbnailWidth) } : {}),
        ...(thumbnailHeight ? { thumbnailHeight: String(thumbnailHeight) } : {}),
      });

      const res = await fetch(`/api/meta/creatives?${params.toString()}`);
      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error?.userMessage || data.error || "Failed to load creatives");
        return;
      }

      setCreatives(data.creatives);
      setAfterCursor(data.cursors?.after || null);
      setBeforeCursor(data.cursors?.before || null);
      setHasNextPage(!!data.hasNextPage);
      setHasPreviousPage(!!data.hasPreviousPage);
      setHasLoaded(true);
    } catch (err) {
      setError("An unexpected error occurred while loading creatives.");
    } finally {
      setLoading(false);
    }
  }, [platformId, adAccountId, limit, thumbnailWidth, thumbnailHeight]);

  // Reset function to clear state and force reload
  const reset = useCallback(() => {
    setHasLoaded(false);
    setLastParams(null);
    setAfterCursor(null);
    setBeforeCursor(null);
    setHasNextPage(false);
    setHasPreviousPage(false);
    setCreatives([]);
    loadCreatives(null, null, true);
  }, [loadCreatives]);

  // Initial load or when dependencies change
  useEffect(() => {
    if (!enabled || !adAccountId || !platformId) return;
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platformId, adAccountId, enabled, limit, thumbnailWidth, thumbnailHeight]);

  // Navigation functions
  const goToNextPage = useCallback(() => {
    if (hasNextPage && afterCursor) {
      loadCreatives(afterCursor, null, true);
    }
  }, [hasNextPage, afterCursor, loadCreatives]);

  const goToPreviousPage = useCallback(() => {
    if (hasPreviousPage && beforeCursor) {
      loadCreatives(null, beforeCursor, true);
    }
  }, [hasPreviousPage, beforeCursor, loadCreatives]);

  return {
    creatives,
    loading,
    error,
    hasLoaded,
    hasNextPage,
    hasPreviousPage,
    goToNextPage,
    goToPreviousPage,
    reset
  };
}