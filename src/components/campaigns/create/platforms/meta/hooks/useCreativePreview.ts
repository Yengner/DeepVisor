import { useState, useEffect } from 'react';

interface UseCreativePreviewOptions {
    platformId: string;
    creativeId: string | null;
    previewTypes?: string[];
    enabled?: boolean;
}

interface UseCreativePreviewReturn {
    previews: Record<string, { body: string }>;
    loading: boolean;
    error: string | null;
    hasLoaded: boolean;
}

/**
 * Hook for fetching preview HTML for a selected Meta creative
 */
export function useCreativePreview({
    platformId,
    creativeId,
    previewTypes = ['DESKTOP_FEED_STANDARD', 'MOBILE_FEED_STANDARD'],
    enabled = true
}: UseCreativePreviewOptions): UseCreativePreviewReturn {
    const [previews, setPreviews] = useState<Record<string, { body: string }>>({});
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [hasLoaded, setHasLoaded] = useState<boolean>(false);

    /* eslint-disable react-hooks/exhaustive-deps */
    useEffect(() => {
        if (!enabled || !creativeId || !platformId) {
            return;
        }

        async function loadPreview() {
            setLoading(true);
            setError(null);
            setHasLoaded(false);

            try {
                const params = new URLSearchParams({
                    platformId,
                    creativeId: creativeId || '',
                    previewTypes: previewTypes.join(',')
                });
                const res = await fetch(`/api/meta/previews?${params.toString()}`);
                if (!res.ok) {
                    const data = await res.json();
                    throw new Error(data.error || 'Failed to fetch preview');
                }
                const data = await res.json();
                setPreviews(data.previews || {});
                setHasLoaded(true);

            } catch (err: unknown) {
                setError((err as Error).message || 'An unexpected error occurred while loading the creative preview.');
            } finally {
                setLoading(false);
            }
        }

        loadPreview();
    }, [platformId, creativeId, enabled]);

    return {
        previews,
        loading,
        error,
        hasLoaded
    };
}