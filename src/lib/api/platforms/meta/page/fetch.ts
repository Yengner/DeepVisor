import { FacebookAdsApi } from "@/lib/sdk/client";
import { PageAccount } from "../types";

/**
 * Fetch Meta page accounts for a user
 */
export async function fetchMetaPageAccounts(accessToken: string): Promise<PageAccount[]> {

    const api = FacebookAdsApi.init(accessToken);
    const response = await api.call('GET', ['me', 'accounts'], {
        fields: ['id', 'name', 'access_token', 'instagram_business_account'],
        limit: 50,
    })

    const pageAccounts: PageAccount[] = response.data

    return pageAccounts;
}
