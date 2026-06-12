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

type PreviewApiResponse = {
    previews?: Record<string, { body: string }>;
} | {
    success: true;
    data: {
        previews: Record<string, { body: string }>;
    };
} | {
    success: false;
    error?: {
        userMessage?: string;
        message?: string;
    };
};

function getPreviewPayload(data: PreviewApiResponse): Record<string, { body: string }> {
    if ('success' in data) {
        return data.success ? data.data.previews : {};
    }

    return data.previews ?? {};
}

function getPreviewError(data: PreviewApiResponse): string | null {
    if ('success' in data && !data.success) {
        return data.error?.userMessage || data.error?.message || 'Failed to fetch preview';
    }

    return null;
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
    const previewTypesParam = previewTypes.join(',');

    useEffect(() => {
        if (!enabled || !creativeId || !platformId) {
            setPreviews({});
            setLoading(false);
            setError(null);
            setHasLoaded(false);
            return;
        }

        let cancelled = false;

        async function loadPreview() {
            setLoading(true);
            setError(null);
            setHasLoaded(false);

            try {
                const params = new URLSearchParams({
                    platformId,
                    creativeId: creativeId || '',
                    previewTypes: previewTypesParam
                });
                const res = await fetch(`/api/meta/previews?${params.toString()}`);
                const data = (await res.json().catch(() => ({}))) as PreviewApiResponse;
                const apiError = getPreviewError(data);

                if (!res.ok || apiError) {
                    throw new Error(apiError || 'Failed to fetch preview');
                }

                if (!cancelled) {
                    setPreviews(getPreviewPayload(data));
                    setHasLoaded(true);
                }

            } catch (err: unknown) {
                if (!cancelled) {
                    setPreviews({});
                    setError((err as Error).message || 'An unexpected error occurred while loading the creative preview.');
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        void loadPreview();

        return () => {
            cancelled = true;
        };
    }, [platformId, creativeId, enabled, previewTypesParam]);

    return {
        previews,
        loading,
        error,
        hasLoaded
    };
}
