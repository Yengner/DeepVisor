import { useState, useEffect } from 'react';

/**
 * Interface representing a Facebook page
 */
interface FacebookPage {
  page_id: string;
  name: string;
  picture?: string;
  access_token?: string;
}

/**
 * Return type for useFacebookPages hook
 */
interface UseFacebookPagesReturn {
  /** List of available Facebook pages */
  facebookPages: FacebookPage[];
  /** Whether pages are currently being loaded */
  loadingPages: boolean;
  /** Error message if pages failed to load, null otherwise */
  pagesError: string | null;
  /** Whether pages have been loaded at least once */
  hasLoaded: boolean;
}

/**
 * Hook for fetching Facebook pages for use in campaign creation
 *
 * @param setFieldValue - Function to update form fields with page ID
 * @param shouldFetch - Whether the hook should fetch pages (e.g., based on active step)
 * @returns Object with Facebook pages data, loading state, and error information
 *
 * @example
 * ```tsx
 * const { facebookPages, loadingPages, pagesError } = useFacebookPages(
 *   form.setFieldValue,
 *   active === 1
 * );
 * ```
 */
export function useFacebookPages(
  setFieldValue: (fieldName: string, value: any) => void,
  shouldFetch: boolean = false
): UseFacebookPagesReturn {
  const [facebookPages, setFacebookPages] = useState<FacebookPage[]>([]);
  const [loadingPages, setLoadingPages] = useState<boolean>(false);
  const [pagesError, setPagesError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState<boolean>(false);

  useEffect(() => {
    // Only fetch if shouldFetch is true and we haven't already loaded the data
    if (!shouldFetch || hasLoaded) {
      return;
    }

    async function fetchFacebookPages(): Promise<void> {
      setLoadingPages(true);
      setPagesError(null);

      try {
        const response = await fetch('/api/meta/pages');
        const data = await response.json();

        if (response.ok && data.success) {
          setFacebookPages(data.pages || []);

          // If pages exist, set the first one as default
          if (data.pages && data.pages.length > 0) {
            setFieldValue('page_id', data.pages[0].page_id);
          }

          // Mark as loaded so we don't fetch again
          setHasLoaded(true);
        } else {
          setPagesError(data.error || 'Failed to load Facebook pages');
        }
      } catch (error) {
        console.error('Error fetching Facebook pages:', error);
        setPagesError('Network error while loading Facebook pages');
      } finally {
        setLoadingPages(false);
      }
    }

    fetchFacebookPages();
  }, [shouldFetch, hasLoaded, setFieldValue]);

  return { facebookPages, loadingPages, pagesError, hasLoaded };
}