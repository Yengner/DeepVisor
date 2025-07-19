import { getMetaPages, MetaPage } from '@/lib/actions/meta/pages/actions';
import { ErrorDetails } from '@/lib/utils/error-handling/types/api';
import { handleApiPromise } from '@/lib/utils/toasts/toast-handlers';
import { useState, useEffect } from 'react';

/**
 * Return type for useMetaPages hook
 */
interface UseMetaPagesReturn {
  /** List of available Facebook pages */
  metaPages: MetaPage[];
  /** Whether pages are currently being loaded */
  loadingPages: boolean;
  /** Error message if pages failed to load, null otherwise */
  pagesError: string | null;
  /** Whether pages have been loaded at least once */
  hasLoaded: boolean;
}

/**
 * Hook for fetching Meta pages for use in campaign creation
 */
export function useMetaPages(
  setFieldValue: (fieldName: string, value: any) => void,
  platformId: string,
  shouldFetch: boolean = false,
): UseMetaPagesReturn {
  const [metaPages, setMetaPages] = useState<MetaPage[]>([]);
  const [loadingPages, setLoadingPages] = useState<boolean>(false);
  const [pagesError, setPagesError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState<boolean>(false);

  useEffect(() => {
    if (!shouldFetch || hasLoaded || !platformId) {
      return;
    }

    async function loadMetaPages(): Promise<void> {
      setLoadingPages(true);
      setPagesError(null);

      try {
        await handleApiPromise(
          getMetaPages({ platformId }),
          {
            onSuccess: (data) => {
              setMetaPages(data);
              setHasLoaded(true);
              setFieldValue('page_id', data.length > 0 ? data[0].page_id : '');
            },
            onError: (error: ErrorDetails) => {
              console.log("Error loading Meta pages:", error);
              setPagesError(error.userMessage);
            }
          }
        );
      } catch (err) {
        console.error("Unexpected error:", err);
        setPagesError("An unexpected error occurred while loading Meta pages.");
      } finally {
        setLoadingPages(false);
      }
    }

    loadMetaPages();
  }, [shouldFetch, hasLoaded, platformId]);

  return { metaPages, loadingPages, pagesError, hasLoaded };
}