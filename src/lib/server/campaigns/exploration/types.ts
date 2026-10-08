import type {
  DailyRow,
  Period,
  TrendPoint,
  UnitState,
  AttentionItem,
} from "../../dashboard/overview/types";
import type { Database } from "@/lib/shared/types/supabase";

export type { Period };
export type ExplorationEntity =
  Database["public"]["Tables"]["ad_entities"]["Row"];
export type Creative = Database["public"]["Tables"]["ad_creatives"]["Row"];
export type Daily = DailyRow;
export type Metrics = {
  spend: number | null;
  results: number | null;
  costPerResult: number | null;
  impressions: number | null;
  clicks: number | null;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  reach: number | null;
  frequency: number | null;
  linkClicks?: number | null;
};
export type Delta = {
  value: number;
  unit: "%" | "pp";
  tone: "positive" | "negative" | "neutral";
};
export type Media = {
  creativeId: string;
  image: string | null;
  fallbackImage: string | null;
  fallbackImages?: string[];
  kind: "image" | "video" | "carousel" | "dynamic";
  headline: string | null;
  text: string | null;
  cta: string | null;
};
export type Summary = {
  id: string;
  name: string;
  delivery: string;
  level: "campaign" | "adset" | "ad";
  state: UnitState | null;
  metrics: Metrics;
  media: Media[];
  complete: boolean;
  deltas: Partial<Record<keyof Metrics, Delta>>;
  leader: boolean;
  tied: boolean;
  strongest?: string;
};
export type ExplorationView = {
  accountId: string;
  integrationId: string;
  accountName: string;
  currency: string | null;
  period: Period;
  today: string;
  zone: string;
  since: string;
  comparison: string | null;
  items: Summary[];
  parent: { id: string; name: string } | null;
  detail: null | {
    unit: Summary;
    campaign: string;
    budget: string | null;
    budgetAsOf: string | null;
    points: TrendPoint[];
    adPoints: Record<string, TrendPoint[]>;
    recommendations: AttentionItem[];
  };
  warnings: string[];
  decisionEvidenceAvailable?: boolean;
  pulse: Array<{ adsetId: string; item: Summary }>;
  board?: {
    activeIds?: string[];
    activeFeaturedId?: string | null;
    activeFeaturedLabel?: string | null;
    featuredId: string | null;
    featuredLabel: string | null;
    highlightIds: string[];
    attentionIds: string[];
  };
};
