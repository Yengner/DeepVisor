import 'server-only'
import { getBusinessRecommendations } from '../../repositories/recommendations/getBusinessRecommendations'

export async function getRecommendations(userId: string) {
  return getBusinessRecommendations(userId);
}