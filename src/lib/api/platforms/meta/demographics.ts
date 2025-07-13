import { fetchWithValidation } from "@/lib/actions/common/apiUtils";

interface AgeGenderEntry {
  age: string;
  gender: string;
  impressions: number;
}

interface CountryEntry {
  date_start: string;
  date_stop: string;
  spend: string;
  country: string;
  impressions: number;
}

interface FacebookInsightsResponse<T> {
  data: T[];
}

export const fetchAgeGenderCountryMetrics = async (
  adAccountId: string,
  accessToken: string
): Promise<{
  ageGenderData: AgeGenderEntry[];
  countryData: CountryEntry[];
}> => {

  const API_BASE_URL = process.env.FACEBOOK_GRAPH_API_BASE_URL;

  if (!API_BASE_URL) {
    throw new Error("FACEBOOK_GRAPH_API_BASE_URL is not set in the environment variables");
  }

  const urls = {
    ageGender: `${API_BASE_URL}/${adAccountId}/insights?breakdowns=age,gender&date_preset=maximum`,
    country: `${API_BASE_URL}/${adAccountId}/insights?breakdowns=country&date_preset=maximum`,
  };

  const [ageGenderDatas, countryDatas] = await Promise.all([
    fetchWithValidation<FacebookInsightsResponse<AgeGenderEntry>>(urls.ageGender, accessToken),
    fetchWithValidation<FacebookInsightsResponse<CountryEntry>>(urls.country, accessToken),
  ]);

  if (!ageGenderDatas.data || !Array.isArray(ageGenderDatas.data)) {
    throw new Error("Invalid age and gender data format");
  }
  if (!countryDatas.data || !Array.isArray(countryDatas.data)) {
    throw new Error("Invalid country data format");
  }

  const ageGenderData = ageGenderDatas.data.map((entry) => ({
    age: entry.age || "unknown",
    gender: entry.gender || "unknown",
    impressions: entry.impressions || 0
  }));

  const countryData = countryDatas.data.map((entry) => ({
    date_start: entry.date_start,
    date_stop: entry.date_stop,
    spend: entry.spend || "0",
    country: entry.country || "unknown",
    impressions: entry.impressions || 0
  }));

  return { ageGenderData, countryData };
};
