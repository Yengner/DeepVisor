import 'server-only'

import { getBusinessRecommendations } from '@/lib/server/data/queries/recommendations.query';

export async function getRecommendations(userId: string) {
  return getBusinessRecommendations(userId);
}
