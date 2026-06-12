export type CreativeLibrarySource = 'ad_creative' | 'page_post';

export type CreativeLibraryStats = {
  spend: number;
  results: number;
  leads: number;
  messages: number;
  calls: number;
  clicks: number;
  impressions: number;
  ctr: number | null;
  costPerResult: number | null;
  firstDay: string | null;
  lastDay: string | null;
};

export type CreativeLibraryItem = {
  id: string;
  source: CreativeLibrarySource;
  sourceId: string;
  name: string;
  thumbnail_url: string | null;
  type: string;
  createdTime: string | null;
  updatedTime: string | null;
  stats: CreativeLibraryStats;
  score: number;
  isBest: boolean;
  creativeIds: string[];
  postId?: string | null;
};

export type CreativeLibrarySort = 'best' | 'newest' | 'oldest' | 'spend' | 'results';
