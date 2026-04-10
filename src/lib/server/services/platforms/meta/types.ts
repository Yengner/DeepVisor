export interface AdAccountDetails {
  id: string;
  name: string;
  account_status: number;
  currency?: string | null;
  timezone_name?: string | null;
}

export interface PageAccount {
  id: string;
  name: string;
  account: string;
  access_token: string;
  instagram_business_account?: {
    id: string;
  };
}
