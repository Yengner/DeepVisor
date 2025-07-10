import { useState, useEffect } from 'react';
import { fetchCreativePreviews, PreviewType } from '@/lib/actions/meta/creatives/previews';
import { handleApiPromise } from '@/lib/utils/toasts/toast-handlers';
import { ErrorDetails } from '@/lib/types/api';

interface UseCreativePreviewOptions {
    platformId: string;
    creativeId: string;
    previewTypes?: PreviewType[];
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

    useEffect(() => {
        // Only fetch if enabled and we have a creativeId
        if (!enabled || !creativeId || !platformId) {
            return;
        }

        async function loadPreview(): Promise<void> {
            setLoading(true);
            setError(null);

            try {
                await handleApiPromise(
                    fetchCreativePreviews({
                        platformId,
                        creativeId,
                        previewTypes
                    }),
                    {
                        onSuccess: (data) => {
                            setPreviews(data);
                            setHasLoaded(true);
                        },
                        onError: (error: ErrorDetails) => {
                            console.log("Error loading creative preview:", error);
                            setError(error.userMessage);
                        },
                        showSuccessToast: false
                    }
                );
            } catch (err) {
                console.error("Unexpected error loading preview:", err);
                setError("An unexpected error occurred while loading the creative preview.");
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