import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  CreativeLibraryItem,
  CreativeLibrarySort,
  CreativeLibrarySource,
} from '@/lib/shared/types/creativeLibrary';

export interface UseExistingCreativesOptions {
  platformId: string;
  adAccountId: string;
  enabled?: boolean;
  limit?: number;
  source?: CreativeLibrarySource;
  sort?: CreativeLibrarySort;
}

export interface UseExistingCreativesReturn {
  creatives: CreativeLibraryItem[];
  allCreatives: {
    adCreatives: CreativeLibraryItem[];
    pagePosts: CreativeLibraryItem[];
  };
  loading: boolean;
  error: string | null;
  hasLoaded: boolean;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  goToNextPage: () => void;
  goToPreviousPage: () => void;
  reset: () => void;
}

type CreativeLibraryResponse = {
  success: true;
  data: {
    adCreatives: CreativeLibraryItem[];
    pagePosts: CreativeLibraryItem[];
  };
} | {
  success: false;
  error?: {
    userMessage?: string;
    message?: string;
  };
};

function getTimestamp(item: CreativeLibraryItem): number {
  const value = item.createdTime ?? item.updatedTime;
  return value ? new Date(value).getTime() : 0;
}

function compareBest(left: CreativeLibraryItem, right: CreativeLibraryItem): number {
  const scoreDiff = right.score - left.score;
  if (scoreDiff !== 0) {
    return scoreDiff;
  }

  const resultsDiff = right.stats.results - left.stats.results;
  if (resultsDiff !== 0) {
    return resultsDiff;
  }

  const spendDiff = right.stats.spend - left.stats.spend;
  if (spendDiff !== 0) {
    return spendDiff;
  }

  return getTimestamp(right) - getTimestamp(left);
}

function sortCreatives(items: CreativeLibraryItem[], sort: CreativeLibrarySort): CreativeLibraryItem[] {
  const sorted = [...items];

  switch (sort) {
    case 'newest':
      return sorted.sort((left, right) => getTimestamp(right) - getTimestamp(left));
    case 'oldest':
      return sorted.sort((left, right) => getTimestamp(left) - getTimestamp(right));
    case 'spend':
      return sorted.sort((left, right) => right.stats.spend - left.stats.spend || compareBest(left, right));
    case 'results':
      return sorted.sort((left, right) => right.stats.results - left.stats.results || compareBest(left, right));
    case 'best':
    default:
      return sorted.sort(compareBest);
  }
}

export function useExistingCreatives({
  platformId,
  adAccountId,
  enabled = true,
  limit = 120,
  source = 'ad_creative',
  sort = 'best',
}: UseExistingCreativesOptions): UseExistingCreativesReturn {
  const [adCreatives, setAdCreatives] = useState<CreativeLibraryItem[]>([]);
  const [pagePosts, setPagePosts] = useState<CreativeLibraryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const loadCreatives = useCallback(async () => {
    if (!enabled || !platformId || !adAccountId) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        platformId,
        adAccountId,
        limit: String(limit),
      });

      const response = await fetch(`/api/campaigns/creative-library?${params.toString()}`, {
        cache: 'no-store',
      });
      const body = (await response.json().catch(() => null)) as CreativeLibraryResponse | null;

      if (!response.ok || !body) {
        setError('Failed to load existing creative performance.');
        setAdCreatives([]);
        setPagePosts([]);
        return;
      }

      if (!body.success) {
        setError(body.error?.userMessage || body.error?.message || 'Failed to load existing creative performance.');
        setAdCreatives([]);
        setPagePosts([]);
        return;
      }

      setAdCreatives(body.data.adCreatives ?? []);
      setPagePosts(body.data.pagePosts ?? []);
      setHasLoaded(true);
    } catch {
      setError('We could not load existing creative performance right now.');
      setAdCreatives([]);
      setPagePosts([]);
    } finally {
      setLoading(false);
    }
  }, [adAccountId, enabled, limit, platformId]);

  useEffect(() => {
    void loadCreatives();
  }, [loadCreatives, reloadKey]);

  const reset = useCallback(() => {
    setHasLoaded(false);
    setReloadKey((current) => current + 1);
  }, []);

  const creatives = useMemo(() => {
    const sourceItems = source === 'page_post' ? pagePosts : adCreatives;
    return sortCreatives(sourceItems, sort);
  }, [adCreatives, pagePosts, sort, source]);

  return {
    creatives,
    allCreatives: {
      adCreatives,
      pagePosts,
    },
    loading,
    error,
    hasLoaded,
    hasNextPage: false,
    hasPreviousPage: false,
    goToNextPage: () => undefined,
    goToPreviousPage: () => undefined,
    reset,
  };
}
